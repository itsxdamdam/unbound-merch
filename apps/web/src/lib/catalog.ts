import { PRODUCTS } from "./products";
import type { CartLine, Product } from "./types";

// Local and synchronous underneath; `async` so pages need not change shape if
// products ever move behind a request.
export async function listProducts(category?: string): Promise<Product[]> {
  return category ? PRODUCTS.filter((p) => p.category === category) : PRODUCTS;
}

export async function getProduct(slug: string): Promise<Product | null> {
  return PRODUCTS.find((p) => p.slug === slug) ?? null;
}

export interface ResolvedLine extends CartLine {
  productSlug: string;
  productName: string;
  variantLabel: string;
  /** Whole naira. */
  unitPrice: number;
  image: { url: string; alt: string } | null;
}

export interface ResolvedCart {
  lines: ResolvedLine[];
  /** Whole naira. */
  total: number;
  /** Variant ids no longer in the catalogue; the cart drops them. */
  dropped: string[];
}

/**
 * Stored variant ids -> displayable lines. `dropped` carries ids no longer in
 * the catalogue: carts outlive deploys, and those get removed rather than
 * failing checkout.
 */
export async function resolveCart(lines: CartLine[]): Promise<ResolvedCart> {
  if (lines.length === 0) return { lines: [], total: 0, dropped: [] };

  const resolved: ResolvedLine[] = [];
  const dropped: string[] = [];

  for (const line of lines) {
    const product = PRODUCTS.find((p) => p.variants.some((v) => v.id === line.variantId));
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) {
      dropped.push(line.variantId);
      continue;
    }

    // Prefer the image bound to this exact variant: a line for a purple cap
    // must not show the black one.
    const image =
      product.images.find((i) => i.variantId === variant.id) ??
      product.images.find((i) => i.variantId === null) ??
      null;

    resolved.push({
      ...line,
      productSlug: product.slug,
      productName: product.name,
      variantLabel: variant.label,
      unitPrice: variant.price,
      image: image ? { url: image.url, alt: image.alt } : null,
    });
  }

  return {
    lines: resolved,
    total: resolved.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    dropped,
  };
}
