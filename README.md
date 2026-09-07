# unbound-merch — storefront

The Unbound merch shop. **Frontend only**: catalogue, cart, checkout and the
payment return page. It owns no data and holds no secrets.

## Running it

```bash
npm install
cp apps/web/.env.example apps/web/.env
npm run dev            # http://localhost:3000
```

`.env` lives in `apps/web/`, not the repo root — Next reads it from its own
project directory.

```bash
npm run typecheck
npm run build
```

## The backend

Payment only. Products, variants, prices, images and slugs are hard-coded in
[`src/lib/products.ts`](apps/web/src/lib/products.ts) and ship with the build,
so the shop browses fine whether or not the backend is up. Checkout does not.

Two endpoints, both in [`src/lib/api.ts`](apps/web/src/lib/api.ts):

| Endpoint | Returns |
|---|---|
| `POST /payments/initialize` | `{ reference, accessCode, authorizationUrl, amount }` |
| `GET /payments/verify?reference=` | `{ payment: { status, amount, items, … }, status }` |

Amounts are **whole naira** on both sides — `8500` is ₦8,500.

### Two things that will bite

**Read `payment.status`, not the top-level `status`.** The outer one reports
whether the verify *lookup* worked, and reads `"success"` for a lookup that
found a failed payment. Trusting it would tell every buyer their payment went
through.

**Prices are computed in the browser.** `amount` and `unitPrice` are sent from
the client and can be edited before they leave — someone can pay ₦100 for a
₦17,000 jersey. The catalogue being hard-coded here is what makes that possible:
the backend has no copy to check against. The fix belongs there — a
`name + size → price` map, recompute the total, reject anything that disagrees.
Until then the safety net is that a human reads every order before it ships.

### Notes on the current setup

- `NEXT_PUBLIC_API_URL` points at an ngrok tunnel. Free ngrok URLs change on
  every restart; when checkout breaks, that is usually why.
- Every request sends `ngrok-skip-browser-warning`, or ngrok returns its HTML
  interstitial instead of JSON.
- The backend must allow CORS for the storefront's origin, including the
  `OPTIONS` preflight on `POST`.
- `callbackUrl` is `{origin}/payment/complete`, not the API's `/verify` — the
  buyer should land back on the shop, not on raw JSON.

## Layout

    apps/web/src/
      app/            shop, product, cart, checkout, payment/complete
      components/     grid, product gallery, cart icon
      lib/api.ts      the two payment calls
      lib/types.ts    request and response shapes
      lib/products.ts the catalogue
      lib/catalog.ts  reads and cart resolution
      lib/cart.tsx    localStorage cart (variant ids + quantities)
    apps/web/public/products/   product photography

Variant ids are a contract: carts in browsers store them, so renaming one
empties returning customers' carts.

## Product images

Documented in
[`public/products/README.md`](apps/web/public/products/README.md). Two kinds:
product-level angles (a tee's front and back — the grid card flips between them
on hover) and variant-bound colourways (the purple cap is a different object,
not another angle). `next/image` re-encodes to WebP at display size.

The page backdrop is `public/bg-cityscape.jpg`, a 174KB derivative of the
Cityscape scarf artwork; a CSS background cannot go through `next/image`.

## Notes

- `next dev` uses Turbopack; `next build` uses webpack. On Node 25 webpack's
  cache serializer trips a V8 abort, which is why dev differs.
- No secrets belong here. `NEXT_PUBLIC_API_URL` is a public base URL.
