import { createFileRoute } from "@tanstack/react-router";

type Intent = {
  id: string;
  amount: number;
  currency: string;
  network: string;
  address: string;
  created_at: string;
};

/** Look for an incoming on-chain transfer matching an intent. Returns tx hash + amount. */
async function findIncoming(intent: Intent): Promise<{ tx: string; amount: number } | null> {
  const since = new Date(intent.created_at).getTime() - 60_000;
  const currency = intent.currency.toUpperCase();
  const network = (intent.network || "").toUpperCase();

  try {
    // USDT / USDC on TRON (TRC20) — public TronGrid API, no key required.
    if ((currency === "USDT" || currency === "USDC") && (network.includes("TRC") || network.includes("TRON") || network === "")) {
      const res = await fetch(
        `https://api.trongrid.io/v1/accounts/${intent.address}/transactions/trc20?limit=50&only_to=true`,
      );
      if (res.ok) {
        const json: any = await res.json();
        for (const t of json?.data ?? []) {
          const symbol = String(t?.token_info?.symbol ?? "").toUpperCase();
          const decimals = Number(t?.token_info?.decimals ?? 6);
          const value = Number(t?.value ?? 0) / 10 ** decimals;
          if (symbol === currency && Number(t?.block_timestamp ?? 0) >= since && value > 0) {
            return { tx: String(t.transaction_id), amount: Number(value.toFixed(2)) };
          }
        }
      }
    }

    // Bitcoin — public Blockstream API, no key required.
    if (currency === "BTC") {
      const res = await fetch(`https://blockstream.info/api/address/${intent.address}/txs`);
      if (res.ok) {
        const txs: any[] = await res.json();
        for (const t of txs) {
          const seen = Number(t?.status?.block_time ?? 0) * 1000 || Date.now();
          if (seen < since) continue;
          const sats = (t?.vout ?? [])
            .filter((o: any) => o?.scriptpubkey_address === intent.address)
            .reduce((sum: number, o: any) => sum + Number(o?.value ?? 0), 0);
          if (sats > 0) return { tx: String(t.txid), amount: Number((sats / 1e8).toFixed(8)) };
        }
      }
    }

    // ERC20 / ETH — needs an Etherscan-compatible key when configured.
    const key = process.env["ETHERSCAN_API_KEY"];
    if (key && (currency === "ETH" || network.includes("ERC"))) {
      const action = currency === "ETH" ? "txlist" : "tokentx";
      const res = await fetch(
        `https://api.etherscan.io/api?module=account&action=${action}&address=${intent.address}&sort=desc&apikey=${key}`,
      );
      if (res.ok) {
        const json: any = await res.json();
        for (const t of json?.result ?? []) {
          if (String(t?.to ?? "").toLowerCase() !== intent.address.toLowerCase()) continue;
          if (Number(t?.timeStamp ?? 0) * 1000 < since) continue;
          const decimals = Number(t?.tokenDecimal ?? 18);
          const value = Number(t?.value ?? 0) / 10 ** decimals;
          if (value > 0) return { tx: String(t.hash), amount: Number(value.toFixed(2)) };
        }
      }
    }
  } catch {
    /* explorer unavailable — try again on the next poll */
  }
  return null;
}

/**
 * Backend deposit watcher. Called by the dashboard while a deposit is pending and
 * safe to schedule (cron) as well. Users never paste a transaction hash: this
 * endpoint reads the chain and credits the wallet when a transfer shows up.
 */
async function watch() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await supabaseAdmin
    .from("deposit_intents")
    .update({ status: "expired" })
    .eq("status", "awaiting")
    .lt("expires_at", new Date().toISOString());

  const { data, error } = await supabaseAdmin
    .from("deposit_intents")
    .select("id,amount,currency,network,address,created_at")
    .eq("status", "awaiting")
    .limit(50);

  if (error) return { checked: 0, credited: 0, error: error.message };

  let credited = 0;
  for (const intent of (data ?? []) as unknown as Intent[]) {
    const hit = await findIncoming(intent);
    if (!hit) continue;
    const { data: dupe } = await supabaseAdmin
      .from("deposit_intents")
      .select("id")
      .eq("detected_tx", hit.tx)
      .limit(1);
    if (dupe && dupe.length > 0) continue;
    const { error: creditError } = await supabaseAdmin.rpc("credit_deposit_intent", {
      _intent_id: intent.id,
      _tx: hit.tx,
      _amount: hit.amount,
    });
    if (!creditError) credited += 1;
  }

  return { checked: (data ?? []).length, credited };
}

export const Route = createFileRoute("/api/public/deposit-watch")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(await watch()), {
          headers: { "content-type": "application/json" },
        }),
      POST: async () =>
        new Response(JSON.stringify(await watch()), {
          headers: { "content-type": "application/json" },
        }),
    },
  },
});
