import { PrismaClient, type Category } from "../src/generated/client";

import { loadRootEnv } from "../src/env";

// The .env lives at the repo root; these scripts may be run from anywhere.
loadRootEnv();

const prisma = new PrismaClient();

/** Naira -> kobo. Prices are quoted in whole Naira; storage is integer kobo. */
const naira = (amount: number): bigint => BigInt(amount) * 100n;

interface SeedImage {
  file: string;
  alt: string;
  /** Omit for a product-level angle shared by every size (a tee's front/back). */
  variantLabel?: string;
}

interface SeedVariant {
  label: string;
  /** Omit to inherit the product's price. Set it when a size costs more. */
  priceNaira?: number;
}

interface SeedProduct {
  slug: string;
  name: string;
  category: Category;
  priceNaira: number;
  description: string;
  /**
   * The stocked units. Order here IS the display order — S before M before L,
   * which is not alphabetical, so it cannot be derived.
   *
   * Note the axis differs by category, and that is deliberate rather than
   * inconsistent: you stock a tee by size and a cap by colourway, so that is
   * what a reservation has to hold.
   */
  variants: SeedVariant[];
  images: SeedImage[];
}

const APPAREL_SIZES: SeedVariant[] = [
  { label: "S" },
  { label: "M" },
  { label: "L" },
  { label: "XL" },
];

const PLACEHOLDER_STOCK = 20;

/**
 * The catalogue, matched to the artwork in apps/web/public/products.
 *
 * stockQuantity is a PLACEHOLDER of 20 PER VARIANT so the storefront is usable
 * in development. Replace with real counts before going live — this number is
 * what the reservation system protects, and seeding it wrong means overselling.
 */
const PRODUCTS: SeedProduct[] = [
  {
    slug: "tshirt-black",
    name: "Godacity Tee — Black",
    category: "tshirts",
    priceNaira: 9000,
    description:
      "Heavyweight black tee. GODACITY across the chest, THE GODACIOUS ONES across the back.",
    variants: APPAREL_SIZES,
    images: [
      {
        file: "/products/tshirts/tshirt-black-front-godacity.png",
        alt: "Front of a black t-shirt with the GODACITY logo in white across the chest, under the Unbound crest.",
      },
      {
        file: "/products/tshirts/tshirt-black-back-the-godacious-ones.png",
        alt: "Back of the black t-shirt reading THE GODACIOUS ONES in white inside a yellow box, with THE STARHUB logo below.",
      },
    ],
  },
  {
    slug: "tshirt-white",
    name: "Godacity Tee — White",
    category: "tshirts",
    priceNaira: 8500,
    description:
      "White tee with a small chest hit. GODS IN THE CITY printed large across the back.",
    variants: APPAREL_SIZES,
    images: [
      {
        file: "/products/tshirts/tshirt-white-front.png",
        alt: "Front of a white t-shirt with a small red Unbound crest and a black GODACITY logo at chest height.",
      },
      {
        file: "/products/tshirts/tshirt-white-back-gods-in-the-city.png",
        alt: "Back of the white t-shirt reading GODS IN THE CITY.",
      },
    ],
  },
  {
    slug: "jersey",
    name: "Godacity Jersey",
    category: "jerseys",
    priceNaira: 17000,
    description:
      "Purple and red football jersey with lightning-bolt shoulders and a GODACITY chest print.",
    variants: APPAREL_SIZES,
    images: [
      {
        file: "/products/jerseys/jersey-front.png",
        alt: "Front of a purple and red football jersey with yellow lightning bolts on the shoulders and GODACITY printed across the chest.",
      },
      {
        file: "/products/jerseys/jersey-back.png",
        alt: "Back of the purple and red Godacity football jersey.",
      },
    ],
  },
  {
    slug: "scarf",
    name: "Godacity Scarf",
    category: "scarves",
    priceNaira: 7000,
    // Two genuinely different artworks rather than one design in two colours,
    // so the label names the artwork.
    description: "Square print scarf. Two artworks — pick the one you want.",
    variants: [{ label: "Cityscape Blue" }, { label: "Geometric Purple" }],
    images: [
      {
        file: "/products/scarves/scarf-cityscape-blue.png",
        alt: "Square scarf: brightly coloured skyscrapers seen from below against a pale blue sky, with GODACITY at the centre.",
        variantLabel: "Cityscape Blue",
      },
      {
        file: "/products/scarves/scarf-geometric-purple.png",
        alt: "Square scarf: bold purple, orange and yellow geometric shapes with GODACITY across the middle.",
        variantLabel: "Geometric Purple",
      },
    ],
  },
  {
    slug: "cap",
    name: "Godacity Cap",
    category: "caps",
    priceNaira: 5000,
    description: "Six-panel cap with the GODACITY logo and Unbound crest on the front.",
    variants: [{ label: "Black" }, { label: "Purple" }],
    images: [
      {
        file: "/products/caps/cap-black-godacity.png",
        alt: "Black baseball cap with the Unbound crest and GODACITY logo in white on the front panel.",
        variantLabel: "Black",
      },
      {
        file: "/products/caps/cap-purple-godacity.png",
        alt: "Purple baseball cap with the Unbound crest and GODACITY logo in white on the front panel.",
        variantLabel: "Purple",
      },
    ],
  },
  {
    slug: "tote-bag",
    name: "Godacity Tote",
    category: "tote_bags",
    priceNaira: 5000,
    description: "Cotton tote in three colourways. Green carries THE GODACIOUS ONES artwork.",
    variants: [{ label: "Black" }, { label: "Green" }, { label: "Red" }],
    images: [
      {
        file: "/products/tote-bags/totebag-black-godacity.png",
        alt: "Black cotton tote bag with the GODACITY logo.",
        variantLabel: "Black",
      },
      {
        file: "/products/tote-bags/totebag-green-the-godacious-ones.png",
        alt: "Green cotton tote bag with THE GODACIOUS ONES artwork.",
        variantLabel: "Green",
      },
      {
        file: "/products/tote-bags/totebag-red-godacity.png",
        alt: "Red cotton tote bag with the GODACITY logo.",
        variantLabel: "Red",
      },
    ],
  },
];

