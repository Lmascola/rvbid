import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_RULES, passwordIsStrong } from "@/lib/rvbid";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a New Password | RVBID" },
      {
        name: "description",
        content: "Set a new password for your RVBID account after requesting a password reset email.",
      },
      { property: "og:title", content: "Choose a New Password | RVBID" },
      { property: "og:description", content: "Set a new RVBID account password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The recovery link arrives as a URL hash Supabase exchanges for a session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordIsStrong(password)) { toast.error("Please choose a stronger password."); return; }
    if (password !== confirm) { toast.error("Your passwords don't match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated.");
    router.navigate({ to: "/dashboard" });
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl">Choose a new password</h1>
      {!ready ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Open this page from the password reset link we emailed you. If the link has expired,
          request a new one from the sign-in page.
        </p>
      ) : (
        <form onSubmit={submit} className="panel mt-6 space-y-4 p-5">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">New password</Label>
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li key={rule.label} className={`flex items-center gap-1.5 text-[11px] ${ok ? "text-success" : "text-muted-foreground"}`}>
                  {ok ? <Check className="size-3" /> : <X className="size-3" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirm password</Label>
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !passwordIsStrong(password) || password !== confirm}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
      )}
    </div>
  );
}
