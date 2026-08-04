# RVBID — migrating from the Lovable-managed backend to a Supabase project you own

Answers are specific to this project. Current live data in the managed project
(snapshot taken while writing this doc):

| Thing | Count |
| --- | --- |
| `auth.users` | 1 (your admin account) |
| `public.listings` | 10 |
| `public.bids` | 11 |
| `public.profiles` / `public.user_roles` | 1 / 2 |
| `public.site_settings` / `legal_pages` / `faqs` | 6 / 6 / 9 |
| `public.deposit_addresses` / `deposit_intents` | 1 / 2 |
| `deposits`, `withdrawals`, `transactions`, `report_orders` | 0 (empty) |
| Storage `rv-photos` | 109 files |
| Storage `kyc-documents` | 2 files |

Everything else (auctions logic, wallets, cron, admin roles) is plain Postgres +
`supabase/migrations/*.sql`, so it recreates itself on any Supabase project.

---

## 1. Can the managed database be migrated/cloned into a project I own?

Yes — via a full export, not a one-click transfer. Lovable does not hand over
the managed project itself (no Postgres connection string, no service-role key),
but it does produce a complete database export that you can restore into your
own project: **Cloud → Overview → Advanced settings → Export project data →
Export → Start export**. You get an email when it's ready and the dump lands in
your project's Cloud storage, where you download it. That dump contains the
schema and table data. Passwords/secrets are not usable from it.

## 2. Can the Storage buckets be transferred with all files intact?

Yes, and it is scripted for you. The Cloud data export does **not** include
bucket files, so use the two scripts added in this commit:

```bash
# download all 111 files from the managed project (uses your admin login, no service key)
OLD_SUPABASE_URL=https://<managed-ref>.supabase.co \
OLD_SUPABASE_PUBLISHABLE_KEY=<managed publishable key> \
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' \
node scripts/export-storage.mjs ./storage-backup

# upload them into YOUR project, identical paths
NEW_SUPABASE_URL=https://<your-ref>.supabase.co \
NEW_SUPABASE_SERVICE_ROLE_KEY=<your service role key> \
node scripts/import-storage.mjs ./storage-backup
```

The URL and publishable key for the managed project are the `VITE_SUPABASE_*`
values in this repo's `.env`. Paths are preserved byte-for-byte, so every
`listings.images` entry and both KYC files keep working with no edits.

## 3. Can the project just be reconnected to my Supabase project and keep data?

Reconnecting is supported (**Cloud → "Already have a Supabase project? Connect
it here"**), but it does **not** carry data across — it points the app at an
empty database. Data comes over only by restoring the export (step 2 of the plan
below). Order matters: restore into your project first, then reconnect, so the
app never renders against an empty schema.

## 4. Best supported method with the least manual work

Do **not** hand-copy tables. Use, in this order:

1. Cloud **Export project data** → schema + data dump (one file).
2. `supabase db push` on your project as a fallback/reference for schema — the 8
   files in `supabase/migrations/` are the authoritative source of every table,
   RLS policy, `place_bid`, `close_expired_auctions`, `admin_*`, locked-funds
   triggers, etc.
3. `scripts/export-storage.mjs` + `scripts/import-storage.mjs` for the 111 files.
4. Re-create your login (one account) and run `supabase/seed/remap-user-id.sql`
   if the dump's `auth.users` row can't be restored — that repoints profile,
   wallet, bids, KYC paths and the admin role onto the new account id.

## 5. Can you generate the migration automatically?

The parts that can be automated are automated and committed here:

- `scripts/export-storage.mjs` — bulk Storage download (no manual clicking).
- `scripts/import-storage.mjs` — bulk Storage upload to your project.
- `supabase/migrations/*.sql` — full schema/logic rebuild via `supabase db push`.
- `supabase/seed/remap-user-id.sql` — identity re-linking after re-registration.

What I cannot do from here: press the Export button in your Cloud settings, or
run `psql`/`pg_restore` against your new project (I have no credentials for it).
Those are three commands you run locally.

## 6. Step-by-step plan

**A. In Lovable (managed project)**
1. Cloud → Overview → Advanced settings → **Export project data** → Export →
   Start export. Wait for the email, then download the dump from Cloud → Storage.
2. Run `scripts/export-storage.mjs` (command above). Confirm
   `find storage-backup -type f | wc -l` returns **111**.
3. Keep a copy of `.env` and note the old admin account id
   `5a0c5281-1649-49f8-96ad-5c09facc0fbe` (already inside the remap script).

**B. In Supabase (your project)**
4. Create the project; note ref, URL, publishable key, service-role key.
5. Restore the dump: `psql "$NEW_DB_URL" -f <export>.sql` (or
   `pg_restore -d "$NEW_DB_URL" --no-owner --no-privileges <export>.dump`).
   If it refuses `auth.*`, instead run `supabase link --project-ref <ref> &&
   supabase db push`, then load only the `public` data from the dump.
6. Storage → create **private** buckets `rv-photos` and `kyc-documents`, then run
   `scripts/import-storage.mjs`.
7. Auth → Providers: enable Email; enable Google with your own client ID/secret;
   redirect URLs `https://rvbid.com` and `https://rvbid.com/auth`. Auth → SMTP:
   your mail provider.
8. If your login did not come across: register the same email in the app, copy
   `select id from auth.users`, paste it into `supabase/seed/remap-user-id.sql`
   and run that file. Your admin role, wallet and bid history reattach.
9. Sanity SQL: `select count(*) from public.listings;` → 10,
   `select count(*) from public.bids;` → 11.

**C. In this codebase / on your VPS**
10. Set `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
    `VITE_SUPABASE_PROJECT_ID`, `VITE_SELF_HOSTED=true`, plus server-only
    `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
    `CRON_SECRET`, optional `ETHERSCAN_API_KEY`.
11. `docker compose up -d --build` (see `DEPLOYMENT.md`), point DNS at the VPS.
12. Verify: `/`, `/auctions`, `/sold`, `/auth` load; images render (proves
    Storage); sign in as admin; `/admin` loads; a bid history shows all 11 bids;
    `curl -X POST -H "x-cron-secret: …" https://<domain>/api/public/close-auctions`
    returns `{"ok":true,...}`.
13. Optional: if you stay on Lovable for editing, connect your Supabase project
    (Cloud → connect existing project) **after** step B so the editor and your
    VPS share one database.

## 7. Loss checklist

| Preserved | How |
| --- | --- |
| Listings, bids, wallets, settings, legal/FAQ, deposit addresses | Cloud data export → restore |
| RV photos + KYC files (111) | export/import storage scripts |
| Schema, RLS, all SQL functions and triggers | `supabase/migrations/` |
| Admin role and account linkage | dump `auth.users`, or re-register + `remap-user-id.sql` |
| **Not preserved** | password hashes if `auth` can't be restored (reset via email), Google OAuth app config, SMTP config, `CRON_SECRET` — all re-entered by you |