/** "cap" + "Black" -> "cap-black". */
function skuFor(productSlug: string, label: string): string {
  return `${productSlug}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

async function main() {
  for (const product of PRODUCTS) {
    const { priceNaira, variants, images, ...rest } = product;

    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      // Re-seeding updates presentation and price but never touches stock —
      // stock is live operational state, not seed data.
      update: {
        name: rest.name,
        category: rest.category,
        description: rest.description,
        priceKobo: naira(priceNaira),
        active: true,
      },
      create: { ...rest, priceKobo: naira(priceNaira), active: true },
    });

    const variantIdByLabel = new Map<string, string>();
    for (const [index, variant] of variants.entries()) {
      const saved = await prisma.productVariant.upsert({
        where: { productId_label: { productId: row.id, label: variant.label } },
        // Same rule as above: never overwrite live stock on a re-seed.
        update: {
          sku: skuFor(product.slug, variant.label),
          priceKobo: naira(variant.priceNaira ?? priceNaira),
          sortOrder: index,
          active: true,
        },
        create: {
          productId: row.id,
          label: variant.label,
          sku: skuFor(product.slug, variant.label),
          priceKobo: naira(variant.priceNaira ?? priceNaira),
          stockQuantity: PLACEHOLDER_STOCK,
          sortOrder: index,
          active: true,
        },
      });
      variantIdByLabel.set(variant.label, saved.id);
    }

    // A variant dropped from the catalogue is deactivated rather than deleted:
    // orders that already reference it must keep resolving.
    const retired = await prisma.productVariant.updateMany({
      where: {
        productId: row.id,
        active: true,
        label: { notIn: variants.map((v) => v.label) },
      },
      data: { active: false },
    });

    for (const [index, image] of images.entries()) {
      const variantId = image.variantLabel
        ? variantIdByLabel.get(image.variantLabel)
        : null;
      if (image.variantLabel && !variantId) {
        throw new Error(
          `${product.slug}: image ${image.file} names variant "${image.variantLabel}", which is not in the variant list.`,
        );
      }
      await prisma.productImage.upsert({
        where: { productId_url: { productId: row.id, url: image.file } },
        update: { alt: image.alt, sortOrder: index, variantId: variantId ?? null },
        create: {
          productId: row.id,
          url: image.file,
          alt: image.alt,
          sortOrder: index,
          variantId: variantId ?? null,
        },
      });
    }

    await prisma.productImage.deleteMany({
      where: { productId: row.id, url: { notIn: images.map((i) => i.file) } },
    });

    console.log(
      `seeded ${product.slug.padEnd(14)} ₦${priceNaira.toLocaleString().padEnd(6)} ` +
        `${variants.length} variant(s), ${images.length} image(s)` +
        (retired.count ? `, retired ${retired.count}` : ""),
    );
  }

  // Products dropped from the catalogue are deactivated, never deleted: an
  // order placed against one must keep resolving. `tshirt-1`/`tshirt-2` from
  // the original placeholder list retire here.
  const retiredProducts = await prisma.product.updateMany({
    where: { active: true, slug: { notIn: PRODUCTS.map((p) => p.slug) } },
    data: { active: false },
  });
  if (retiredProducts.count > 0) {
    console.log(`retired ${retiredProducts.count} product(s) no longer in the catalogue`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
