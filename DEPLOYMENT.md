# RVBID — VPS Deployment & Production Automation

RVBID is a TanStack Start (React 19 + Vite 7) app backed by Lovable Cloud
(managed Postgres, auth, storage). The simplest path to production is the
Publish button in Lovable — this guide is for running the frontend/SSR server
on your own VPS while still using the managed backend.

## 0. What you need

- Ubuntu 22.04+ VPS, 2 vCPU / 2 GB RAM minimum
- A domain (e.g. `rvbid.com`) with DNS pointing at the VPS
- Backend environment values from the Lovable Cloud dashboard:
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
  (the service-role key and DB password are not available on Lovable Cloud and
  are not needed for this deployment)

## 1. Prepare the VPS

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install git ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # re-login afterwards
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
```

## 2. Get the code and environment

```bash
git clone <your-repo-url> /opt/rvbid && cd /opt/rvbid
cat > .env <<'EOF'
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
VITE_SUPABASE_PROJECT_ID=<project id>
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable key>
# optional: enables ETH / ERC-20 deposit detection
ETHERSCAN_API_KEY=
EOF
chmod 600 .env
```

## 3. Dockerfile

```dockerfile
# Dockerfile
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
RUN bun run build

FROM oven/bun:1-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["bun", "run", ".output/server/index.mjs"]
```

## 4. docker-compose.yml (app + Caddy TLS)

```yaml
services:
  app:
    build:
      context: .
      args:
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
        VITE_SUPABASE_PUBLISHABLE_KEY: ${VITE_SUPABASE_PUBLISHABLE_KEY}
        VITE_SUPABASE_PROJECT_ID: ${VITE_SUPABASE_PROJECT_ID}
    env_file: .env
    restart: unless-stopped
    expose: ["3000"]
    healthcheck:
      test: ["CMD", "bun", "-e", "await fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1))"]
      interval: 30s
      timeout: 5s
      retries: 5

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [app]

volumes:
  caddy_data:
  caddy_config:
```

```caddyfile
# Caddyfile
rvbid.com, www.rvbid.com {
  encode zstd gzip
  reverse_proxy app:3000
}
```

Bring it up (TLS certificates are issued automatically):

```bash
docker compose up -d --build
docker compose logs -f app
```

## 5. Deploy automation

`deploy.sh` on the VPS:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/rvbid
git pull --ff-only
docker compose up -d --build
docker image prune -f
```

GitHub Actions (`.github/workflows/deploy.yml`) — add repo secrets
`SSH_HOST`, `SSH_USER`, `SSH_KEY`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
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

## 6. Auction & deposit automation (required in production)

Two jobs keep the marketplace moving. Run them with cron on the VPS:

```bash
crontab -e
# close ended auctions, record winners, promote the next queued RV
* * * * * curl -fsS -X POST https://rvbid.com/api/public/close-auctions >/dev/null 2>&1
# scan the chain for pending member deposits and credit wallets
*/2 * * * * curl -fsS -X POST https://rvbid.com/api/public/deposit-watch >/dev/null 2>&1
```

Both endpoints are idempotent and safe to call repeatedly. The app also calls
them opportunistically from the browser, so cron is a reliability net rather
than the only trigger.

## 7. Operations checklist

- Backups: Lovable Cloud handles Postgres backups; keep your repo mirrored.
- Logs: `docker compose logs -f app` (add `--since 1h` to narrow).
- Rollback: `git checkout <last-good-sha> && docker compose up -d --build`.
- Never place service-role keys or DB passwords in the client `.env` values
  prefixed with `VITE_`; anything `VITE_*` ships to the browser.
