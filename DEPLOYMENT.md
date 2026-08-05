# RVBID — Self-Hosting & Portability Guide (Docker VPS)

RVBID is a TanStack Start (React 19 + Vite) app on top of Postgres + Supabase
(auth, Data API, storage). **Nothing in the application requires Lovable at
runtime.** This guide is the complete path to running it on your own VPS with
your own Supabase (managed supabase.com project or self-hosted Supabase stack).

---

## 1. Portability audit — what is platform-specific and what was done

| Area | Status on your VPS | Notes |
| --- | --- | --- |
| Frontend / SSR server | ✅ Portable | Vite build → `.output/server/index.mjs`, run by Bun or Node. |
| Build tooling `@lovable.dev/vite-tanstack-config` | ✅ Portable | Public npm package (dev dependency only, wraps standard TanStack/Vite/Tailwind plugins). No network calls at runtime. |
| Database + all business logic | ✅ Portable | Everything lives in SQL migrations in `supabase/migrations/` (tables, RLS, `place_bid`, `close_expired_auctions`, `claim_admin`, deposits, reports). Apply them to your own project. |
| Auth (email + password) | ✅ Portable | Plain Supabase Auth. Configure your own SMTP for confirmation/reset emails. |
| Auth (Google) | ❌ Removed | Google OAuth (code, UI, dependency, provider config) has been removed. Email + password is the only login method. |
| Admin roles / Claim Admin | ✅ Portable | `user_roles` + `has_role` + `claim_admin`/`admin_claim_status` SQL functions. On a fresh database the first registered account claims admin in the UI. |
| Auctions, bidding, wallets, VIN reports | ✅ Portable | Pure Postgres functions called over the Data API. |
| Uploads (KYC docs, RV photos) | ✅ Portable | Private Supabase Storage buckets `kyc-documents` and `rv-photos`; you must create both on the new project. |
| Scheduled jobs | ✅ Portable **(hardened)** | `/api/public/close-auctions` and `/api/public/deposit-watch`. Driven by the `cron` container in `docker-compose.yml` (or host cron). Set `CRON_SECRET` and they require `x-cron-secret`. |
| Deposit detection | ✅ Portable | Public explorers: TronGrid (USDT/USDC TRC20), Blockstream (BTC). ETH/ERC-20 needs your own `ETHERSCAN_API_KEY`. |
| Notifications | ⚠️ Not implemented | The app has no outbound email/SMS of its own; only Supabase Auth emails. Add SMTP in Supabase to get those. |
| Error reporting `src/lib/lovable-error-reporting.ts` | ✅ Inert off-platform | Only calls `window.__lovableEvents` if the Lovable editor injected it; a no-op in production. Safe to keep or delete. |
| `src/integrations/lovable/index.ts` + `@lovable.dev/cloud-auth-js` | ✅ Bypassed | Only reached when `VITE_SELF_HOSTED` is not `"true"`. You may delete both once self-hosted. |
| Service-role key | ⚠️ You must supply it | `deposit-watch` credits wallets with the service role. Lovable Cloud hides that key; a project you own exposes it in your Supabase project API settings. |

---

## 2. Move the backend to a project you own

1. Create a Supabase project (supabase.com) or run the self-hosted Supabase stack.
2. Apply the schema in order:
   ```bash
   # from the repo, with the Supabase CLI
   supabase link --project-ref <your-ref>
   supabase db push          # applies supabase/migrations/*.sql in order
   ```
   Or paste each file in `supabase/migrations/` (ascending filename order) into the SQL editor.
3. Storage → create private buckets **`kyc-documents`** and **`rv-photos`**.
4. Auth → Providers: enable **Email** only (no social providers are used). Add
   redirect URLs `https://<your-domain>/auth` and `https://<your-domain>/reset-password`.
5. Auth → SMTP: add your mail provider (same values as `SMTP_*` in `.env`) and set
   the sender address to `EMAIL_FROM_AUTH` (e.g. `noreply@rvbidlive.com`) so
   verification codes and password resets come from your own domain.
