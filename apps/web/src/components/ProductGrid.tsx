import Link from "next/link";
import Image from "next/image";
import { formatNaira } from "@/lib/money";
import type { Product } from "@/lib/types";

export function ProductGrid({ items }: { items: Product[] }) {
  if (items.length === 0) {
    return <p className="empty">Nothing in this category yet.</p>;
  }
  return (
    <div className="grid">
      {items.map((product) => {
        const [image, hoverImage] = product.images;

        const body = (
          <>
            <div className="thumb">
              {product.soldOut && <span className="sold-out-tag">Sold out</span>}
              {image ? (
                <>
                  <Image
                    className="thumb-img"
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 640px) 50vw, 260px"
                  />
                  {/* Hover flip: pure CSS, both images already in the DOM. */}
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
              <span className="card-price">{formatNaira(product.fromPrice)}</span>
              {product.soldOut ? (
                <span className="card-meta">Sold out</span>
              ) : (
                product.variants.length > 1 && (
                  <span className="card-meta">
                    {product.variants.map((v) => v.label).join(" · ")}
                  </span>
                )
              )}
            </div>
          </>
        );

        // Sold-out cards are a plain div, not a link. Rendering an anchor and
        // suppressing the click would still be focusable, still show a URL on
        // hover, and still open in a new tab from the context menu.
        return product.soldOut ? (
          <div className="card" key={product.slug} data-sold-out="true">
            {body}
          </div>
        ) : (
          <Link className="card" key={product.slug} href={`/product/${product.slug}`}>
            {body}
          </Link>
        );
      })}
    </div>
  );
}
