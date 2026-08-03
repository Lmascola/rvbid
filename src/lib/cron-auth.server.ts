/**
 * Optional shared-secret gate for the public maintenance endpoints.
 *
 * If `CRON_SECRET` is set in the server environment, callers must send
 * `x-cron-secret: <value>` (or `?secret=<value>`). When it is unset the endpoints
 * stay open, which is what lets the browser trigger them opportunistically.
 */
export function cronSecretRejection(request: Request): Response | null {
  const expected = process.env["CRON_SECRET"];
  if (!expected) return null;
  const header = request.headers.get("x-cron-secret");
  const query = new URL(request.url).searchParams.get("secret");
  if (header === expected || query === expected) return null;
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
