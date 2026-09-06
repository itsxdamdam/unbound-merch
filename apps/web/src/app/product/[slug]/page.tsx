import { notFound } from "next/navigation";
import Link from "next/link";
import { categoryMeta } from "@store/db/categories";
import { ProductDetail } from "@/components/ProductDetail";
import { getProduct } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const meta = categoryMeta(product.category);

  return (
    <>
      <p className="lede" style={{ marginBottom: 18 }}>
        <Link href={`/shop/${meta.slug}`} style={{ color: "inherit" }}>← {meta.label}</Link>
      </p>

      <ProductDetail
        name={product.name}
        description={product.description}
        images={product.images}
        variants={product.variants.map((v) => ({
          id: v.id,
          label: v.label,
          priceKobo: v.priceKobo.toString(),
          available: v.available,
        }))}
      />
    </>
  );
}
