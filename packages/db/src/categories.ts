import type { Category } from "./generated/client";

/**
 * Display metadata for the fixed merch lines. The enum is the source of truth
 * for what exists; this is the source of truth for how it reads and in what
 * order it appears on the shop.
 */
export interface CategoryMeta {
  key: Category;
  /** URL segment: /shop/tote-bags */
  slug: string;
  label: string;
  /** Storefront ordering, low to high. */
  order: number;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { key: "tshirts", slug: "tshirts", label: "T-Shirts", order: 1 },
  { key: "jerseys", slug: "jerseys", label: "Jerseys", order: 2 },
  { key: "scarves", slug: "scarves", label: "Scarves", order: 3 },
  { key: "caps", slug: "caps", label: "Caps", order: 4 },
  { key: "tote_bags", slug: "tote-bags", label: "Tote Bags", order: 5 },
] as const;

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));
const BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function categoryMeta(key: Category): CategoryMeta {
  const meta = BY_KEY.get(key);
  if (!meta) throw new Error(`Unknown category: ${key}`);
  return meta;
}

/** Null rather than throw — this parses untrusted URL segments. */
export function categoryFromSlug(slug: string): CategoryMeta | null {
  return BY_SLUG.get(slug.toLowerCase()) ?? null;
}

/** Where product images live, relative to apps/web/public. */
export function imageDir(key: Category): string {
  return `/products/${categoryMeta(key).slug}`;
}
