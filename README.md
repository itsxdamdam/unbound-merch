# unbound-merch

A manual bank-transfer storefront. Buyers order, transfer to your account, and
the system confirms the order automatically when the bank's alert email arrives.

See [PROPOSAL.md](PROPOSAL.md) for the design rationale and the open questions.

## Running it locally

You need Docker (for Postgres) and Node 20+. There is no local `psql`
requirement — the database runs in a container.

```bash
npm install
cp .env.example .env      # the defaults work for local development
npm run setup             # start Postgres, migrate, seed the catalogue + admin
```

Then run the two processes in separate terminals:

```bash
npm run dev:web           # http://localhost:3000
npm run dev:worker        # expiry sweep, alert matching, outbox
```

Both are needed. The web app never sends a WhatsApp message or confirms a
payment; it only writes rows. The worker is what acts on them.

## Seeing the whole flow work

The interesting part of this system is what happens after a buyer pays, and
that normally needs a bank and a paired phone. Neither is required locally:

- `WHATSAPP_DRIVER=fake` (the default) prints messages to the worker console
  instead of sending them.
- Bank alerts are injected by hand instead of arriving over IMAP.

```bash
npm run demo              # creates an order, delivers a genuine credit alert
npm run demo -- --list    # every scenario, including the attacks
npm run alerts            # what the review queue holds right now
```

Within a tick (60s) the worker verifies the sender, parses the alert, matches
it to the order, marks it paid, and drains the buyer notification. You can
watch each step in the worker console.

The same thing is available in the UI at **/admin/alerts**, which has a form
that composes a raw alert email and drops it into the mailbox. Both paths write
a `pending` row and let the worker do the rest — the dev path and the
production path run the identical pipeline.

### The scenarios worth trying

| `npm run demo <scenario>` | What it proves |
|---|---|
| `valid-credit` | The happy path: verified sender, exact amount, order paid. |
| `forged-sender` | Someone emails the mailbox a fake alert. DKIM fails → `rejected`. |
| `wrong-domain` | A properly signed email from a domain that isn't the bank → `rejected`. |
| `debit-trap` | A *debit* for the exact order total → `ignored`, never confirms. |
| `balance-trap` | Only currency figure on the page is the account balance → refuses. |
| `no-reference` | Real transfer, buyer forgot the narration → manual review. |
| `underpayment` | ₦1 short → refused into review, never rounded into a match. |
| `mangled-reference` | Bank glued the reference to other text → recovered, flagged. |

## Checking correctness

```bash
npm run db:verify     # 18 lifecycle invariants against real Postgres
npm run typecheck     # all three workspaces
```

`db:verify` covers the parts a mocked test cannot: the `FOR UPDATE` row locking
that stops two concurrent checkouts overselling the last item, the
`SKIP LOCKED` expiry sweep, and the unique constraint that stops one bank alert
confirming two orders. It creates orders and cleans up after itself.

## Layout

    packages/db/          schema, and every write that touches order state
      src/orders/         createOrder, confirmPayment, expireReservations
    apps/web/             Next.js storefront + admin
    apps/worker/          long-running: alert matching, expiry, outbox
      src/imap/           sender verification, parsers, matcher
      src/whatsapp/       governor (pacing/caps), send adapters
    scripts/              demo-order, show-alerts

`confirmPayment` is the single path by which an order becomes `paid`. Nothing
else writes that status.

## The catalogue

Six products, seeded from the artwork in `apps/web/public/products/`:

| Product | Variants | Price | Images |
|---|---|---|---|
| Godacity Tee — Black | S / M / L / XL | ₦9,000 | front + back |
| Godacity Tee — White | S / M / L / XL | ₦8,500 | front + back |
| Godacity Jersey | S / M / L / XL | ₦17,000 | front + back |
| Godacity Scarf | Cityscape Blue / Geometric Purple | ₦7,000 | one per artwork |
| Godacity Cap | Black / Purple | ₦5,000 | one per colour |
| Godacity Tote | Black / Green / Red | ₦5,000 | one per colour |

The variant axis differs by category on purpose: you stock a tee by size and a
cap by colourway, and a reservation has to hold whatever is physically stocked.
Apparel front/back shots are product-level (every size looks the same);
colourway shots are bound to their variant, so the cart shows the colour
actually ordered. See `apps/web/public/products/README.md`.

