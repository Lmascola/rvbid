import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/rvbid";

export const Route = createFileRoute("/legal/$slug")({
  head: () => ({
    meta: [
      { title: "Policies & Auction Rules | RVBID" },
      {
        name: "description",
        content:
          "RVBID terms of service, privacy policy, wallet policy, refund policy, auction rules and identity verification policy.",
      },
      { property: "og:title", content: "RVBID Policies" },
      { property: "og:description", content: "The rules that govern RVBID auctions and wallets." },
    ],
  }),
  component: LegalPage,
});

type LegalDoc = { slug: string; title: string; content: string };

function LegalPage() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["legal", slug],
    queryFn: async () => {
      const { data } = await db.from("legal_pages").select("*").eq("slug", slug).maybeSingle();
      return data as LegalDoc | null;
    },
  });

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16"><div className="panel h-96 animate-pulse" /></div>;
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl">Policy not found</h1>
      </div>
    );
  }

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl sm:text-4xl">{data.title}</h1>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        {data.content.split("\n").map((line, i) => {
          const text = line.trim();
          if (!text) return null;
          if (text.startsWith("## ")) {
            return (
              <h2 key={i} className="pt-4 font-display text-lg text-foreground">
                {text.replace("## ", "")}
              </h2>
            );
          }
          if (text.startsWith("# ")) return null;
          return <p key={i}>{text}</p>;
        })}
      </div>
    </article>
  );
}
