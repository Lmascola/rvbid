import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { ClaimAdminBanner, useAdminClaimStatus } from "@/components/site/ClaimAdminBanner";

import { db, money } from "@/lib/rvbid";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Team Back Office | RVBID" },
      {
        name: "description",
        content:
          "RVBID team back office: manage members, verification, auctions, bids, wallets and site content.",
      },
      { property: "og:title", content: "RVBID Team Back Office" },
      { property: "og:description", content: "Internal tools for the RVBID team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const MAX_PHOTOS = 40;
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5; // 5 years

const EMPTY_LISTING = {
  id: "",
  title: "",
  year: "",
  make: "",
  model: "",
  vin: "",
  mileage: "",
  sleeps: "",
  length_ft: "",
  rv_class: "",
  location: "",
  description: "",
  images: [] as string[],
  starting_bid: "0",
  current_bid: "0",
  bid_count: "0",
  status: "live",
  ends_at: "",
  queue_order: "0",
  report_available: true,
  report_price: "39.00",
  report_url: "",
  bid_visibility: "all",
};

type ListingForm = typeof EMPTY_LISTING;

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16"><div className="panel h-72 animate-pulse" /></div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl">Team sign-in required</h1>
        <Button className="mt-6" asChild><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  if (!isAdmin) {
    return <NoTeamAccess />;
  }


  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl">Team back office</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything members see on RVBID is managed from here.
      </p>

      <Tabs defaultValue="listings" className="mt-8">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="bids">Bids</TabsTrigger>
          <TabsTrigger value="members">Members &amp; KYC</TabsTrigger>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="crypto">Crypto addresses</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-4"><ListingsPanel /></TabsContent>
        <TabsContent value="bids" className="mt-4"><BidsPanel /></TabsContent>
        <TabsContent value="members" className="mt-4"><MembersPanel /></TabsContent>
        <TabsContent value="wallets" className="mt-4"><WalletsPanel /></TabsContent>
        <TabsContent value="crypto" className="mt-4"><CryptoPanel /></TabsContent>
        <TabsContent value="content" className="mt-4"><ContentPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function NoTeamAccess() {
  const { data, isLoading } = useAdminClaimStatus();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-2xl">Team access only</h1>
      {isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Checking platform ownership…</p>
      ) : data && !data.admin_exists && data.eligible ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            No administrator exists yet. This signed-in account can claim ownership below — or use
            the Claim Admin banner at the top of any page.
          </p>
          <div className="mt-6 overflow-hidden rounded-lg">
            <ClaimAdminBanner />
          </div>
        </>
      ) : data && !data.admin_exists ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No administrator exists yet. Refresh the page, then use the Claim Admin option.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          This account doesn't have team permissions. Ask an existing team member to grant you
          access.
        </p>
      )}
      <Button variant="outline" className="mt-6" asChild>
        <Link to="/dashboard">Back to my dashboard</Link>
      </Button>
    </div>
  );
}

function useListings() {

  return useQuery({
    queryKey: ["admin-listings"],
    queryFn: async () => {
      const { data, error } = await db.rpc("admin_listings");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/* --------------------------------- Listings -------------------------------- */

function ListingsPanel() {
  const listings = useListings();
  const [form, setForm] = useState<ListingForm | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold">All listings ({listings.data?.length ?? 0})</h2>
          <Button size="sm" onClick={() => setForm({ ...EMPTY_LISTING })}>
            <Plus className="size-4" /> New
          </Button>
        </div>
        <div className="max-h-[70vh] divide-y divide-border overflow-y-auto">
          {(listings.data ?? []).map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() =>
                setForm({
                  ...EMPTY_LISTING,
                  ...l,
                  year: l.year ?? "",
                  mileage: l.mileage ?? "",
                  sleeps: l.sleeps ?? "",
                  length_ft: l.length_ft ?? "",
                  starting_bid: String(l.starting_bid ?? 0),
                  current_bid: String(l.current_bid ?? 0),
                  bid_count: String(l.bid_count ?? 0),
                  queue_order: String(l.queue_order ?? 0),
                  report_price: String(l.report_price ?? "39.00"),
                  report_url: l.report_url ?? "",
                  ends_at: l.ends_at ? new Date(l.ends_at).toISOString().slice(0, 16) : "",
                  images: l.images ?? [],
                  description: l.description ?? "",
                })
              }
              className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-secondary"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">{l.title}</span>
                <span className="text-xs text-muted-foreground">
                  {l.status} · {l.images?.length ?? 0} photos · {l.bid_count} bids
                </span>
              </span>
              <span className="font-display text-sm text-primary">{money(l.current_bid)}</span>
            </button>
          ))}
        </div>
      </div>

      {form ? (
        <ListingEditor
          key={form.id || "new"}
          form={form}
          setForm={setForm as (f: ListingForm) => void}
          onSaved={() => { void listings.refetch(); }}
          onClose={() => setForm(null)}
        />
      ) : (
        <div className="panel p-5 text-sm text-muted-foreground">
          Select a listing to edit it, or press New to create one.
        </div>
      )}
    </div>
  );
}

