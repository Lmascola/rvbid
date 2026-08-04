import { Link } from "@tanstack/react-router";

const LEGAL = [
  { slug: "terms", label: "Terms of Service" },
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "wallet", label: "Wallet Policy" },
  { slug: "refunds", label: "Refund Policy" },
  { slug: "auction-rules", label: "Auction Rules" },
  { slug: "identity", label: "Identity Verification" },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="space-y-3">
          <span className="font-display text-2xl font-extrabold">
            RV<span className="text-gradient-gold">BID</span>
          </span>
          <p className="max-w-xs text-sm text-muted-foreground">
            12-hour Fast Fingers auctions on used RVs. Every auction opens at $0 — that's the catch
            that gets our members amazing deals.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider">Auctions</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/auctions" className="hover:text-foreground">Live auctions</Link></li>
            <li><Link to="/sold" className="hover:text-foreground">Recently sold</Link></li>
            <li><Link to="/faq" className="hover:text-foreground">FAQ</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact support</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {LEGAL.map((item) => (
              <li key={item.slug}>
                <Link to="/legal/$slug" params={{ slug: item.slug }} className="hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider">Support</h4>
          <p className="text-sm text-muted-foreground">support@rvbid.com</p>
          <p className="mt-3 text-xs text-muted-foreground">
            All units are used and known to be bank repossessions or consigned units and are sold
            "as is" with no warranties, titles, expressed or implied.
          </p>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} RVBID. All rights reserved.
      </div>
    </footer>
  );
}
