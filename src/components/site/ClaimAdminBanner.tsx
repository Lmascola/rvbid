import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/rvbid";

export type ClaimStatus = {
  admin_exists: boolean;
  eligible: boolean;
  eligible_email: string | null;
};

/** Reads whether the platform still has no administrator and whether this account may claim it. */
export function useAdminClaimStatus() {
  const { user, isAdmin, loading } = useAuth();
  return useQuery({
    queryKey: ["admin-claim-status", user?.id ?? "anon"],
    enabled: Boolean(user) && !isAdmin && !loading,
    staleTime: 30_000,
    queryFn: async (): Promise<ClaimStatus> => {
      const { data, error } = await db.rpc("admin_claim_status");
      if (error) throw error;
      return data as unknown as ClaimStatus;
    },
  });
}

/**
 * Secure one-time ownership claim. Rendered only for the first registered account
 * and only while no administrator exists; the database enforces both rules again.
 */
export function ClaimAdminBanner() {
  const { refreshProfile } = useAuth();
  const router = useRouter();
  const { data } = useAdminClaimStatus();
  const [busy, setBusy] = useState(false);

  if (!data || data.admin_exists || !data.eligible) return null;

  return (
    <div className="border-b border-primary/30 bg-primary/10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            This platform has no administrator yet. As the first registered account you can claim
            administrator access once.
          </span>
        </p>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { error } = await db.rpc("claim_admin");
            setBusy(false);
            if (error) {
              toast.error(error.message.replace(/^.*?:\s*/, ""));
              return;
            }
            await refreshProfile();
            toast.success("Administrator access granted.");
            router.navigate({ to: "/admin" });
          }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Claim Admin
        </Button>
      </div>
    </div>
  );
}
