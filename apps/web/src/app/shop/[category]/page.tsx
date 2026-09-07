import { notFound } from "next/navigation";
import Link from "next/link";
import { CATEGORIES, categoryFromSlug } from "@/lib/categories";
import { ProductGrid } from "@/components/ProductGrid";
import { listProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  // categoryFromSlug returns null rather than throwing — this is an untrusted
  // URL segment, and an unknown one is a 404, not a 500.
  const meta = categoryFromSlug(category);
  if (!meta) notFound();

  const items = await listProducts(meta.slug);

  return (
    <>
      <h1>{meta.label}</h1>
      <div className="chips">
        <Link className="chip" href="/">All</Link>
        {CATEGORIES.map((c) => (
          <Link
            className="chip" key={c.slug} href={`/shop/${c.slug}`}
            data-active={c.slug === meta.slug}
          >
            {c.label}
          </Link>
        ))}
      </div>
      <ProductGrid items={items} />
    </>
  );
}