**Assumption worth checking:** your price list said "T-Shirt 1 ₦9,000, T-Shirt 2
₦8,500" without saying which design is which. Black is seeded at ₦9,000 and
white at ₦8,500. If that is backwards, swap the two `priceNaira` values in
`packages/db/prisma/seed.ts` and re-seed.

## Before this goes live

- **Real stock counts.** Every variant is seeded with a placeholder 20 — that is
  20 per size and per colour, so the black tee alone claims 80 units.
- **`ADMIN_PASSWORD_HASH` and auth on `/admin`.** The admin pages are currently
  unauthenticated — fine on localhost, not fine anywhere else.
- **A real bank alert**, raw source, so the generic parser can be replaced with
  one tuned to your bank's template.
- **`ALERT_SENDER_ALLOWLIST`** set to your bank's actual sending domain, and
  confirmation that the alert mailbox receives mail directly rather than by
  forwarding (forwarding breaks DKIM and sends everything to manual review).


## Deploying

### The build

Two things make the Prisma client deterministic here, and both matter:

**The generator writes into the repo, not into `node_modules`.**
`schema.prisma` sets `output = "../src/generated/client"`, and everything
imports Prisma through `@store/db/prisma` rather than `@prisma/client`. The
default output is "wherever `@prisma/client` resolved to", which depends on how
the installer hoisted the workspace — on a layout that nests a second copy under
`apps/web/node_modules`, `prisma generate` writes to one copy while the app
imports the other, still-ungenerated one.

**Generation runs at build time**, via `apps/web/scripts/generate-prisma.mjs`.
npm 11.11 gates dependency install scripts behind `allow-scripts`, so
`@prisma/client`'s postinstall does not run on Vercel. Building on the target
machine also produces the right query-engine binary for its platform. That
script locates the schema by resolving `@store/db` instead of counting `../`
segments, so a missing workspace reports itself in one line.

Without both, the failure mode is a wall of
`Parameter 'v' implicitly has an 'any' type` errors that never mention Prisma —
because with no generated client there are no types, and every inferred callback
parameter collapses to `any` under `strict`.

Verified against Vercel's exact conditions: `npm ci --ignore-scripts` (no
postinstall, no generated client) plus `npm run build` with no `DATABASE_URL`
set, from a wiped `node_modules`.

Set on Vercel: **Root Directory** `apps/web`, with "Include files outside root
directory" left on so the workspace resolves.

### What Vercel cannot host

**The worker is a long-running process** — a 60-second tick loop, an IMAP IDLE
connection, and a WhatsApp session. None of that survives a serverless function
boundary. Deploy the storefront to Vercel and the worker somewhere that runs a
persistent process (Railway, Fly, Render, a VPS).

This matters more than it sounds. With the storefront up and no worker:

- no order is ever confirmed — alerts pile up as `pending`
- no reservation ever expires — sold-out stock never returns
- no buyer is ever messaged

The shop would take money and go silent. A storefront without its worker is
worse than no storefront.

### Environment

`.env` is gitignored, so every variable in `.env.example` must be set in the
Vercel project (and again wherever the worker runs). At minimum the web app
needs `DATABASE_URL`, the three `SELLER_*` values, and `DISPLAY_TIMEZONE`.

`DATABASE_URL` must point at a hosted Postgres — Neon, Supabase, Vercel
Postgres. The local value is a Docker container on `localhost` and will fail in
production. Run `prisma migrate deploy` against it once before first use.

### Not ready for a public URL

**`/admin` has no authentication.** There is no middleware and no session check
anywhere in `apps/web/src`. On localhost that is fine. On a public deployment,
anyone who visits `/admin` can mark any order paid. `ADMIN_PASSWORD_HASH` and
`ADMIN_SESSION_SECRET` exist in `.env.example` for the login that has not been
built yet. Put auth in front of `/admin` before the first deploy that has a real
bank account behind it.

## Notes

- `next dev` runs under **Turbopack**; `next build` does not. On Node 25,
  webpack's cache serializer trips a V8 abort (`Lazy deopt after a fast API
  call`), which is why dev uses Turbopack. Production builds use webpack — it
  is Next's default, the most-trodden path on Vercel, and produces a smaller
  bundle here (103 kB shared vs 122 kB). Vercel runs Node 22, where the webpack
  bug does not exist. To build locally on Node 25, use `npm run build:turbopack`
  in `apps/web`, or switch to Node 22.
- Money is integer kobo as `BigInt` throughout. Never floats.
