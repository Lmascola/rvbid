# RVBID — Team Back Office Guide

Everything members see on RVBID is editable from the back office. No SQL, no
dashboards — just the app.

## 1. Get team access (one time, repository owner)

1. Open the live site and create a normal account at `/auth` (or sign in with
   Google) using the email you want as the owner account. On a fresh database
   this must be the **first** account registered.
2. While signed in, a **Claim Admin** banner appears at the top of every page
   (directly under the header) as long as the platform has no administrator and
   your account is the first registered one. Press **Claim Admin** — you are
   granted the admin role and redirected straight to `/admin`.
3. The banner disappears permanently for everyone once an administrator exists;
   the database refuses any further claim. `/admin` also shows the same claim
   option if you land there first.
4. From then on, the header shows a **Team** button whenever you're signed in.
5. To add colleagues: **Members & KYC → Grant team access by email** (they must
   have signed up first).

The claim is enforced server-side: it works only while zero administrators exist
and only for the earliest-registered account, so it can't be used against you.


## 2. Listings tab — create and edit RVs

- **New** starts a blank listing; clicking any row on the left edits it.
- Fields: title, year, make, model, **VIN** (stored in full, shown publicly as
  `•••••••••••` + last 6; the full VIN is only visible to verified members),
  mileage, sleeps, length, class, location, description.
- **Photos** — upload up to 40 images per listing. Upload, then press
  **Save listing**. The first photo is the cover image.
- **Starting bid / current bid / bid count** are directly editable, so you can
  set the numbers a listing should display.
- **Status**: `live` (on the homepage and Live Auctions), `queued` (waiting to
  be promoted automatically when a live auction closes), `sold` (Recently
  Sold), `draft` (hidden).
- **Ends at** sets the 12-hour Fast Fingers countdown. Leave `live` listings
  with a future end time.
- **Queue order** controls which queued RV goes live next (lowest first).
- **Visible bidders (sold listings)**: show every bidder, winning bid only, or
  hide the bid history entirely.
- **Paid vehicle history report**: toggle on, set a price, and optionally paste
  a report link/PDF URL. Members buy it from the listing page with wallet
  funds and then see the full VIN plus the report.

The homepage shows exactly 10 live and 10 recently sold RVs — keep at least 10
listings in `live` and queued RVs ready behind them.

## 3. Bids tab — add bids

1. Pick the listing.
2. Enter the amount.
3. Leave **Post anonymously** on to publish under a generated tag (e.g. `X6521`),
   or switch it off and type the name to display.
4. **Post bid** — the listing's current bid and bid count update automatically
   and the bid appears in the public bid history alongside the opening amount.

Delete any bid with the trash icon.

## 4. Members & KYC tab

- Every account with its details, alias, wallet balance and locked amount.
- **View ID / View selfie** opens the uploaded documents through a short-lived
  private link.
- **Approve** activates the account (bidding, deposits and reports unlock).
  **Reject** keeps it locked.
- Type a number in **Set balance** and press Enter to adjust a wallet.

## 5. Wallets tab

- **Deposits in progress** lists member-initiated deposits. The backend watches
  the chain and credits wallets automatically; **Credit manually** is the
  fallback if you confirmed a transfer yourself.
- **Withdrawal requests**: **Mark sent** debits the wallet and records the
  transaction; **Reject** declines it. Target turnaround is 1–2 hours
  depending on network congestion.

## 6. Crypto addresses tab

Add an address per asset/network, upload its QR image, and keep it **active**.
Approved members are handed the active address for their chosen asset the
moment they press **Send** on a deposit — nothing is asked of them beyond
sending the funds.

## 7. Content tab

- **Homepage stats & settings** — completed auctions, RVs sold, and other
  site-wide values.
- **Legal pages** — Terms, Privacy, Wallet Policy, Refund Policy, Auction
  Rules, Identity Verification. Edit and click away to save.
- **FAQs** — add, edit or delete entries.

## 8. Automation to keep running

Auctions close and requeue themselves through `/api/public/close-auctions`, and
deposits are detected through `/api/public/deposit-watch`. On a self-hosted VPS,
schedule both with cron (see `DEPLOYMENT.md`).
