import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthConfig } from "@/lib/auth-config.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, PASSWORD_RULES, passwordIsStrong } from "@/lib/rvbid";
import { useAuth } from "@/hooks/useAuth";
import { KycUpload } from "@/components/site/KycUpload";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "signin" | "signup" } => ({
    mode: search["mode"] === "signup" ? "signup" : "signin",
  }),
  head: () => ({
    meta: [
      { title: "Sign In or Register | RVBID" },
      {
        name: "description",
        content:
          "Create an RVBID account with your email, verify your email and identity, then fund your wallet to bid on used RV auctions.",
      },
      { property: "og:title", content: "Sign In or Register | RVBID" },
      { property: "og:description", content: "Join RVBID to bid on used RV auctions from $0." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

type PendingProfile = {
  full_name: string;
  first_name: string;
  last_name: string;
  dob: string;
  phone: string;
  address: string;
  state: string;
  zip: string;
  email: string;
};

function AuthPage() {
  const { mode } = Route.useSearch();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">(mode ?? "signin");
  const [busy, setBusy] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(true);
  const [pending, setPending] = useState<PendingProfile | null>(null);
  const [code, setCode] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    dob: "",
    email: "",
    phone: "",
    address: "",
    state: "",
    zip: "",
    password: "",
    confirm: "",
  });
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    getAuthConfig()
      .then((cfg) => setVerificationRequired(cfg.emailVerificationRequired))
      .catch(() => setVerificationRequired(true));
  }, []);

  const needsKyc = Boolean(
    user &&
      profile &&
      profile.kyc_status !== "approved" &&
      !(profile.kyc_id_url && profile.kyc_selfie_url),
  );

  async function applyPendingProfile(userId: string, details: PendingProfile) {
    await db
      .from("profiles")
      .update({
        full_name: details.full_name,
        first_name: details.first_name,
        last_name: details.last_name,
        dob: details.dob,
        phone: details.phone,
        address: details.address,
        state: details.state,
        zip: details.zip,
        email: details.email,
      })
      .eq("id", userId);
    await refreshProfile();
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Signed in.");
    router.navigate({ to: "/dashboard" });
  }

  async function forgotPassword() {
    const email = form.email.trim();
    if (!email) { toast.error("Enter your email address first."); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password reset email sent — check your inbox.");
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.first_name || !form.last_name || !form.dob || !form.email ||
      !form.phone || !form.address || !form.state || !form.zip
    ) {
      toast.error("Please complete every field."); return;
    }
    if (!passwordIsStrong(form.password)) {
      toast.error("Please choose a stronger password."); return;
    }
    if (form.password !== form.confirm) {
      toast.error("Your passwords don't match."); return;
    }
    const details: PendingProfile = {
      full_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      dob: form.dob,
      phone: form.phone.trim(),
      address: form.address.trim(),
      state: form.state,
      zip: form.zip.trim(),
      email: form.email.trim(),
    };
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: details.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          full_name: details.full_name,
          first_name: details.first_name,
          last_name: details.last_name,
        },
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }

    // With email verification on, signUp returns no session: the account is not
    // active until the 6-digit code from the email is confirmed.
    if (data.session?.user) {
      await applyPendingProfile(data.session.user.id, details);
      toast.success("Account created — now upload your ID and selfie.");
      return;
    }
    if (verificationRequired) {
      setPending(details);
      setCode("");
      toast.success("We emailed you a 6-digit verification code.");
      return;
    }
    toast.success("Account created. Confirm your email, then sign in to continue.");
    setTab("signin");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    if (code.trim().length !== 6) { toast.error("Enter the 6-digit code from your email."); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: pending.email,
      token: code.trim(),
      type: "signup",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (data.user) await applyPendingProfile(data.user.id, pending);
    setPending(null);
    toast.success("Email verified — now upload your ID and selfie.");
  }

  async function resendCode() {
    if (!pending) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: pending.email });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("New code sent.");
  }

  if (pending && !user) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Step 2 of 3</p>
        <h1 className="mt-2 font-display text-3xl">Verify your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="text-foreground">{pending.email}</span>. Enter it
          below to activate your account and continue to identity verification.
        </p>
        <form onSubmit={verifyCode} className="panel mt-6 space-y-4 p-5">
          <Field label="6-digit code">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center font-mono text-lg tracking-[0.5em]"
              required
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {busy ? "Verifying…" : "Verify email"}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={resendCode} disabled={busy}>
            Resend code
          </Button>
        </form>
      </div>
    );
  }

  if (needsKyc) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Final step</p>
        <h1 className="mt-2 font-display text-3xl">Verify your identity</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Identity verification is mandatory before your account is activated. Upload a
          government-issued ID and a selfie to continue; your dashboard opens as soon as they're
          submitted, while our team reviews them.
        </p>
        <div className="panel mt-6 p-5">
          <KycUpload onDone={() => router.navigate({ to: "/dashboard" })} />
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Both documents are required — the dashboard unlocks once they're uploaded.
        </p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-2xl">You're signed in</h1>
        <Button className="mt-6" asChild>
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 sm:px-6">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
        {(["signin", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              tab === value ? "bg-card text-foreground" : "text-muted-foreground"
            }`}
          >
            {value === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <div className="panel p-5 sm:p-6">
        {tab === "signin" ? (
          <form onSubmit={signIn} className="space-y-4">
            <h1 className="font-display text-2xl">Welcome back</h1>
            <Field label="Email">
              <Input type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={form.password} onChange={(e) => set("password", e.target.value)} required />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <button
              type="button"
              onClick={forgotPassword}
              className="w-full text-center text-xs text-muted-foreground underline"
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={signUp} className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Step 1 of 3</p>
            <h1 className="font-display text-2xl">Create your RVBID account</h1>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
              </Field>
              <Field label="Last name">
                <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
              </Field>
            </div>
            <Field label="Date of birth">
              <Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} required />
            </Field>
            <Field label="Email">
              <Input type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </Field>
            <Field label="Phone">
              <Input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
            </Field>
            <Field label="Address">
              <Input autoComplete="street-address" value={form.address} onChange={(e) => set("address", e.target.value)} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="State">
                <select
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select</option>
                  {STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="ZIP">
                <Input value={form.zip} onChange={(e) => set("zip", e.target.value)} required />
              </Field>
            </div>
            <Field label="Password">
              <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} required />
            </Field>
            <ul className="grid gap-1 sm:grid-cols-2">
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(form.password);
                return (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-1.5 text-[11px] ${ok ? "text-success" : "text-muted-foreground"}`}
                  >
                    {ok ? <Check className="size-3" /> : <X className="size-3" />}
                    {rule.label}
                  </li>
                );
              })}
            </ul>
            <Field label="Confirm password">
              <Input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} required />
            </Field>
            {form.confirm && form.confirm !== form.password && (
              <p className="text-[11px] text-destructive">Passwords don't match.</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !passwordIsStrong(form.password) || form.password !== form.confirm}
            >
              {busy ? "Creating account…" : verificationRequired ? "Continue to email verification" : "Continue to ID verification"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              By continuing you agree to our{" "}
              <Link to="/legal/$slug" params={{ slug: "terms" }} className="underline">Terms</Link> and{" "}
              <Link to="/legal/$slug" params={{ slug: "privacy" }} className="underline">Privacy Policy</Link>.
              Email and identity verification are required before bidding or funding a wallet.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
