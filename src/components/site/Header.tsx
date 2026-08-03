import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Menu, X, LayoutDashboard, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const NAV = [
  { to: "/auctions", label: "Live Auctions" },
  { to: "/sold", label: "Recently Sold" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, isAdmin, signOut } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="font-display text-2xl font-extrabold tracking-tight">
            RV<span className="text-gradient-gold">BID</span>
          </span>
          <span className="hidden rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:inline">
            Used RV Auctions
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => router.navigate({ to: "/admin" })}>
                  <ShieldCheck className="size-4" /> Admin
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => router.navigate({ to: "/dashboard" })}>
                <LayoutDashboard className="size-4" /> Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  router.navigate({ to: "/" });
                }}
              >
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => router.navigate({ to: "/auth" })}>
                Sign in
              </Button>
              <Button
                size="sm"
                onClick={() => router.navigate({ to: "/auth", search: { mode: "signup" } })}
              >
                Create account
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          className="rounded-md p-2 text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex w-full max-w-7xl flex-col p-3">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-foreground hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 grid gap-2 border-t border-border pt-3">
              {user ? (
                <>
                  {isAdmin && (
                    <Button variant="outline" onClick={() => { setOpen(false); router.navigate({ to: "/admin" }); }}>
                      Team back office
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => { setOpen(false); router.navigate({ to: "/dashboard" }); }}>
                    My dashboard
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      setOpen(false);
                      await signOut();
                      router.navigate({ to: "/" });
                    }}
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => { setOpen(false); router.navigate({ to: "/auth" }); }}>
                    Sign in
                  </Button>
                  <Button onClick={() => { setOpen(false); router.navigate({ to: "/auth", search: { mode: "signup" } }); }}>
                    Create account
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
