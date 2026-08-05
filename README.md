# RVBID

Premium auction marketplace for used, bank-repossessed and consigned RVs. Every
listing opens at $0 and closes after a 12-hour countdown.

## Features

- Live auctions with server-side countdown close and automatic winner recording
- Wallet-backed bidding: funds lock on a leading bid and release on outbid or close
- Crypto deposits detected automatically (TRON, Bitcoin, Ethereum watchers)
- KYC onboarding (government ID + selfie) with team approval before full access
- Anonymous bidder aliases, full bid history with timestamps
- Team back office: listings (up to 40 photos), bids, users, balances, KYC,
  deposit addresses, homepage stats, legal pages and FAQ
- Scheduled jobs via public API routes (`/api/public/close-auctions`,
  `/api/public/deposit-watch`) protected by `CRON_SECRET`

## Stack

- React 19 + TanStack Start (file-based routing, server functions) on Vite
- Tailwind CSS v4 with shadcn/ui components
- Supabase: Postgres (RLS), Auth, Storage (`rv-photos`, `kyc-documents`)

## Local development

```bash
bun install
cp .env.example .env   # fill in the values below
bun run dev            # http://localhost:8080
```

### Environment variables

| Variable                        | Purpose                                     |
| ------------------------------- | ------------------------------------------- |
| `VITE_SUPABASE_URL`             | Supabase project URL                        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key               |
| `VITE_SUPABASE_PROJECT_ID`      | Supabase project ref                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-side privileged access               |
| `CRON_SECRET`                   | Shared secret for the scheduled API routes  |
| `ETHERSCAN_API_KEY`             | Optional, Ethereum deposit detection        |

## Database

Migrations live in `supabase/`. Apply them with the Supabase CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

## Deployment

See `DEPLOYMENT.md` for the Docker/VPS setup (Dockerfile, docker-compose.yml,
Caddyfile) and the pre-launch checklist. `MIGRATION.md` and
`MIGRATE_TO_OWN_SUPABASE.md` cover data/storage backup and restore.

## Admin

The first signed-in account can claim the administrator role via the banner on
the site; after that the option disappears permanently. `ADMIN_GUIDE.md`
explains the back office.
