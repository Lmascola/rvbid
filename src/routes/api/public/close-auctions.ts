import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Public, idempotent maintenance endpoint. Closing an auction records the
// winner, moves the RV to Recently Sold, bumps the platform stats and promotes
// the next queued RV to live. Safe to call as often as every minute.
async function closeAuctions() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    return new Response(JSON.stringify({ ok: false, error: "backend not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  const supabase = createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("close_expired_auctions");
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, closed: data ?? 0 }), {
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/close-auctions")({
  server: {
    handlers: {
      GET: () => closeAuctions(),
      POST: () => closeAuctions(),
    },
  },
});
