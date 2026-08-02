import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KycUpload } from "@/components/site/KycUpload";
import { useAuth } from "@/hooks/useAuth";
import { db, money } from "@/lib/rvbid";

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
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
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
              Send only the listed asset on the listed network, then tell us the transaction hash so we
              can credit your balance.
            </p>
            {(data?.addresses ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Your deposit address is being assigned. Contact support if it doesn't appear shortly.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(data?.addresses ?? []).map((addr: any) => (
                  <div key={addr.id} className="rounded-lg border border-border p-4">
                    <p className="text-sm font-semibold">
                      {addr.currency} {addr.network ? `· ${addr.network}` : ""}
                    </p>
                    {addr.qr_url && (
                      <img
                        src={addr.qr_url}
                        alt={`${addr.currency} deposit QR code`}
                        className="mt-3 size-36 rounded bg-secondary object-contain"
                      />
                    )}
                    <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
                      {addr.address}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        void navigator.clipboard.writeText(addr.address);
                        toast.success("Address copied.");
                      }}
                    >
                      <Copy className="size-3.5" /> Copy
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <DepositForm onSaved={() => void activity.refetch()} />
          </div>
          <HistoryTable
            title="Deposit history"
            rows={data?.deposits ?? []}
            columns={[
              { key: "created_at", label: "Date", format: (v) => new Date(v).toLocaleString() },
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
              { key: "created_at", label: "Date", format: (v) => new Date(v).toLocaleString() },
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
                    {new Date(bid.created_at).toLocaleString()} · {bid.listings?.status}
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
              { key: "created_at", label: "Date", format: (v) => new Date(v).toLocaleString() },
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

function DepositForm({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USDT");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!Number(amount)) {
          toast.error("Enter the amount you sent.");
          return;
        }
        setBusy(true);
        const { error } = await db.from("deposits").insert({
          user_id: user!.id,
          amount: Number(amount),
          currency,
          tx_hash: hash,
        });
        setBusy(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Deposit submitted for verification.");
        setAmount("");
        setHash("");
        onSaved();
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
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Transaction hash
        </Label>
        <Input value={hash} onChange={(e) => setHash(e.target.value)} />
      </div>
      <Button type="submit" disabled={busy} className="sm:col-span-4">
        {busy ? "Submitting…" : "Notify us of my deposit"}
      </Button>
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
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    state: profile?.state ?? "",
    zip: profile?.zip ?? "",
    dob: profile?.dob ?? "",
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
        <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date of birth</Label>
        <Input type="date" value={form.dob ?? ""} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone</Label>
        <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
      <Button type="submit" disabled={busy} className="sm:col-span-2">
        {busy ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

function PasswordForm() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel grid gap-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 8) {
          toast.error("Use at least 8 characters.");
          return;
        }
        setBusy(true);
        const { error } = await supabase.auth.updateUser({ password });
        setBusy(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        setPassword("");
        toast.success("Password updated.");
      }}
    >
      <h2 className="text-sm font-semibold">Change password</h2>
      <Input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
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
