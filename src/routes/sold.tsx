import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ListingCard } from "@/components/site/ListingCard";
import { db, LISTING_COLUMNS, type Listing } from "@/lib/rvbid";

export const Route = createFileRoute("/sold")({
  head: () => ({
    meta: [
      { title: "Recently Sold RVs | RVBID" },
      {
        name: "description",
        content: "Closing prices and bid counts from recently completed used RV auctions on RVBID.",
      },
      { property: "og:title", content: "Recently Sold RVs | RVBID" },
      { property: "og:description", content: "See what used RVs actually sold for on RVBID." },
    ],
  }),
  component: SoldPage,
});

function SoldPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["auctions", "sold"],
    queryFn: async () => {
      const { data } = await db
        .from("listings")
        .select(LISTING_COLUMNS)
        .eq("status", "sold")
        .order("sold_at", { ascending: false })
        .limit(60);
      return (data ?? []) as Listing[];
    },
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl sm:text-4xl">Recently sold</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every closed auction shows the winning price, the number of bids and the bidder ID that won.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="panel h-72 animate-pulse" />)
          : (data ?? []).map((listing) => <ListingCard key={listing.id} listing={listing} />)}
      </div>
    </div>
  );
}
