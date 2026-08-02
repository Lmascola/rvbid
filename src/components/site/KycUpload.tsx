import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/rvbid";
import { useAuth } from "@/hooks/useAuth";

export function KycUpload({ onDone }: { onDone?: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File, kind: string) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user!.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, {
      upsert: true,
    });
    if (error) throw error;
    return path;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!idFile || !selfie) { toast.error("Please attach both your ID and a selfie."); return; }
    setBusy(true);
    try {
      const [idPath, selfiePath] = await Promise.all([
        upload(idFile, "id"),
        upload(selfie, "selfie"),
      ]);
      await db
        .from("profiles")
        .update({ kyc_id_url: idPath, kyc_selfie_url: selfiePath, kyc_status: "pending" })
        .eq("id", user!.id);
      await refreshProfile();
      toast.success("Documents submitted. Your account is pending review.");
      onDone?.();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (profile?.kyc_status === "approved") {
    return (
      <p className="text-sm text-success">Your identity is verified — bidding is unlocked.</p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Government ID
        </Label>
        <Input type="file" accept="image/*,.pdf" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Selfie</Label>
        <Input type="file" accept="image/*" capture="user" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Uploading…" : profile?.kyc_id_url ? "Replace documents" : "Submit for review"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Documents are stored privately and reviewed only by RVBID staff.
      </p>
    </form>
  );
}
