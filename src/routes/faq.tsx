import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { db } from "@/lib/rvbid";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Bidding, Wallets & Verification | RVBID" },
      {
        name: "description",
        content:
          "Answers about RVBID's 12-hour auctions, $0 starting bids, wallet funding, anonymity and VIN access.",
      },
      { property: "og:title", content: "RVBID FAQ" },
      { property: "og:description", content: "How RVBID auctions, wallets and verification work." },
    ],
  }),
  component: FaqPage,
});

type Faq = { id: string; question: string; answer: string };

function FaqPage() {
  const { data } = useQuery({
    queryKey: ["faqs"],
    queryFn: async () => {
      const { data } = await db.from("faqs").select("*").order("sort_order");
      return (data ?? []) as Faq[];
    },
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl sm:text-4xl">Frequently asked questions</h1>
      <Accordion type="single" collapsible className="mt-8">
        {(data ?? []).map((faq) => (
          <AccordionItem key={faq.id} value={faq.id}>
            <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
