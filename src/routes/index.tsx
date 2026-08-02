import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Gavel, ShieldCheck, Timer, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/site/ListingCard";
import {
  closeExpiredAuctions,
  db,
  LISTING_COLUMNS,
  num,
  type Listing,
} from "@/lib/rvbid";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RVBID — 12-Hour Used RV Auctions Starting at $0" },
      {
        name: "description",
        content:
          "Bid on used motorhomes, travel trailers and fifth wheels in 12-hour Fast Fingers auctions. Every listing opens at $0.",
      },
      { property: "og:title", content: "RVBID — Used RV Auctions From $0" },
      {
        property: "og:description",
        content: "10 live used RV auctions right now. 12-hour countdowns, wallet-backed bidding.",
      },
    ],
  }),
  component: Home,
});

function useHomeData() {
  return useQuery({
    queryKey: ["home"],
    refetchInterval: 30_000,
    queryFn: async () => {
      await closeExpiredAuctions();
      const [live, sold, settings] = await Promise.all([
        db
          .from("listings")
          .select(LISTING_COLUMNS)
          .eq("status", "live")
          .order("ends_at", { ascending: true })
          .limit(10),
        db
          .from("listings")
          .select(LISTING_COLUMNS)
          .eq("status", "sold")
          .order("sold_at", { ascending: false })
          .limit(10),
        db.from("site_settings").select("key,value"),
      ]);
      const stats: Record<string, string> = {};
      (settings.data ?? []).forEach((row: { key: string; value: string }) => {
        stats[row.key] = row.value;
      });
      return {
        live: (live.data ?? []) as Listing[],
        sold: (sold.data ?? []) as Listing[],
        stats,
      };
    },
  });
}

function Home() {
  const { data, isLoading, refetch } = useHomeData();

  useEffect(() => {
    const id = setInterval(() => void refetch(), 60_000);
    return () => clearInterval(id);
  }, [refetch]);

  const liveCount = data?.live.length ?? 0;
  const completed = data?.stats["completed_auctions"] ?? "118";
  const rvsSold = data?.stats["rvs_sold"] ?? "118";

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <img
          src="/images/rv-5.jpg"
          alt="Used diesel motorhome for auction on RVBID"
          width={1280}
          height={854}
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur">
            <span className="live-dot" aria-hidden /> 12-hour Fast Fingers auctions
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Used RVs that open at{" "}
            <span className="text-gradient-gold">$0</span> and close in 12 hours.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Every RVBID auction starts at zero. Fund your wallet, verify once, and bid against the
            clock — anonymously if you prefer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/auctions">
                <Gavel className="size-4" /> Browse live auctions
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth" search={{ mode: "signup" }}>
                Create your account
              </Link>
            </Button>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-3 sm:max-w-2xl sm:gap-4">
            {[
              { label: "Live auctions", value: num(liveCount) },
              { label: "Completed auctions", value: num(Number(completed)) },
              { label: "RVs sold", value: num(Number(rvsSold)) },
            ].map((stat) => (
              <div key={stat.label} className="panel px-4 py-4 text-center sm:px-6">
                <dd className="font-display text-2xl text-primary sm:text-4xl">{stat.value}</dd>
                <dt className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground sm:text-xs">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Section
        title="Live auctions"
        subtitle="Bidding closes when the countdown hits zero."
        action={{ to: "/auctions", label: "All live auctions" }}
      >
        <Grid listings={data?.live ?? []} loading={isLoading} />
      </Section>

      <Section
        title="Recently sold"
        subtitle="Real closing prices from the last 10 completed auctions."
        action={{ to: "/sold", label: "All sold RVs" }}
      >
        <Grid listings={data?.sold ?? []} loading={isLoading} />
      </Section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl sm:text-3xl">How RVBID works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Register & verify", body: "Sign up, upload your ID and a selfie. Our team approves your account." },
            { icon: Wallet, title: "Fund your wallet", body: "Deposit crypto to the address assigned to your account. Your balance is your bidding power." },
            { icon: Timer, title: "Bid the clock", body: "Auctions run 12 hours from $0. Your bid amount is locked until you're outbid or it closes." },
            { icon: Gavel, title: "Win & collect", body: "Highest bid at zero wins. The amount is deducted and we help arrange the handover." },
          ].map((step) => (
            <div key={step.title} className="panel p-5">
              <step.icon className="size-5 text-primary" />
              <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={action.to}>{action.label} →</Link>
        </Button>
      </div>
      {children}
    </section>
  );
}

function Grid({ listings, loading }: { listings: Listing[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="panel h-72 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!listings.length) {
    return <p className="text-sm text-muted-foreground">No auctions to show yet.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