function ListingEditor({
  form,
  setForm,
  onSaved,
  onClose,
}: {
  form: ListingForm;
  setForm: (f: ListingForm) => void;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (key: keyof ListingForm, value: any) => setForm({ ...form, [key]: value });

  async function uploadPhotos(files: FileList) {
    const room = MAX_PHOTOS - form.images.length;
    if (room <= 0) { toast.error(`Maximum ${MAX_PHOTOS} photos per listing.`); return; }
    const chosen = Array.from(files).slice(0, room);
    setUploading(true);
    const urls: string[] = [];
    for (const file of chosen) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `listings/${form.id || "new"}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("rv-photos").upload(path, file, { upsert: true });
      if (error) { toast.error(error.message); continue; }
      const { data } = await supabase.storage.from("rv-photos").createSignedUrl(path, SIGNED_URL_TTL);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    setUploading(false);
    setForm({ ...form, images: [...form.images, ...urls] });
    toast.success(`${urls.length} photo(s) added. Remember to save.`);
  }

  async function save() {
    if (!form.title.trim()) { toast.error("Give the listing a title."); return; }
    setBusy(true);
    const payload: Record<string, any> = {
      title: form.title.trim(),
      year: form.year === "" ? null : Number(form.year),
      make: form.make,
      model: form.model,
      vin: form.vin.trim(),
      mileage: form.mileage === "" ? null : Number(form.mileage),
      sleeps: form.sleeps === "" ? null : Number(form.sleeps),
      length_ft: form.length_ft === "" ? null : Number(form.length_ft),
      rv_class: form.rv_class,
      location: form.location,
      description: form.description,
      images: form.images,
      starting_bid: Number(form.starting_bid || 0),
      current_bid: Number(form.current_bid || 0),
      bid_count: Number(form.bid_count || 0),
      status: form.status,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      queue_order: Number(form.queue_order || 0),
      report_available: form.report_available,
      report_price: Number(form.report_price || 0),
      report_url: form.report_url,
      bid_visibility: form.bid_visibility,
      updated_at: new Date().toISOString(),
    };
    const { error } = form.id
      ? await db.from("listings").update(payload).eq("id", form.id)
      : await db.from("listings").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Listing updated." : "Listing created.");
    onSaved();
    if (!form.id) onClose();
  }

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{form.id ? "Edit listing" : "New listing"}</h2>
        <div className="flex gap-2">
          {form.id && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (!confirm("Delete this listing and its bids?")) return;
                const { error } = await db.from("listings").delete().eq("id", form.id);
                if (error) { toast.error(error.message); return; }
                toast.success("Listing deleted.");
                onSaved();
                onClose();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Title" span><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></F>
        <F label="Year"><Input value={form.year} onChange={(e) => set("year", e.target.value)} /></F>
        <F label="Make"><Input value={form.make} onChange={(e) => set("make", e.target.value)} /></F>
        <F label="Model"><Input value={form.model} onChange={(e) => set("model", e.target.value)} /></F>
        <F label="VIN (full — masked publicly)"><Input value={form.vin} onChange={(e) => set("vin", e.target.value)} /></F>
        <F label="Mileage"><Input value={form.mileage} onChange={(e) => set("mileage", e.target.value)} /></F>
        <F label="Sleeps"><Input value={form.sleeps} onChange={(e) => set("sleeps", e.target.value)} /></F>
        <F label="Length (ft)"><Input value={form.length_ft} onChange={(e) => set("length_ft", e.target.value)} /></F>
        <F label="Class"><Input value={form.rv_class} onChange={(e) => set("rv_class", e.target.value)} /></F>
        <F label="Location" span><Input value={form.location} onChange={(e) => set("location", e.target.value)} /></F>
        <F label="Description" span>
          <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </F>
        <F label="Starting bid"><Input value={form.starting_bid} onChange={(e) => set("starting_bid", e.target.value)} /></F>
        <F label="Current bid"><Input value={form.current_bid} onChange={(e) => set("current_bid", e.target.value)} /></F>
        <F label="Bid count"><Input value={form.bid_count} onChange={(e) => set("bid_count", e.target.value)} /></F>
        <F label="Queue order"><Input value={form.queue_order} onChange={(e) => set("queue_order", e.target.value)} /></F>
        <F label="Status">
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {["live", "queued", "sold", "draft"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </F>
        <F label="Ends at">
          <Input type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
        </F>
        <F label="Visible bidders (sold listings)">
          <select
            value={form.bid_visibility}
            onChange={(e) => set("bid_visibility", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Show every bidder</option>
            <option value="winner_only">Winning bid only</option>
            <option value="hidden">Hide bid history</option>
          </select>
        </F>
        <F label="Report price"><Input value={form.report_price} onChange={(e) => set("report_price", e.target.value)} /></F>
        <F label="Report file / link (optional)" span>
          <Input value={form.report_url} onChange={(e) => set("report_url", e.target.value)} placeholder="https://…" />
        </F>
        <div className="flex items-center justify-between sm:col-span-2">
          <span className="text-sm">Offer paid vehicle history report with VIN</span>
          <Switch checked={form.report_available} onCheckedChange={(v) => set("report_available", v)} />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Photos ({form.images.length}/{MAX_PHOTOS})
          </Label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs">
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Upload photos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && void uploadPhotos(e.target.files)}
            />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {form.images.map((src, i) => (
            <div key={`${src}-${i}`} className="relative overflow-hidden rounded-md border border-border">
              <img src={src} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setForm({ ...form, images: form.images.filter((_, x) => x !== i) })}
                className="absolute right-1 top-1 rounded bg-background/80 p-1"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Button className="w-full" disabled={busy} onClick={save}>
        {busy ? "Saving…" : form.id ? "Save listing" : "Create listing"}
      </Button>
    </div>
  );
}

/* ----------------------------------- Bids ---------------------------------- */

function BidsPanel() {
  const listings = useListings();
  const [listingId, setListingId] = useState("");
  const [amount, setAmount] = useState("");
  const [alias, setAlias] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);

  const bids = useQuery({
    queryKey: ["admin-bids", listingId],
    enabled: Boolean(listingId),
    queryFn: async () => {
      const { data } = await db
        .from("bids")
        .select("*")
        .eq("listing_id", listingId)
        .order("amount", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const selected = useMemo(
    () => (listings.data ?? []).find((l) => l.id === listingId),
    [listings.data, listingId],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel space-y-3 p-5">
        <h2 className="text-sm font-semibold">Add a bid</h2>
        <F label="Listing">
          <select
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select a listing</option>
            {(listings.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.title} — {l.status}</option>
            ))}
          </select>
        </F>
        {selected && (
          <p className="text-xs text-muted-foreground">
            Current bid {money(selected.current_bid)} · {selected.bid_count} bids · opened at{" "}
            {money(selected.starting_bid)}
          </p>
        )}
        <F label="Amount"><Input value={amount} onChange={(e) => setAmount(e.target.value)} /></F>
        <div className="flex items-center justify-between">
          <span className="text-sm">
            Post anonymously <span className="text-muted-foreground">(generated tag)</span>
          </span>
          <Switch checked={anonymous} onCheckedChange={setAnonymous} />
        </div>
        {!anonymous && (
          <F label="Real name shown publicly">
            <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. Marcus D." />
          </F>
        )}
        <Button
          disabled={busy}
          onClick={async () => {
            if (!listingId || !Number(amount)) { toast.error("Pick a listing and amount."); return; }
            if (!anonymous && !alias.trim()) { toast.error("Enter the bidder's real name."); return; }
            setBusy(true);
            const { data, error } = await db.rpc("admin_place_bid", {
              _listing_id: listingId,
              _amount: Number(amount),
              _alias: anonymous ? null : alias.trim(),
            });
            setBusy(false);
            if (error) { toast.error(error.message.replace(/^.*?:\s*/, "")); return; }
            toast.success(`Bid posted as ${data?.alias ?? "anonymous tag"}.`);
            setAmount("");
            setAlias("");
            void bids.refetch();
            void listings.refetch();
          }}
        >
          Post bid
        </Button>
      </div>

      <div className="panel overflow-hidden">
        <h2 className="border-b border-border p-4 text-sm font-semibold">Bid history</h2>
        {!listingId ? (
          <p className="p-4 text-sm text-muted-foreground">Select a listing to see its bids.</p>
        ) : (
          <div className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {(bids.data ?? []).length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No bids yet.</p>
            )}
            {(bids.data ?? []).map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>
                  <span className="font-mono">{b.alias}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{b.source}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-display">{money(b.amount)}</span>
                  <button
                    type="button"
                    aria-label="Delete bid"
                    onClick={async () => {
                      const { error } = await db.from("bids").delete().eq("id", b.id);
                      if (error) { toast.error(error.message); return; }
                      void bids.refetch();
                    }}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Members --------------------------------- */

function MembersPanel() {
  const [email, setEmail] = useState("");
  const members = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data } = await db.from("profiles").select("*").order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  async function patch(id: string, values: Record<string, any>) {
    const { error } = await db.from("profiles").update(values).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Member updated.");
    void members.refetch();
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-56 flex-1">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Grant team access by email
          </Label>
          <Input className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            const { error } = await db.rpc("grant_admin_by_email", { _email: email.trim() });
            if (error) { toast.error(error.message.replace(/^.*?:\s*/, "")); return; }
            toast.success("Team access granted.");
            setEmail("");
          }}
        >
          Grant access
        </Button>
      </div>

      <div className="panel divide-y divide-border">
        {(members.data ?? []).map((m) => (
          <div key={m.id} className="grid gap-3 p-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {m.full_name || `${m.first_name} ${m.last_name}`.trim() || "Unnamed member"}{" "}
                <span className="font-mono text-xs text-muted-foreground">{m.alias}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {m.email} · {m.phone} · {m.state} {m.zip} · KYC {m.kyc_status}
              </p>
              <div className="mt-1 flex gap-3 text-xs">
                {["kyc_id_url", "kyc_selfie_url"].map((key) =>
                  m[key] ? (
                    <button
                      key={key}
                      type="button"
                      className="text-primary underline"
                      onClick={async () => {
                        const { data } = await supabase.storage
                          .from("kyc-documents")
                          .createSignedUrl(m[key], 300);
                        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                      }}
                    >
                      View {key === "kyc_id_url" ? "ID" : "selfie"}
                    </button>
                  ) : null,
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Balance {money(m.balance)} · locked {money(m.locked)}
              <div className="mt-2 flex gap-2">
                <Input
                  className="h-8"
                  placeholder="Set balance"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const value = Number((e.target as HTMLInputElement).value);
                    if (Number.isNaN(value)) return;
                    void patch(m.id, { balance: value });
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => patch(m.id, { kyc_status: "approved" })}>
                Approve
              </Button>
              <Button size="sm" variant="ghost" onClick={() => patch(m.id, { kyc_status: "rejected" })}>
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- Wallets --------------------------------- */

function WalletsPanel() {
  const data = useQuery({
    queryKey: ["admin-wallets"],
    queryFn: async () => {
      const [intents, withdrawals, deposits] = await Promise.all([
        db.from("deposit_intents").select("*").order("created_at", { ascending: false }).limit(100),
        db.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(100),
        db.from("deposits").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      return {
        intents: intents.data ?? [],
        withdrawals: withdrawals.data ?? [],
        deposits: deposits.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-4">
      <div className="panel overflow-hidden">
        <h2 className="border-b border-border p-4 text-sm font-semibold">
          Deposits in progress (auto-detected on-chain)
        </h2>
        <div className="divide-y divide-border">
          {(data.data?.intents ?? []).map((i: any) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span>
                {money(i.amount)} {i.currency} {i.network && `· ${i.network}`}
                <span className="ml-2 text-xs text-muted-foreground">{i.status}</span>
                <span className="block break-all font-mono text-[11px] text-muted-foreground">
                  {i.address}
                </span>
              </span>
              {i.status === "awaiting" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const { error } = await db.rpc("credit_deposit_intent", {
                      _intent_id: i.id,
                      _tx: "manual-team-confirmation",
                      _amount: i.amount,
                    });
                    if (error) { toast.error(error.message.replace(/^.*?:\s*/, "")); return; }
                    toast.success("Deposit credited.");
                    void data.refetch();
                  }}
                >
                  Credit manually
                </Button>
              )}
            </div>
          ))}
          {(data.data?.intents ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No deposits yet.</p>
          )}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <h2 className="border-b border-border p-4 text-sm font-semibold">Withdrawal requests</h2>
        <div className="divide-y divide-border">
          {(data.data?.withdrawals ?? []).map((w: any) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span>
                {money(w.amount)} {w.currency} → <span className="font-mono text-xs">{w.destination}</span>
                <span className="ml-2 text-xs text-muted-foreground">{w.status}</span>
              </span>
              {w.status === "pending" && (
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const { data: p } = await db.from("profiles").select("balance").eq("id", w.user_id).maybeSingle();
                      await db.from("profiles").update({ balance: Math.max(Number(p?.balance ?? 0) - Number(w.amount), 0) }).eq("id", w.user_id);
                      await db.from("transactions").insert({
                        user_id: w.user_id, kind: "withdrawal", amount: -Number(w.amount),
                        description: `${w.currency} withdrawal sent`,
                      });
                      await db.from("withdrawals").update({ status: "sent" }).eq("id", w.id);
                      toast.success("Withdrawal marked as sent.");
                      void data.refetch();
                    }}
                  >
                    Mark sent
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await db.from("withdrawals").update({ status: "rejected" }).eq("id", w.id);
                      void data.refetch();
                    }}
                  >
                    Reject
                  </Button>
                </span>
              )}
            </div>
          ))}
          {(data.data?.withdrawals ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No withdrawal requests.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Crypto --------------------------------- */

function CryptoPanel() {
  const [form, setForm] = useState({ currency: "USDT", network: "TRC20", address: "", qr_url: "" });
  const [uploading, setUploading] = useState(false);
  const addresses = useQuery({
    queryKey: ["admin-addresses"],
    queryFn: async () => {
      const { data } = await db.from("deposit_addresses").select("*").order("created_at");
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel space-y-3 p-5">
        <h2 className="text-sm font-semibold">Add a deposit address</h2>
        <p className="text-xs text-muted-foreground">
          Verified, approved members are given these addresses automatically when they start a deposit.
        </p>
        <F label="Asset">
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {["USDT", "USDC", "BTC", "ETH"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </F>
        <F label="Network"><Input value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} /></F>
        <F label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">QR code image</Label>
          <label className="mt-1.5 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Upload QR
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const path = `qr/${crypto.randomUUID()}-${file.name}`;
                const { error } = await supabase.storage.from("rv-photos").upload(path, file, { upsert: true });
                if (!error) {
                  const { data } = await supabase.storage.from("rv-photos").createSignedUrl(path, SIGNED_URL_TTL);
                  if (data?.signedUrl) setForm((f) => ({ ...f, qr_url: data.signedUrl }));
                } else {
                  toast.error(error.message);
                }
                setUploading(false);
              }}
            />
          </label>
          {form.qr_url && <img src={form.qr_url} alt="QR preview" className="mt-3 size-28 object-contain" />}
        </div>
        <Button
          onClick={async () => {
            if (!form.address.trim()) { toast.error("Paste the wallet address."); return; }
            const { error } = await db.from("deposit_addresses").insert({ ...form, active: true });
            if (error) { toast.error(error.message); return; }
            toast.success("Deposit address saved.");
            setForm({ currency: "USDT", network: "TRC20", address: "", qr_url: "" });
            void addresses.refetch();
          }}
        >
          Save address
        </Button>
      </div>

      <div className="panel divide-y divide-border">
        {(addresses.data ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 p-4 text-sm">
            <span className="min-w-0">
              <span className="font-semibold">{a.currency} · {a.network}</span>
              <span className="block break-all font-mono text-[11px] text-muted-foreground">{a.address}</span>
            </span>
            <span className="flex items-center gap-2">
              <Switch
                checked={a.active}
                onCheckedChange={async (v) => {
                  await db.from("deposit_addresses").update({ active: v }).eq("id", a.id);
                  void addresses.refetch();
                }}
              />
              <button
                type="button"
                aria-label="Delete address"
                onClick={async () => {
                  await db.from("deposit_addresses").delete().eq("id", a.id);
                  void addresses.refetch();
                }}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </button>
            </span>
          </div>
        ))}
        {(addresses.data ?? []).length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No addresses configured yet.</p>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Content --------------------------------- */

function ContentPanel() {
  const content = useQuery({
    queryKey: ["admin-content"],
    queryFn: async () => {
      const [settings, legal, faqs] = await Promise.all([
        db.from("site_settings").select("*").order("key"),
        db.from("legal_pages").select("*").order("sort_order"),
        db.from("faqs").select("*").order("sort_order"),
      ]);
      return { settings: settings.data ?? [], legal: legal.data ?? [], faqs: faqs.data ?? [] };
    },
  });

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <h2 className="text-sm font-semibold">Homepage stats &amp; settings</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(content.data?.settings ?? []).map((s: any) => (
            <div key={s.key} className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{s.key}</Label>
              <Input
                defaultValue={s.value}
                onBlur={async (e) => {
                  if (e.target.value === s.value) return;
                  await db.from("site_settings").update({ value: e.target.value }).eq("key", s.key);
                  toast.success(`${s.key} updated.`);
                  void content.refetch();
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="text-sm font-semibold">Legal pages</h2>
        <div className="mt-3 space-y-4">
          {(content.data?.legal ?? []).map((p: any) => (
            <div key={p.slug} className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {p.title} (/{p.slug})
              </Label>
              <Textarea
                rows={5}
                defaultValue={p.content}
                onBlur={async (e) => {
                  if (e.target.value === p.content) return;
                  await db.from("legal_pages").update({ content: e.target.value }).eq("slug", p.slug);
                  toast.success("Page saved.");
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="text-sm font-semibold">FAQs</h2>
        <div className="mt-3 space-y-4">
          {(content.data?.faqs ?? []).map((f: any) => (
            <div key={f.id} className="space-y-2 border-b border-border pb-4">
              <Input
                defaultValue={f.question}
                onBlur={async (e) => {
                  if (e.target.value === f.question) return;
                  await db.from("faqs").update({ question: e.target.value }).eq("id", f.id);
                  toast.success("FAQ saved.");
                }}
              />
              <Textarea
                rows={3}
                defaultValue={f.answer}
                onBlur={async (e) => {
                  if (e.target.value === f.answer) return;
                  await db.from("faqs").update({ answer: e.target.value }).eq("id", f.id);
                  toast.success("FAQ saved.");
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await db.from("faqs").delete().eq("id", f.id);
                  void content.refetch();
                }}
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await db.from("faqs").insert({
                question: "New question",
                answer: "Answer",
                sort_order: (content.data?.faqs?.length ?? 0) + 1,
              });
              void content.refetch();
            }}
          >
            <Plus className="size-4" /> Add FAQ
          </Button>
        </div>
      </div>
    </div>
  );
}

function F({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={`space-y-1.5 ${span ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
