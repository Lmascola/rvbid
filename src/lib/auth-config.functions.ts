import { createServerFn } from "@tanstack/react-start";

/**
 * Server-only auth configuration. Values come from the environment so they can
 * be changed on the VPS without touching code, and the raw settings (SMTP
 * credentials, sender addresses) never reach the browser.
 */
export const getAuthConfig = createServerFn({ method: "GET" }).handler(async () => {
  const flag = (process.env["EMAIL_VERIFICATION_REQUIRED"] ?? "true").trim().toLowerCase();
  return {
    emailVerificationRequired: flag !== "false" && flag !== "0" && flag !== "no",
    // Display-only: lets the UI tell users which address the code comes from.
    authSender: process.env["EMAIL_FROM_AUTH"] ?? "",
    supportSender: process.env["EMAIL_FROM_NOTIFICATIONS"] ?? "",
  };
});
