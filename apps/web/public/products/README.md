# Product images

These are wired up. `prisma/seed.ts` points at every file below, with real alt
text, so the storefront shows them with no code change.

    products/
    ├─ tshirts/
    │  ├─ tshirt-black-front-godacity.png          Godacity Tee — Black   ₦9,000
    │  ├─ tshirt-black-back-the-godacious-ones.png   (back)
    │  ├─ tshirt-white-front.png                   Godacity Tee — White   ₦9,500
    │  └─ tshirt-white-back-gods-in-the-city.png     (back)
    ├─ jerseys/
    │  ├─ jersey-front.png                         Godacity Jersey        ₦17,000
    │  └─ jersey-back.png                            (back)
    ├─ scarves/
    │  ├─ scarf-cityscape-blue.png                 Scarf · Cityscape Blue ₦7,000
    │  └─ scarf-geometric-purple.png               Scarf · Geometric Purple
    ├─ caps/
    │  ├─ cap-black-godacity.png                   Cap · Black            ₦5,000
    │  └─ cap-purple-godacity.png                  Cap · Purple
    └─ tote-bags/
       ├─ totebag-black-godacity.png               Tote · Black           ₦5,000
       ├─ totebag-green-the-godacious-ones.png     Tote · Green
       └─ totebag-red-godacity.png                 Tote · Red

## How images attach to products

Images live in the `ProductImage` table and hang off a product, optionally
bound to one variant:

- **No variant** — a product-level angle. The front and back of a tee look the
  same whichever size you buy, so both are product-level. The shop card shows
  the first and **flips to the second on hover**; the product page shows both
  as a gallery.
- **Bound to a variant** — a colourway. The purple cap is not the black cap
  from another angle, it is a different object. Selecting a colourway on the
  product page swaps the photo, and the cart line shows the colour actually
  ordered.

Adding a back shot to the cap is one more entry in the seed's `images` array;
adding a fourth tote colour is a variant plus its image.

## Adding or replacing photos

Drop the file in, add it to the product's `images` array in
`packages/db/prisma/seed.ts` with real alt text, and re-run `npm run db:seed`.
The seed upserts on `(productId, url)`, so re-running is safe, and any image
removed from the array is deleted from the database.

**Write the alt text properly.** It is not decoration — it is what a blind
buyer, and Google, get instead of the photograph. Describe the garment, the
colour, and what is printed on it.

## Guidance

- **Square, 1200×1200 or larger.** The grid and gallery are square. Current
  files are 3000–4800px, which is plenty.
- **Cut-outs on white** work best — the grid uses `object-fit: contain`, so
  nothing gets cropped off, and a consistent white ground reads as a real shop.
- **Source size barely matters now.** `next/image` re-encodes to WebP at the
  size actually displayed: the 309KB black-tee PNG is served as a ~4KB WebP
  thumbnail. Don't hand-optimise; just keep the originals sharp.
- Anything in this folder is **public** — it ships to anyone who visits. Don't
  put unreleased designs here before launch.

## Page background

`apps/web/public/bg-cityscape.jpg` is a 1200px, 174KB JPEG derived from
`scarf-cityscape-blue.png` (1.3MB), used as the fixed page backdrop. A CSS
background cannot go through `next/image`, and a page background loads on every
single view — so it gets a hand-made small copy. Regenerate it with:

    sips -Z 1200 -s format jpeg -s formatOptions 55 \
      products/scarves/scarf-cityscape-blue.png --out bg-cityscape.jpg
