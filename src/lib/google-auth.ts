import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

/**
 * Portable Google sign-in.
 *
 * On Lovable the OAuth broker in `@/integrations/lovable` is used (it works inside
 * the editor preview iframe). On a self-hosted deployment set `VITE_SELF_HOSTED=true`
 * and configure the Google provider directly in your own Supabase project — the call
 * then goes straight through supabase-js, with no Lovable service involved.
 */
export async function signInWithGoogle(): Promise<{
  error?: Error;
  redirected?: boolean;
}> {
  const selfHosted = import.meta.env["VITE_SELF_HOSTED"] === "true";

  if (selfHosted) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) return { error };
    return { redirected: true };
  }

  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  return {
    ...(result.error ? { error: result.error as Error } : {}),
    ...(result.redirected ? { redirected: true } : {}),
  };
}
