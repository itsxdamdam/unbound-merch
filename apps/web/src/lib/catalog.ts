import * as api from "./api";
import { FIXTURE_PRODUCTS } from "./fixtures";
import type { CartLine, Product } from "./types";
import { multiplyKobo, sumKobo } from "./money";

/**
 * Catalogue reads.
 *
 * One switch: with NEXT_PUBLIC_API_URL set, everything comes from the backend.
 * Without it, the placeholder catalogue keeps the storefront developable. There
 * is no fallback for an API that is merely failing — a backend that is down
 * should surface as an error, not as quietly stale prices.
 */
export function usingFixtures(): boolean {
  return !api.isApiConfigured();
}

export async function listProducts(category?: string): Promise<Product[]> {
  if (usingFixtures()) {
    return category
      ? FIXTURE_PRODUCTS.filter((p) => p.category === category)
      : FIXTURE_PRODUCTS;
  }
  return api.listProducts(category);
}

export async function getProduct(slug: string): Promise<Product | null> {
  if (usingFixtures()) {
    return FIXTURE_PRODUCTS.find((p) => p.slug === slug) ?? null;
  }
  return api.getProduct(slug);
}

export interface ResolvedLine extends CartLine {
  productSlug: string;
  productName: string;
  variantLabel: string;
  unitPriceKobo: string;
  available: number;
  image: { url: string; alt: string } | null;
}

export interface ResolvedCart {
  lines: ResolvedLine[];
  /** Display only. The backend recomputes the real total when the order is created. */
  totalKobo: string;
  /** Variant ids no longer in the catalogue; the cart drops them. */
  dropped: string[];
}

/**
 * Turn stored variant ids into displayable lines.
 *
 * Done here rather than by a "price this cart" endpoint because the catalogue
 * already carries prices, and one fewer round trip is one fewer thing for the
 * backend to implement. It is a preview: `POST /orders` sends ids and
 * quantities only, and the backend prices it again.
 */
export async function resolveCart(lines: CartLine[]): Promise<ResolvedCart> {
  if (lines.length === 0) return { lines: [], totalKobo: "0", dropped: [] };

  const products = await listProducts();
  const resolved: ResolvedLine[] = [];
  const dropped: string[] = [];

  for (const line of lines) {
    const product = products.find((p) => p.variants.some((v) => v.id === line.variantId));
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
      unitPriceKobo: variant.priceKobo,
      available: variant.available,
      image: image ? { url: image.url, alt: image.alt } : null,
    });
  }

  return {
    lines: resolved,
    totalKobo: sumKobo(resolved.map((l) => multiplyKobo(l.unitPriceKobo, l.quantity))),
    dropped,
  };
}
