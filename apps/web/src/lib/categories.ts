import type { CategorySlug } from "./types";

// How each category reads, and the order it appears in.
export interface CategoryMeta {
  slug: CategorySlug;
  label: string;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { slug: "tshirts", label: "T-Shirts" },
  { slug: "jerseys", label: "Jerseys" },
  { slug: "scarves", label: "Scarves" },
  { slug: "caps", label: "Caps" },
  { slug: "tote-bags", label: "Tote Bags" },
] as const;

const BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

/** Null rather than throw — this parses untrusted URL segments. */
export function categoryFromSlug(slug: string): CategoryMeta | null {
  return BY_SLUG.get(slug.toLowerCase() as CategorySlug) ?? null;
}
