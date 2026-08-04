# RVBID — Data storage audit, backup & migration to your own Docker VPS

Written against this repository's actual architecture (TanStack Start SSR app +
Postgres/Supabase). Nothing in the running app calls a Lovable service.

---

## 1. Where every piece of data lives

Everything persistent is in **one Postgres database** (the Cloud/Supabase project)
plus **two private storage buckets**. There is no other datastore, no KV, no
Lovable-side database.

| Data | Exact location |
| --- | --- |
| User accounts / credentials / sessions | `auth.users`, `auth.identities`, `auth.sessions`, `auth.refresh_tokens` (Supabase Auth schema) |
| Profile fields, KYC status, wallet balance & locked funds | `public.profiles` (`first_name`, `last_name`, `dob`, `phone`, `state`, `zip`, `alias`, `is_anonymous`, `kyc_status`, `kyc_id_url`, `kyc_selfie_url`, `balance`, `locked`) |
| Admin roles & permissions | `public.user_roles` (enum `public.app_role`) + `public.has_role()`, `public.claim_admin()`, `public.admin_claim_status()` |
| Auction listings (incl. VIN, images array, report price, bid visibility, `ends_at`, `sold_at`, winner) | `public.listings` |
| Bids (amount, alias, source, `created_at`) | `public.bids` |
| Wallet money movements | `public.deposits`, `public.deposit_intents`, `public.withdrawals`, `public.transactions` |
| Crypto deposit addresses + QR image references | `public.deposit_addresses` |
| Paid VIN report purchases | `public.report_orders` |
| On-site notifications (outbid alerts) | `public.notifications` |
| Site settings / homepage stats / disclaimers | `public.site_settings` |
| Legal pages & FAQ content | `public.legal_pages`, `public.faqs` |
| KYC ID + selfie uploads | Storage bucket **`kyc-documents`** (private), path `<user_id>/<kind>-<ts>.<ext>` |
| RV photos (up to 40 per listing) | Storage bucket **`rv-photos`** (private); `listings.images` stores the paths |
| Business logic | Postgres functions in `supabase/migrations/`: `place_bid`, `close_expired_auctions`, `recompute_listing_bids`, `admin_place_bid`, `admin_update_bid`, `admin_delete_bid`, `admin_set_close_time`, `admin_upsert_listing`, deposit/report RPCs, `notify_outbid` trigger |
| Scheduled jobs | **Stateless.** No job rows. `/api/public/close-auctions` and `/api/public/deposit-watch` are HTTP endpoints driven by the `cron` service in `docker-compose.yml` |
| Frontend/app code | This git repository only |

## 2. Services in use

- **Postgres + Supabase Auth + Data API (PostgREST) + Storage** — the only backend.
- **Lovable Cloud** — just the hosting wrapper around that Supabase project. No app code depends on it.
- **No Supabase Edge Functions** — all server logic is SQL functions plus TanStack server routes.
- Third-party HTTP APIs used at runtime: **TronGrid** (USDT/USDC TRC20), **Blockstream** (BTC), **Etherscan** (ETH/ERC-20, needs your `ETHERSCAN_API_KEY`), Google Fonts, Google OAuth (optional).
- Platform-specific bits, already neutralised: `src/integrations/lovable/index.ts` + `@lovable.dev/cloud-auth-js` (bypassed when `VITE_SELF_HOSTED=true`, see `src/lib/google-auth.ts`), `src/lib/lovable-error-reporting.ts` (no-op off-platform), `@lovable.dev/vite-tanstack-config` (public npm dev dependency).

## 3. Making backups you own

```bash
export OLD_DB_URL="postgresql://postgres:<pw>@<host>:5432/postgres"

# 3a. Full logical dump (schema + all data, auth + public + storage metadata)
pg_dump "$OLD_DB_URL" -Fc --no-owner --no-privileges -f rvbid-full.dump

# 3b. Readable data-only safety copy of the schemas that matter
pg_dump "$OLD_DB_URL" --data-only --no-owner \
  --schema=auth --schema=public --schema=storage > rvbid-data.sql
```

Storage objects (the actual files, which are NOT in the dump):

```bash
supabase login && supabase link --project-ref <old-ref>
mkdir -p backup/storage
supabase storage cp -r ss:///kyc-documents backup/storage/kyc-documents
supabase storage cp -r ss:///rv-photos     backup/storage/rv-photos
```

Also back up: this git repo (`git bundle create rvbid.bundle --all`), your `.env`,
and `supabase/migrations/` (already in the repo — it is the authoritative schema).

## 4. Restoring on your VPS

1. Create your own Supabase project (managed or self-hosted stack).
2. **Schema + data path (keeps existing users):**
   ```bash
   pg_restore -d "$NEW_DB_URL" --no-owner --no-privileges rvbid-full.dump
   ```
   If you prefer a clean schema build: `supabase db push` (applies
   `supabase/migrations/*.sql` in order), then load `rvbid-data.sql` — import
   `auth.users` before `public.*` so foreign keys resolve.
3. Create the private buckets `kyc-documents` and `rv-photos`, then upload:
   ```bash
   supabase storage cp -r backup/storage/kyc-documents ss:///kyc-documents
   supabase storage cp -r backup/storage/rv-photos     ss:///rv-photos
   ```
4. Auth → Providers: enable Email; enable Google with your own client ID/secret;
   redirect URLs `https://rvbid.com` and `https://rvbid.com/auth`. Auth → SMTP: your mail provider.
5. Fill `.env` (section 5), `docker compose up -d --build`, point DNS at the VPS.
6. Verify: sign in as a migrated user, `/admin` loads for the admin account,
   listings/bids/wallets show pre-migration values, a cron POST returns `{"ok":true}`.
   If the database is empty instead, register the first account and press **Claim Admin**.

## 5. Environment variables, secrets and config files to keep

Client (public, inlined at build): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID`, `VITE_SELF_HOSTED=true`.
Server only: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
(required for deposit crediting; Lovable Cloud does not expose it — take it from the project you own),
`CRON_SECRET`, `ETHERSCAN_API_KEY` (optional), `PORT`.
Files: `.env`, `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `supabase/migrations/`,
plus your Supabase Auth settings (providers, SMTP, redirect URLs) and Google OAuth credentials.

## 6. Does cloning to GitHub back up the data?

**No.** GitHub gets source code + SQL migrations only — that reproduces an *empty*
schema. Users, bids, wallets, settings and every uploaded image live in Postgres and
Storage and must be dumped separately (section 3).

## 7. Migration checklist

- [ ] `pg_dump -Fc` full dump taken and restore-tested locally
- [ ] `--data-only` SQL dump taken as a second copy
- [ ] `kyc-documents` and `rv-photos` downloaded in full; file counts compared
- [ ] Repo pushed/mirrored; `supabase/migrations/` complete
- [ ] `.env`, `Caddyfile`, compose files saved outside the repo
- [ ] New Supabase project created; dump restored; row counts match old DB
- [ ] Both private buckets recreated and re-uploaded
- [ ] Email provider (SMTP) + Google provider + redirect URLs configured
- [ ] `SUPABASE_SERVICE_ROLE_KEY` present server-side only; `CRON_SECRET` set
- [ ] `docker compose ps` healthy; `/`, `/auctions`, `/sold`, `/auth` load over HTTPS
- [ ] cron service verified against `/api/public/close-auctions` and `/api/public/deposit-watch`
- [ ] Admin account works (or Claim Admin used on an empty DB)
- [ ] Deposit addresses + QR images present in Team → Crypto addresses
- [ ] Postgres backups scheduled on the new host; firewall limited to 22/80/443
