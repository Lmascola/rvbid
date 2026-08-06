import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sends a security notice to the address an account was moved AWAY from.
 * Uses the same SMTP credentials as the rest of the notification mail. If SMTP
 * is not configured (preview environments), it resolves quietly so the email
 * change itself is never blocked.
 */
export const notifyEmailChanged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { previousEmail: string; newEmail: string }) => {
    const previousEmail = String(input.previousEmail ?? "").trim().slice(0, 255);
    const newEmail = String(input.newEmail ?? "").trim().slice(0, 255);
    if (!previousEmail.includes("@") || !newEmail.includes("@")) {
      throw new Error("Invalid email addresses.");
    }
    return { previousEmail, newEmail };
  })
  .handler(async ({ data }) => {
    const host = process.env["SMTP_HOST"];
    const user = process.env["SMTP_USER"];
    const pass = process.env["SMTP_PASS"];
    if (!host || !user || !pass) return { sent: false as const, reason: "smtp_not_configured" };

    const from = process.env["EMAIL_FROM_NOTIFICATIONS"] || process.env["EMAIL_FROM_AUTH"] || user;
    const fromName = process.env["EMAIL_FROM_NAME"] || "RVBID";
    const support = process.env["EMAIL_FROM_NOTIFICATIONS"] || "support@rvbidlive.com";
    const port = Number(process.env["SMTP_PORT"] ?? "587");
    const secure = (process.env["SMTP_SECURE"] ?? "tls").toLowerCase() === "ssl";

    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      await transport.sendMail({
        from: `"${fromName}" <${from}>`,
        to: data.previousEmail,
        subject: "Your RVBID login email was changed",
        text: [
          "The email address used to sign in to your RVBID account was changed.",
          "",
          `Previous address: ${data.previousEmail}`,
          `New address: ${data.newEmail}`,
          "",
          `If you did not authorize this change, contact us immediately at ${support}.`,
          "",
          "— RVBID",
        ].join("\n"),
      });
      return { sent: true as const };
    } catch (error) {
      console.error("[email-change] notice failed", error);
      return { sent: false as const, reason: "send_failed" };
    }
  });
