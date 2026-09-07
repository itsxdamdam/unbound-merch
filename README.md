# unbound-merch — storefront

The Unbound merch shop. **Frontend only**: catalogue, cart, checkout and order
pages. It owns no data, holds no secrets, and talks to a backend for everything.

## Running it

```bash
npm install
cp .env.example .env
npm run dev            # http://localhost:3000
```

That is the whole setup. No database, no Docker, no migrations, no background
process.

With `NEXT_PUBLIC_API_URL` empty the shop renders from a placeholder catalogue
(`src/lib/fixtures.ts`) so the frontend is developable before the backend
exists. Orders need a real backend regardless — the order page says so rather
than inventing data.

```bash
npm run typecheck
npm run build
```

## What the backend must provide

The whole contract is one file, [`src/lib/api.ts`](apps/web/src/lib/api.ts):

| Endpoint | Returns |
|---|---|
| `GET /products` | `Product[]` — optional `?category=` |
| `GET /products/:slug` | `Product`, or 404 |
| `POST /orders` | `{ referenceCode, authorizationUrl }` |
| `GET /orders/:reference` | `Order`, or 404 |
| `POST /orders/:reference/pay` | `{ authorizationUrl }` — restart an abandoned payment |

Shapes are in [`src/lib/types.ts`](apps/web/src/lib/types.ts).

### Two things the contract assumes

**Money crosses the wire as a string of kobo**, never a number. JSON numbers are
IEEE doubles, and a float is the wrong type for money. The frontend formats
those strings for display and hands them back untouched; it never does
arithmetic that decides what anyone is charged.

**`POST /orders` sends variant ids and quantities only** — no prices, no total.
The backend re-reads every price and computes the total itself. That is what
makes a tampered browser harmless: it can order the wrong item, never at the
wrong price. The cart total shown here is a preview computed from prices the
backend already published.

### What the backend inherits

This repo used to own the order lifecycle, and that logic did not stop being
necessary — it moved. Whatever implements the endpoints above still has to get
these right, because they are properties of selling limited stock:

- **Stock reservation under concurrency.** Two checkouts for the last item must
  not both succeed. This needs row locking, not a read-then-write.
- **Idempotent payment confirmation.** Paystack retries webhooks. A replayed
  confirmation must not decrement stock or message the buyer twice.
- **One charge, one order.** A settled transaction must be incapable of
  confirming two orders — a unique constraint, not application logic alone.
- **Exact amount matching.** Confirm only when the charge equals the order
  total exactly. Near-misses go to review; they are never rounded into a match.
- **Expiring holds.** Lapsed reservations must return stock to the shop.

Git history has a working implementation of all of it, with an integration test
covering eighteen of these invariants against real Postgres — see
`packages/db/scripts/verify-lifecycle.ts` before the frontend split.

## Layout

    apps/web/src/
      app/            routes: shop, product, cart, checkout, orders/[reference]
      components/     grid, product gallery, cart pill, countdown, pay button
      lib/api.ts      the backend contract — the only place URLs appear
      lib/types.ts    the shapes it returns
      lib/catalog.ts  reads, and the fixtures switch
      lib/cart.tsx    localStorage cart (variant ids + quantities, no prices)
      lib/fixtures.ts placeholder catalogue — delete once the backend is live
    apps/web/public/products/   product photography

## Product images

Wired up and documented in
[`public/products/README.md`](apps/web/public/products/README.md). Two kinds:
product-level angles (a tee's front and back — the grid card flips between them
on hover) and variant-bound colourways (the purple cap is a different object,
not another angle). `next/image` re-encodes to WebP at display size; the 309KB
black-tee PNG serves as roughly 4KB.

The page backdrop is `public/bg-cityscape.jpg`, a 174KB derivative of the
Cityscape scarf artwork. A CSS background cannot go through `next/image` and it
loads on every view, so it gets a hand-made small copy.

## Notes

- `next dev` uses Turbopack; `next build` uses webpack. On Node 25, webpack's
  cache serializer trips a V8 abort, which is why dev differs.
- No secrets belong in this repo. `NEXT_PUBLIC_API_URL` is a public base URL.