6. Auth → Email templates → **Confirm signup**: the app verifies a 6-digit code,
   so the template body must include `{{ .Token }}` (e.g. "Your RVBID
   verification code is {{ .Token }}"). Leave **Confirm email** enabled.
6. **Migrating existing data** (optional): export from the old database and import:
   ```bash
   pg_dump "$OLD_DB_URL" --data-only --schema=public --schema=auth > data.sql
   psql "$NEW_DB_URL" -f data.sql
   ```
   Import `auth.users` before `public.*` so foreign keys resolve. If you start
   empty instead, the first account you register can claim admin.

---

## 3. VPS setup

```bash
sudo apt update && sudo apt -y upgrade && sudo apt -y install git ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # re-login
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
git clone <your-repo-url> /opt/rvbid && cd /opt/rvbid
```

`.env` (never commit it):

```bash
# client bundle (public by design)
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
VITE_SUPABASE_PROJECT_ID=<ref>
VITE_SELF_HOSTED=true

# server only
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # required for deposit crediting
CRON_SECRET=<long random string>               # protects the maintenance endpoints
ETHERSCAN_API_KEY=                             # optional: ETH / ERC-20 deposits
```

```bash
chmod 600 .env
# edit Caddyfile with your real domain, then:
docker compose up -d --build
docker compose logs -f app
```

`Dockerfile`, `docker-compose.yml` (app + cron + Caddy TLS) and `Caddyfile` ship
in the repo. Prefer host cron over the cron container? Disable that service and use:

```cron
* * * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://rvbid.com/api/public/close-auctions >/dev/null 2>&1
*/2 * * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://rvbid.com/api/public/deposit-watch >/dev/null 2>&1
```

Note: with `CRON_SECRET` set, the browser can no longer trigger these endpoints
opportunistically — the scheduler becomes the only trigger, so make sure it runs.

## 4. Deploy automation

`deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/rvbid && git pull --ff-only
docker compose up -d --build && docker image prune -f
```

GitHub Actions with repo secrets `SSH_HOST`, `SSH_USER`, `SSH_KEY`:

```yaml
name: Deploy
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: /opt/rvbid/deploy.sh
```

---

## 5. Pre-launch checklist

- [ ] Supabase project created; **all** files in `supabase/migrations/` applied in order
- [ ] Private buckets `kyc-documents` and `rv-photos` created
- [ ] Email provider (SMTP) configured in Supabase Auth
- [ ] Supabase Auth: Email provider enabled, confirm-email on, `{{ .Token }}` in the Confirm signup template
- [ ] `EMAIL_FROM_AUTH`, `EMAIL_FROM_NOTIFICATIONS`, `EMAIL_FROM_NAME`, `SMTP_*` and `EMAIL_VERIFICATION_REQUIRED` set in `.env` (copy `.env.example`)
- [ ] Redirect URL allow-list includes `/auth` and `/reset-password`; password reset email tested
- [ ] `.env` complete, `VITE_SELF_HOSTED=true`, `chmod 600`, not committed
- [ ] `SUPABASE_SERVICE_ROLE_KEY` present server-side only (never a `VITE_` name)
- [ ] `CRON_SECRET` set and used by whichever scheduler you chose
- [ ] Domain DNS → VPS; `Caddyfile` domains updated; HTTPS issued
- [ ] `docker compose ps` healthy; `/` , `/auctions`, `/auth` load over HTTPS
- [ ] Scheduler verified: `curl -X POST -H "x-cron-secret: …" https://<domain>/api/public/close-auctions` returns `{"ok":true,…}`
- [ ] Registered the owner account and pressed **Claim Admin** (banner at the top of the page), then confirmed `/admin` loads
- [ ] Crypto deposit addresses + QR images added in **Team → Crypto addresses**
- [ ] At least 10 `live` and 10 `sold` listings, plus queued RVs behind them
- [ ] Legal pages, FAQ and homepage stats reviewed in **Team → Content**
- [ ] `ETHERSCAN_API_KEY` set if you accept ETH/ERC-20
- [ ] Backups scheduled for your Postgres (`pg_dump` cron or provider backups) and repo mirrored
- [ ] Firewall: only 22/80/443 open; logs checked with `docker compose logs -f app`

---

## 6. Email configuration variables

All email behaviour is environment-driven — nothing is hardcoded. Copy
`.env.example` to `.env` and fill these in:

| Variable | Default | Purpose |
| --- | --- | --- |
| `EMAIL_VERIFICATION_REQUIRED` | `true` | Server-side only. `true` = new registrations must confirm a 6-digit email code before the mandatory Identity Verification (KYC) step; `false` = skip straight to KYC. Change the value and restart the container — no code changes. |
| `EMAIL_FROM_AUTH` | `noreply@rvbidlive.com` | Sender for authentication email (verification codes, password resets). Mirror it in Supabase Auth → SMTP sender. |
| `EMAIL_FROM_NOTIFICATIONS` | `support@rvbidlive.com` | Sender for notification email (outbid alerts, KYC approval/rejection, deposit confirmations, withdrawal status, future account notices). |
| `EMAIL_FROM_NAME` | `RVBID` | Display name shown in inboxes. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | — | Your mail provider credentials. Auth emails are sent by Supabase Auth, so enter the same values under Supabase → Authentication → SMTP Settings. |
| `APP_URL` | — | Public site URL used in email links and reset redirects. |

Authentication email flow: registration form → 6-digit code emailed from
`EMAIL_FROM_AUTH` → code confirmed in-app → mandatory Identity Verification
(KYC) page → dashboard with "Pending verification" until the team approves.
"Forgot password?" on the sign-in page sends a reset link to
`/reset-password` through the same SMTP configuration.
