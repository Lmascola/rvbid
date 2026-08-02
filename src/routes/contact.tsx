import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { db } from "@/lib/rvbid";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact RVBID Support" },
      {
        name: "description",
        content:
          "Reach the RVBID support team about auctions, wallet deposits, withdrawals or account verification.",
      },
      { property: "og:title", content: "Contact RVBID Support" },
      { property: "og:description", content: "Email the RVBID team for auction and wallet help." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data } = useQuery({
    queryKey: ["settings", "support_email"],
    queryFn: async () => {
      const { data } = await db
        .from("site_settings")
        .select("value")
        .eq("key", "support_email")
        .maybeSingle();
      return (data?.value as string) ?? "support@rvbid.com";
    },
  });

  const email = data ?? "support@rvbid.com";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl sm:text-4xl">Contact support</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Our team handles verification reviews, deposits, withdrawals and anything that comes up after
        an auction closes. All RVs are sold as-is, and we will help assist with any issue that arises.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="panel p-5">
          <Mail className="size-5 text-primary" />
          <h2 className="mt-3 text-sm font-semibold">Email</h2>
          <a href={`mailto:${email}`} className="mt-1 block text-sm text-primary underline">
            {email}
          </a>
        </div>
        <div className="panel p-5">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="mt-3 text-sm font-semibold">Verification</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ID reviews are usually completed within one business day.
          </p>
        </div>
        <div className="panel p-5">
          <MessageSquare className="size-5 text-primary" />
          <h2 className="mt-3 text-sm font-semibold">Auction disputes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact us within 7 days of an auction closing.
          </p>
        </div>
      </div>
    </div>
  );
}
