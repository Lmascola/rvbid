import { supabase } from "@/integrations/supabase/client";

/**
 * Google sign-in through Supabase Auth.
 *
 * Configure the Google provider in the Supabase project this deployment points
 * at, and add `<your-domain>/auth` to the provider's allowed redirect URLs.
 */
export async function signInWithGoogle(): Promise<{
  error?: Error;
  redirected?: boolean;
}> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth` },
  });
  if (error) return { error };
  return { redirected: true };
}
