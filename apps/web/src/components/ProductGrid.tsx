import Link from "next/link";
import Image from "next/image";
import { formatKobo } from "@/lib/money";
import type { Product } from "@/lib/types";

export function ProductGrid({ items }: { items: Product[] }) {
  if (items.length === 0) {
    return <p className="empty">Nothing in this category yet.</p>;
  }
  return (
    <div className="grid">
      {items.map((product) => {
        const [image, hoverImage] = product.images;
        const available = product.variants.reduce((sum, v) => sum + v.available, 0);
        return (
          <Link className="card" key={product.slug} href={`/product/${product.slug}`}>
            <div className="thumb">
              {image ? (
                <>
                  <Image
                    className="thumb-img"
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 640px) 50vw, 260px"
                  />
                  {/* The flip is pure CSS: both images are in the DOM and the
                      second fades in on hover. No JS, no load delay on first
                      hover, and on touch devices — which have no hover — the
                      front simply stays put. */}
                  {hoverImage && (
                    <Image
                      className="thumb-img thumb-img-hover"
                      src={hoverImage.url}
                      alt=""
                      aria-hidden="true"
                      fill
                      sizes="(max-width: 640px) 50vw, 260px"
                    />
                  )}
                </>
              ) : (
                <span className="thumb-empty">no photo</span>
              )}
            </div>
            <div className="card-body">
              <span className="card-name">{product.name}</span>
              <span className="card-price">{formatKobo(product.fromKobo)}</span>
              <span className="card-meta">
                {available === 0
                  ? "Sold out"
                  : product.variants.length > 1
                    ? product.variants.map((v) => v.label).join(" · ")
                    : `${available} in stock`}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
