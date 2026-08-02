import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ListingCard } from "@/components/site/ListingCard";
import { closeExpiredAuctions, db, LISTING_COLUMNS, type Listing } from "@/lib/rvbid";

export const Route = createFileRoute("/auctions/")({
  head: () => ({
    meta: [
      { title: "Live Used RV Auctions | RVBID" },
      {
        name: "description",
        content: "Every live used RV auction on RVBID. 12-hour countdowns, bidding opens at $0.",
      },
      { property: "og:title", content: "Live Used RV Auctions | RVBID" },
      { property: "og:description", content: "12-hour used RV auctions, all starting at $0." },
    ],
  }),
  component: LiveAuctions,
});

function LiveAuctions() {
  const { data, isLoading } = useQuery({
    queryKey: ["auctions", "live"],
    refetchInterval: 30_000,
    queryFn: async () => {
      await closeExpiredAuctions();
      const { data } = await db
        .from("listings")
        .select(LISTING_COLUMNS)
        .eq("status", "live")
        .order("ends_at", { ascending: true });
      return (data ?? []) as Listing[];
    },
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl sm:text-4xl">Live auctions</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Bidding closes the moment each countdown hits zero. All RVs are used and sold as-is.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="panel h-72 animate-pulse" />)
          : (data ?? []).map((listing) => <ListingCard key={listing.id} listing={listing} />)}
      </div>
    </div>
  );
}
