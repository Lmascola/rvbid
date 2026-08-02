import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gauge, Lock, MapPin, Ruler, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Countdown } from "@/components/site/Countdown";
import { useAuth } from "@/hooks/useAuth";
import {
  closeExpiredAuctions,
  db,
  LISTING_COLUMNS,
  money,
  num,
  type Bid,
  type Listing,
} from "@/lib/rvbid";

export const Route = createFileRoute("/auctions/$id")({
  head: () => ({
    meta: [
      { title: "Used RV Auction Detail | RVBID" },
      {
        name: "description",
        content:
          "Photos, specs, VIN and full bid history for this used RV auction on RVBID. Bidding opens at $0.",
      },
      { property: "og:title", content: "Used RV Auction | RVBID" },
      { property: "og:description", content: "Specs, photos and live bid history on RVBID." },
    ],
  }),
  component: AuctionDetail,
});

function AuctionDetail() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const [active, setActive] = useState(0);
  const [amount, setAmount] = useState("");
  const [vin, setVin] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const listingQuery = useQuery({
    queryKey: ["listing", id],
    refetchInterval: 15_000,
    queryFn: async () => {
      await closeExpiredAuctions();
      const [{ data: listing }, { data: bids }] = await Promise.all([
        db.from("listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle(),
        db.from("bids").select("*").eq("listing_id", id).order("amount", { ascending: false }),
      ]);
      return { listing: listing as Listing | null, bids: (bids ?? []) as Bid[] };
    },
  });

  const verified = profile?.kyc_status === "approved";

  useEffect(() => {
    if (!verified) {
      setVin(null);
      return;
    }
    db.rpc("get_listing_vin", { _listing_id: id }).then(({ data }: { data: string | null }) =>
      setVin(data ?? null),
    );
  }, [id, verified]);

  const listing = listingQuery.data?.listing;
  const bids = listingQuery.data?.bids ?? [];

  if (listingQuery.isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-16"><div className="panel h-96 animate-pulse" /></div>;
  }
  if (!listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl">Auction not found</h1>
        <Button className="mt-6" asChild><Link to="/auctions">Back to live auctions</Link></Button>
      </div>
    );
  }

  const sold = listing.status === "sold";
  const available = Number(profile?.balance ?? 0) - Number(profile?.locked ?? 0);

  async function placeBid() {
    const value = Number(amount);
    if (!value || value <= Number(listing!.current_bid)) {
      toast.error("Your bid must be higher than the current bid.");
      return;
    }
    setSubmitting(true);
    const { error } = await db.rpc("place_bid", { _listing_id: id, _amount: value });
    setSubmitting(false);
    if (error) {
      toast.error(error.message.replace(/^.*?:\s*/, ""));
      return;
    }
    toast.success(`Bid of ${money(value)} placed.`);
    setAmount("");
    void listingQuery.refetch();
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Link to="/auctions" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to auctions
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="panel overflow-hidden">
            <img
              src={listing.images?.[active] ?? "/images/rv-1.jpg"}
              alt={`${listing.title} photo ${active + 1}`}
              width={1280}
              height={854}
              className="aspect-[3/2] w-full object-cover"
            />
          </div>
          {listing.images?.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {listing.images.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`overflow-hidden rounded-md border ${
                    i === active ? "border-primary" : "border-border"
                  }`}
                >
                  <img src={src} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <h1 className="mt-8 font-display text-2xl sm:text-3xl">{listing.title}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><MapPin className="size-4" />{listing.location}</span>
            {listing.mileage ? (
              <span className="flex items-center gap-1.5"><Gauge className="size-4" />{num(listing.mileage)} mi</span>
            ) : null}
            {listing.sleeps ? (
              <span className="flex items-center gap-1.5"><Users className="size-4" />Sleeps {listing.sleeps}</span>
            ) : null}
            {listing.length_ft ? (
              <span className="flex items-center gap-1.5"><Ruler className="size-4" />{listing.length_ft} ft</span>
            ) : null}
          </div>

          <div className="panel mt-6 p-5">
            <h2 className="text-base font-semibold">Vehicle details</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Detail label="Year" value={listing.year ? String(listing.year) : "—"} />
              <Detail label="Make" value={listing.make ?? "—"} />
              <Detail label="Model" value={listing.model ?? "—"} />
              <Detail label="Class" value={listing.rv_class ?? "—"} />
              <Detail label="Condition" value="Used — sold as-is" />
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">VIN</dt>
                <dd className="mt-1 font-mono text-sm">
                  {vin ? (
                    vin
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="size-3.5" />
                      {listing.vin_masked}
                    </span>
                  )}
                </dd>
                {!vin && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Full VIN unlocks for verified members.{" "}
                    {!user && (
                      <Link to="/auth" search={{ mode: "signup" }} className="text-primary underline">
                        Sign up
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </dl>
            <p className="mt-5 whitespace-pre-line text-sm text-muted-foreground">
              {listing.description}
            </p>
          </div>

          <div className="panel mt-6 p-5">
            <h2 className="text-base font-semibold">
              Bid history <span className="text-muted-foreground">({num(bids.length || listing.bid_count)})</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Bidding opened at {money(listing.starting_bid)}. Members who chose anonymity appear as a
              generated ID such as X6521.
            </p>
            <div className="mt-4 divide-y divide-border">
              {bids.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  No bids yet — this auction is still sitting at {money(listing.current_bid)}.
                </p>
              )}
              {bids.map((bid, i) => (
                <div key={bid.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{bid.alias}</span>
                    {i === 0 && (
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {sold ? "Winner" : "High bid"}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      {new Date(bid.created_at).toLocaleString()}
                    </span>
                    <span className="font-display">{money(bid.amount)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="panel p-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {sold ? "Sold for" : "Current bid"}
            </p>
            <p className="font-display text-4xl text-primary">
              {money(sold ? listing.sold_price : listing.current_bid)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {num(listing.bid_count)} bids · opened at {money(listing.starting_bid)}
            </p>

            <div className="mt-5 flex items-center justify-between rounded-md bg-secondary px-3 py-3 text-sm">
              <span className="text-muted-foreground">{sold ? "Closed" : "Time left"}</span>
              {sold ? (
                <span className="font-display">
                  {listing.sold_at ? new Date(listing.sold_at).toLocaleDateString() : "—"}
                </span>
              ) : (
                <Countdown endsAt={listing.ends_at} />
              )}
            </div>

            {sold ? (
              <p className="mt-5 text-sm text-muted-foreground">
                Won by <span className="font-mono text-foreground">{listing.winner_alias ?? "—"}</span>
              </p>
            ) : !user ? (
              <div className="mt-5 space-y-3">
                <Button className="w-full" asChild>
                  <Link to="/auth" search={{ mode: "signup" }}>Create account to bid</Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/auth">Sign in</Link>
                </Button>
              </div>
            ) : !verified ? (
              <div className="mt-5 rounded-md border border-border bg-secondary p-4 text-sm">
                <p className="font-medium">Account pending verification</p>
                <p className="mt-1 text-muted-foreground">
                  Bidding unlocks once our team approves your ID and selfie.
                </p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link to="/dashboard">Go to dashboard</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Available to bid</span>
                  <span className="text-foreground">{money(available)}</span>
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder={`More than ${money(listing.current_bid)}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <Button className="w-full" disabled={submitting} onClick={placeBid}>
                  {submitting ? "Placing bid…" : "Place bid"}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  You can only bid up to your available wallet balance. Your bid is locked to this
                  auction until you're outbid or it closes.
                </p>
              </div>
            )}
          </div>

          <div className="panel mt-4 p-5 text-xs text-muted-foreground">
            All RVs are used and sold as-is without warranty. We describe every unit in good faith and
            our team will help assist with any issue that arises.
          </div>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
