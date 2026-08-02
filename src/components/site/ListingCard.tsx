import { Link } from "@tanstack/react-router";
import { Gavel, MapPin } from "lucide-react";
import { Countdown } from "./Countdown";
import { listingImage, money, num, type Listing } from "@/lib/rvbid";

export function ListingCard({ listing }: { listing: Listing }) {
  const sold = listing.status === "sold";
  return (
    <Link
      to="/auctions/$id"
      params={{ id: listing.id }}
      className="panel group block overflow-hidden transition-transform hover:-translate-y-0.5"
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-secondary">
        <img
          src={listingImage(listing)}
          alt={listing.title}
          loading="lazy"
          width={1280}
          height={854}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 rounded-md bg-background/85 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">
          {sold ? (
            <span className="text-success">Sold</span>
          ) : (
            <span className="flex items-center gap-1.5 text-live">
              <span className="live-dot" aria-hidden /> Live
            </span>
          )}
        </div>
        {!sold && (
          <div className="absolute right-3 top-3 rounded-md bg-background/85 px-2 py-1 text-xs backdrop-blur">
            <Countdown endsAt={listing.ends_at} showLabel={false} />
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <h3 className="line-clamp-1 text-base font-semibold">{listing.title}</h3>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" /> {listing.location ?? "—"}
          <span className="mx-1">•</span>
          {listing.rv_class ?? "RV"}
        </p>
        <div className="flex items-end justify-between border-t border-border pt-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {sold ? "Sold for" : "Current bid"}
            </p>
            <p className="font-display text-xl text-primary">
              {money(sold ? listing.sold_price : listing.current_bid)}
            </p>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gavel className="size-3.5" /> {num(listing.bid_count)} bids
          </p>
        </div>
      </div>
    </Link>
  );
}
