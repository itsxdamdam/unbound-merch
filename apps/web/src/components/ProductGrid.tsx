import Link from "next/link";
import Image from "next/image";
import { formatKobo } from "@store/db/money";

export interface GridImage {
  url: string;
  alt: string;
}

export interface GridItem {
  slug: string;
  name: string;
  image: GridImage | null;
  /** Shown on hover: the back of a tee, or a second colourway. */
  hoverImage: GridImage | null;
  fromKobo: bigint;
  variantLabels: string[];
  available: number;
}

export function ProductGrid({ items }: { items: GridItem[] }) {
  if (items.length === 0) {
    return <p className="empty">Nothing in this category yet.</p>;
  }
  return (
    <div className="grid">
      {items.map((item) => (
        <Link className="card" key={item.slug} href={`/product/${item.slug}`}>
          <div className="thumb">
            {item.image ? (
              <>
                <Image
                  className="thumb-img"
                  src={item.image.url}
                  alt={item.image.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, 260px"
                />
                {/* The flip is pure CSS: both images are in the DOM, and the
                    second fades in on hover. No JS, no load delay on first
                    hover, and on touch devices — which have no hover — the
                    front simply stays put. */}
                {item.hoverImage && (
                  <Image
                    className="thumb-img thumb-img-hover"
                    src={item.hoverImage.url}
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
            <span className="card-name">{item.name}</span>
            <span className="card-price">{formatKobo(item.fromKobo)}</span>
            <span className="card-meta">
              {item.available === 0
                ? "Sold out"
                : item.variantLabels.length > 1
                  ? item.variantLabels.join(" · ")
                  : `${item.available} in stock`}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
