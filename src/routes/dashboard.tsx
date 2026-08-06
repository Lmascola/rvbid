import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { notifyEmailChanged } from "@/lib/email-change.functions";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2, Send } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KycUpload } from "@/components/site/KycUpload";
import { useAuth } from "@/hooks/useAuth";
import { dateTime, db, money, PASSWORD_RULES, passwordIsStrong } from "@/lib/rvbid";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard | RVBID" },
      {
        name: "description",
        content: "Manage your RVBID wallet, deposits, withdrawals, bids and won auctions.",
      },
      { property: "og:title", content: "My RVBID Dashboard" },
      { property: "og:description", content: "Wallet, bids and auction results in one place." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile, loading, refreshProfile } = useAuth();

  const activity = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const listingCols = "id,title,status,current_bid,sold_price,ends_at,images";
      const [bids, won, deposits, withdrawals, transactions, addresses] = await Promise.all([
        db
          .from("bids")
          .select(`id,amount,created_at,listing_id,listings(${listingCols})`)
          .eq("bidder_id", user!.id)
          .order("created_at", { ascending: false }),
        db.from("listings").select(listingCols).eq("winner_id", user!.id),
        db.from("deposits").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
        db.from("withdrawals").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
        db.from("transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
        db.from("deposit_addresses").select("*").eq("active", true),
      ]);
      return {
        bids: bids.data ?? [],
        won: won.data ?? [],
        deposits: deposits.data ?? [],
        withdrawals: withdrawals.data ?? [],
        transactions: transactions.data ?? [],
        addresses: addresses.data ?? [],
      };
    },
  });

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16"><div className="panel h-72 animate-pulse" /></div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl">Sign in to view your dashboard</h1>
        <Button className="mt-6" asChild><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  const documentsSubmitted =
    Boolean(profile?.kyc_id_url && profile?.kyc_selfie_url) || profile?.kyc_status === "approved";

  if (profile && !documentsSubmitted) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Step 2 of 2</p>
        <h1 className="mt-2 font-display text-3xl">Upload your documents</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your dashboard unlocks once you submit a government-issued ID and a selfie. Our team then
          reviews them — bidding and wallet funding open after approval.
        </p>
        <div className="panel mt-6 p-5">
          <KycUpload onDone={() => void refreshProfile()} />
        </div>
      </div>
    );
  }

  const available = Number(profile?.balance ?? 0) - Number(profile?.locked ?? 0);
  const approved = profile?.kyc_status === "approved";
  const data = activity.data;

  const lost = (data?.bids ?? [])
    .map((b: any) => b.listings)
    .filter(
      (l: any, i: number, arr: any[]) =>
        l && l.status === "sold" && arr.findIndex((x: any) => x?.id === l.id) === i,
    )
    .filter((l: any) => !(data?.won ?? []).some((w: any) => w.id === l.id));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">My dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bidder ID <span className="font-mono text-foreground">{profile?.alias}</span> ·{" "}
            {approved ? (
              <span className="text-success">Verified</span>
            ) : (
              <span className="text-primary">Pending verification</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Wallet balance" value={money(profile?.balance)} />
        <Stat label="Locked in bids" value={money(profile?.locked)} />
        <Stat label="Available to bid" value={money(available)} highlight />
      </div>

      {!approved && (
        <div className="panel mt-6 p-5">
          <h2 className="font-display text-lg">Finish identity verification</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Wallet funding, withdrawals and bidding unlock once our team approves your documents.
          </p>
          <div className="mt-4 max-w-md">
            <KycUpload />
          </div>
        </div>
      )}

      <Tabs defaultValue="deposits" className="mt-8">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="bids">My bids</TabsTrigger>
          <TabsTrigger value="won">Won</TabsTrigger>
          <TabsTrigger value="lost">Lost</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="mt-4 space-y-4">
          <div className="panel p-5">
            <h2 className="font-display text-lg">Fund your wallet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter an amount and Click Deposit— we'll show you the designated deposit address
              assigned to your account. Your balance updates automatically once the transaction is
              detected.
            </p>

            {!approved ? (
              <p className="mt-4 rounded-md border border-border bg-secondary p-4 text-sm text-muted-foreground">
                Wallet funding unlocks after our team approves your ID verification. Deposit addresses
                and QR codes are issued to approved accounts only.
              </p>
            ) : (
              <DepositFlow onChanged={() => { void activity.refetch(); void refreshProfile(); }} />
            )}
          </div>
          <HistoryTable
            title="Deposit history"
            rows={data?.deposits ?? []}
            columns={[
              { key: "created_at", label: "Date", format: (v) => dateTime(v) },
              { key: "amount", label: "Amount", format: (v) => money(v) },
              { key: "currency", label: "Asset" },
              { key: "status", label: "Status" },
            ]}
          />
        </TabsContent>


        <TabsContent value="withdrawals" className="mt-4 space-y-4">
          <div className="panel p-5">
            <h2 className="font-display text-lg">Request a withdrawal</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Withdrawals are processed immediately but may take 1-2 hours depending on the crypto
              network used. Only your available balance can be withdrawn.
            </p>
            <WithdrawForm
              available={available}
              onSaved={() => {
                void activity.refetch();
                void refreshProfile();
              }}
            />
          </div>
          <HistoryTable
            title="Withdrawal history"
            rows={data?.withdrawals ?? []}
            columns={[
              { key: "created_at", label: "Date", format: (v) => dateTime(v) },
              { key: "amount", label: "Amount", format: (v) => money(v) },
              { key: "destination", label: "Destination" },
              { key: "status", label: "Status" },
            ]}
          />
        </TabsContent>

        <TabsContent value="bids" className="mt-4">
          <div className="panel divide-y divide-border">
            {(data?.bids ?? []).length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">You haven't placed a bid yet.</p>
            )}
            {(data?.bids ?? []).map((bid: any) => (
              <Link
                key={bid.id}
                to="/auctions/$id"
                params={{ id: bid.listing_id }}
                className="flex items-center justify-between gap-4 p-4 hover:bg-secondary"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{bid.listings?.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {dateTime(bid.created_at)} · {bid.listings?.status}
                  </span>
                </span>
                <span className="font-display text-primary">{money(bid.amount)}</span>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="won" className="mt-4">
          <ListingList rows={data?.won ?? []} emptyText="No auctions won yet." showSold />
        </TabsContent>

        <TabsContent value="lost" className="mt-4">
          <ListingList rows={lost} emptyText="No lost auctions." showSold />
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <HistoryTable
            title="Wallet transactions"
            rows={data?.transactions ?? []}
            columns={[
              { key: "created_at", label: "Date", format: (v) => dateTime(v) },
              { key: "kind", label: "Type" },
              { key: "amount", label: "Amount", format: (v) => money(v) },
              { key: "description", label: "Details" },
            ]}
          />
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <ProfileForm />
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-4">
          <div className="panel space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Stay anonymous to other bidders</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your identity is verified with RVBID either way. When this is on, other bidders only
                  see your generated ID{" "}
                  <span className="font-mono text-foreground">{profile?.alias}</span>.
                </p>
              </div>
              <Switch
                checked={Boolean(profile?.is_anonymous)}
                onCheckedChange={async (checked) => {
                  await db.from("profiles").update({ is_anonymous: checked }).eq("id", user.id);
                  await refreshProfile();
                  toast.success(checked ? "You're anonymous to other bidders." : "Your name will show on new bids.");
                }}
              />
            </div>
          </div>
          <EmailForm />
          <PasswordForm />

        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="panel p-5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function DepositFlow({ onChanged }: { onChanged: () => void }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USDT");
  const [busy, setBusy] = useState(false);

  const intentQuery = useQuery({
    queryKey: ["deposit-intent", user?.id],
    enabled: Boolean(user),
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await db
        .from("deposit_intents")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1);
      return (data?.[0] ?? null) as any;
    },
  });

  const intent = intentQuery.data;
  const pending = intent && intent.status === "awaiting";

  // While a deposit is pending, ask the backend to check the chain for the transfer.
  useEffect(() => {
    if (!pending) return;
    let stop = false;
    const poll = async () => {
      try {
        await fetch("/api/public/deposit-watch", { method: "POST" });
      } catch {
        /* ignore */
      }
      if (stop) return;
      const before = intent?.status;
      const refreshed = await intentQuery.refetch();
      if (refreshed.data?.status === "credited" && before !== "credited") {
        toast.success("Deposit detected — your wallet has been credited.");
        onChanged();
      }
    };
    void poll();
    const timer = setInterval(poll, 25_000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, intent?.id]);

  if (pending) {
    return (
      <div className="mt-6 border-t border-border pt-5">
        <p className="text-sm font-semibold">
          Send {money(intent.amount)} in {intent.currency}
          {intent.network ? ` on ${intent.network}` : ""}
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          {intent.qr_url && (
            <img
              src={intent.qr_url}
              alt={`${intent.currency} deposit QR code`}
              className="size-40 rounded bg-secondary object-contain"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="break-all font-mono text-xs text-muted-foreground">{intent.address}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                void navigator.clipboard.writeText(intent.address);
                toast.success("Address copied.");
              }}
            >
              <Copy className="size-3.5" /> Copy address
            </Button>
            <p className="mt-4 flex items-center gap-2 text-sm text-primary">
              <Loader2 className="size-4 animate-spin" /> Watching the network for your transfer…
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Keep this page open if you like — crediting happens automatically, usually within a few
              minutes of network confirmation. Send only {intent.currency}
              {intent.network ? ` on ${intent.network}` : ""} to this address.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={async () => {
                await db.from("deposit_intents").update({ status: "expired" }).eq("id", intent.id);
                void intentQuery.refetch();
              }}
            >
              Cancel this deposit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!Number(amount)) {
          toast.error("Enter the amount you want to deposit.");
          return;
        }
        setBusy(true);
        const { error } = await db.rpc("create_deposit_intent", {
          _amount: Number(amount),
          _currency: currency,
        });
        setBusy(false);
        if (error) {
          toast.error(error.message.replace(/^.*?:\s*/, ""));
          return;
        }
        setAmount("");
        await intentQuery.refetch();
        toast.success("Deposit started — send the funds to the address shown.");
      }}
    >
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (USD)</Label>
        <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Asset</Label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {["USDT", "BTC", "ETH", "USDC"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={busy} className="w-full">
          <Send className="size-4" /> {busy ? "Starting…" : "Deposit"}
        </Button>
      </div>
    </form>
  );
}


function WithdrawForm({ available, onSaved }: { available: number; onSaved: () => void }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState("USDT");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-5 grid gap-3 sm:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = Number(amount);
        if (!value || value > available) {
          toast.error("Amount exceeds your available balance.");
          return;
        }
        if (!destination.trim()) {
          toast.error("Enter your withdrawal address.");
          return;
        }
        setBusy(true);
        const { error } = await db.from("withdrawals").insert({
          user_id: user!.id,
          amount: value,
          currency,
          destination: destination.trim(),
        });
        setBusy(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Withdrawal requested.");
        setAmount("");
        setDestination("");
        onSaved();
      }}
    >
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (USD)</Label>
        <Input type="number" min={0} max={available} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Asset</Label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {["USDT", "BTC", "ETH", "USDC"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Address</Label>
        <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
      </div>
      <Button type="submit" disabled={busy} className="sm:col-span-3">
        {busy ? "Submitting…" : "Request withdrawal"}
      </Button>
    </form>
  );
}

function ProfileForm() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    state: profile?.state ?? "",
    zip: profile?.zip ?? "",
  });
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="panel grid gap-3 p-5 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await db.from("profiles").update(form).eq("id", user!.id);
        setBusy(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        await refreshProfile();
        toast.success("Profile updated.");
      }}
    >
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full name</Label>
        <Input value={profile?.full_name ?? ""} disabled />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date of birth</Label>
        <Input value={profile?.dob ?? ""} disabled />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone</Label>
        <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Address</Label>
        <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">State</Label>
        <Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">ZIP</Label>
        <Input value={form.zip ?? ""} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
        <Input value={profile?.email ?? ""} disabled />
      </div>
      <p className="text-[11px] text-muted-foreground sm:col-span-2">
        Your legal name and date of birth are locked to your verified identity — contact support if
        they need to change.
      </p>

      <Button type="submit" disabled={busy} className="sm:col-span-2">
        {busy ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

function EmailForm() {
  const { user, profile, refreshProfile } = useAuth();
  const notify = useServerFn(notifyEmailChanged);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [current, setCurrent] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const previousEmail = user?.email ?? profile?.email ?? "";

  async function request(e: React.FormEvent) {
    e.preventDefault();
    const target = newEmail.trim().toLowerCase();
    if (!current) { toast.error("Enter your current password."); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) { toast.error("Enter a valid email address."); return; }
    if (target === previousEmail.toLowerCase()) { toast.error("That is already your login email."); return; }
    setBusy(true);
    // Re-authenticate so the current password must be correct.
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: previousEmail,
      password: current,
    });
    if (authError) {
      setBusy(false);
      toast.error("Your current password is incorrect.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: target });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setStep("verify");
    toast.success(`We sent a 6-digit code to ${target}.`);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    const target = newEmail.trim().toLowerCase();
    if (code.trim().length < 6) { toast.error("Enter the 6-digit code."); return; }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: target,
      token: code.trim(),
      type: "email_change",
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    // Keep the profile row in step with the login email. Nothing else on the
    // account (roles, KYC, wallet, bids, notifications) is touched.
    await db.from("profiles").update({ email: target }).eq("id", user!.id);
    try {
      await notify({ data: { previousEmail, newEmail: target } });
    } catch {
      // A failed courtesy notice must not undo a completed email change.
    }
    await refreshProfile();
    setBusy(false);
    setStep("form");
    setCurrent("");
    setNewEmail("");
    setCode("");
    toast.success("Your login email has been updated.");
  }

  if (step === "verify") {
    return (
      <form className="panel grid gap-3 p-5" onSubmit={confirm}>
        <h2 className="text-sm font-semibold">Verify your new email</h2>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code we sent to{" "}
          <span className="text-foreground">{newEmail.trim().toLowerCase()}</span>. Your login email
          only changes once this code is confirmed.
        </p>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        <Button type="submit" disabled={busy}>{busy ? "Verifying…" : "Confirm new email"}</Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => { setStep("form"); setCode(""); }}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <form className="panel grid gap-3 p-5" onSubmit={request}>
      <h2 className="text-sm font-semibold">Change email address</h2>
      <p className="text-sm text-muted-foreground">
        Current login email: <span className="text-foreground">{previousEmail}</span>
      </p>
      <Input
        type="password"
        autoComplete="current-password"
        placeholder="Current password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <Input
        type="email"
        autoComplete="email"
        placeholder="New email address"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
      />
      <Button type="submit" disabled={busy}>{busy ? "Sending code…" : "Send verification code"}</Button>
      <p className="text-[11px] text-muted-foreground">
        We'll email a code to the new address, and send a security notice to your old address once
        the change is confirmed. Your verification status, wallet, bids and history stay exactly as
        they are.
      </p>
    </form>
  );
}

function PasswordForm() {

  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel grid gap-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!current) {
          toast.error("Enter your current password.");
          return;
        }
        if (!passwordIsStrong(password)) {
          toast.error("Choose a stronger new password.");
          return;
        }
        if (password !== confirm) {
          toast.error("Your new passwords don't match.");
          return;
        }
        setBusy(true);
        // Re-authenticate first so the old password must be correct.
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user?.email ?? "",
          password: current,
        });
        if (authError) {
          setBusy(false);
          toast.error("Your current password is incorrect.");
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        setBusy(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        setCurrent("");
        setPassword("");
        setConfirm("");
        toast.success("Password updated.");
      }}
    >
      <h2 className="text-sm font-semibold">Change password</h2>
      <Input
        type="password"
        autoComplete="current-password"
        placeholder="Current password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <Input
        type="password"
        autoComplete="new-password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        type="password"
        autoComplete="new-password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <ul className="grid gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li
              key={rule.label}
              className={`text-[11px] ${ok ? "text-success" : "text-muted-foreground"}`}
            >
              {ok ? "✓" : "•"} {rule.label}
            </li>
          );
        })}
      </ul>
      <Button type="submit" variant="outline" disabled={busy}>
        {busy ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

type Column = { key: string; label: string; format?: (value: any) => string };

function HistoryTable({ title, rows, columns }: { title: string; rows: any[]; columns: Column[] }) {
  return (
    <div className="panel overflow-hidden">
      <h2 className="border-b border-border p-4 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-4 py-3">
                      {c.format ? c.format(row[c.key]) : (row[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ListingList({
  rows,
  emptyText,
  showSold,
}: {
  rows: any[];
  emptyText: string;
  showSold?: boolean;
}) {
  if (!rows.length) return <p className="panel p-5 text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="panel divide-y divide-border">
      {rows.map((row) => (
        <Link
          key={row.id}
          to="/auctions/$id"
          params={{ id: row.id }}
          className="flex items-center justify-between gap-4 p-4 hover:bg-secondary"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{row.title}</span>
            <span className="text-xs text-muted-foreground">{row.status}</span>
          </span>
          <span className="font-display text-primary">
            {money(showSold ? (row.sold_price ?? row.current_bid) : row.current_bid)}
          </span>
        </Link>
      ))}
    </div>
  );
}
