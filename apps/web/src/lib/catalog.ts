import { prisma } from "@store/db";
import { availableStockFor } from "@store/db/orders";
import type { Category } from "@store/db/prisma";
import type { GridItem } from "@/components/ProductGrid";

export interface ProductImageView {
  url: string;
  alt: string;
  /** Null for a product-level angle (a tee's front/back). */
  variantId: string | null;
}

/**
 * Catalogue reads for the storefront. Availability is computed the same way
 * checkout computes it, so the grid never advertises stock that checkout will
 * then refuse.
 */
export async function listProducts(category?: Category): Promise<GridItem[]> {
  const products = await prisma.product.findMany({
    where: { active: true, ...(category ? { category } : {}) },
    include: {
      variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  const available = await availableStockFor(
    prisma,
    products.flatMap((p) => p.variants.map((v) => v.id)),
  );

  return products.map((product) => ({
    slug: product.slug,
    name: product.name,
    // [0] is the card image; [1] is what the card flips to on hover — the back
    // of a tee, or the second colourway of a cap. Both are already in
    // sortOrder, so the seed decides what a shopper sees first.
    image: product.images[0]
      ? { url: product.images[0].url, alt: product.images[0].alt }
      : null,
    hoverImage: product.images[1]
      ? { url: product.images[1].url, alt: product.images[1].alt }
      : null,
    fromKobo: product.variants.reduce(
      (min, v) => (v.priceKobo < min ? v.priceKobo : min),
      product.variants[0]?.priceKobo ?? product.priceKobo,
    ),
    variantLabels: product.variants.map((v) => v.label),
    available: product.variants.reduce((sum, v) => sum + (available.get(v.id) ?? 0), 0),
  }));
}

export async function getProduct(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!product || !product.active) return null;

  const available = await availableStockFor(prisma, product.variants.map((v) => v.id));

  return {
    ...product,
    variants: product.variants.map((v) => ({
      id: v.id,
      label: v.label,
      priceKobo: v.priceKobo,
      available: available.get(v.id) ?? 0,
    })),
    images: product.images.map((i) => ({
      url: i.url,
      alt: i.alt,
      variantId: i.variantId,
    })),
  };
}

/**
 * The image to show alongside a line item. Prefers the one bound to the exact
 * variant — a cart line for a purple cap should not show the black one.
 */
export async function imagesForVariants(
  variantIds: string[],
): Promise<Map<string, { url: string; alt: string }>> {
  const result = new Map<string, { url: string; alt: string }>();
  if (variantIds.length === 0) return result;

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      product: { select: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
    },
  });

  for (const variant of variants) {
    const image = variant.images[0] ?? variant.product.images[0];
    if (image) result.set(variant.id, { url: image.url, alt: image.alt });
  }
  return result;
}
