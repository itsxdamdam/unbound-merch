import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { ProductGrid } from "@/components/ProductGrid";
import { listProducts } from "@/lib/catalog";
import { STORE_OPEN } from "@/lib/store";

// Stock changes with every checkout, so nothing here may be cached.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const items = await listProducts();
  return (
    <>
      <h1>Everything</h1>
      {STORE_OPEN && (
        <div className="chips">
          <span className="chip" data-active="true">All</span>
          {CATEGORIES.map((c) => (
            <Link className="chip" key={c.slug} href={`/shop/${c.slug}`}>{c.label}</Link>
          ))}
        </div>
      )}
      <ProductGrid items={items} />
    </>
  );
}
