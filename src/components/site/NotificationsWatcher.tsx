import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/rvbid";

/**
 * Surfaces unread on-site notifications (currently outbid alerts) while the member
 * is signed in, then marks them read so they only ever pop once. Wallet figures are
 * refreshed at the same time because being outbid releases locked funds.
 */
export function NotificationsWatcher() {
  const { user, refreshProfile } = useAuth();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      seen.current.clear();
      return;
    }
    let stopped = false;

    async function poll() {
      const { data } = await db
        .from("notifications")
        .select("id,kind,title,body")
        .eq("user_id", user!.id)
        .is("read_at", null)
        .order("created_at", { ascending: true })
        .limit(10);

      const rows = (data ?? []) as { id: string; kind: string; title: string; body: string }[];
      if (stopped || rows.length === 0) return;

      const fresh = rows.filter((r) => !seen.current.has(r.id));
      fresh.forEach((row) => {
        seen.current.add(row.id);
        toast(row.title, { description: row.body, duration: 10_000 });
      });

      if (fresh.length) {
        await db
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .in("id", fresh.map((r) => r.id));
        await refreshProfile();
      }
    }

    void poll();
    const timer = setInterval(() => void poll(), 20_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return null;
}
