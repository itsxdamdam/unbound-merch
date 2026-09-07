"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/money";
import { useCart } from "@/lib/cart";

export interface DetailImage {
  url: string;
  alt: string;
  variantId: string | null;
}

export interface DetailVariant {
  id: string;
  label: string;
  /** Whole naira. See lib/types.ts. */
  price: number;
}

// Gallery and variant picker together: choosing "Purple" changes the
// photograph, choosing "XL" does not.
export function ProductDetail({
  name,
  description,
  images,
  variants,
}: {
  name: string;
  description: string;
  images: DetailImage[];
  variants: DetailVariant[];
}) {
  const { add } = useCart();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const [rawActiveIndex, setActiveIndex] = useState(0);
  const [added, setAdded] = useState(false);

  const selected = variants.find((v) => v.id === selectedId);

  // Images bound to this variant if there are any (colourways), otherwise the
  // product-level angles (a tee's front and back, same for every size).
  const shown = useMemo(() => {
    const forVariant = images.filter((i) => i.variantId === selectedId);
    return forVariant.length > 0 ? forVariant : images.filter((i) => i.variantId === null);
  }, [images, selectedId]);

  // Clamped: switching variant can shorten the list under a higher index.
  const activeIndex = Math.min(rawActiveIndex, Math.max(0, shown.length - 1));
  const onlyOneVariant = variants.length === 1;

  function selectVariant(id: string) {
    setSelectedId(id);
    // The old index may point at an image that belongs to another colourway.
    setActiveIndex(0);
    setAdded(false);
  }

  return (
    <div className="cols">
      <div className="gallery">
        <div className="gallery-main">
          {shown.length === 0 && <span className="thumb-empty">no photo</span>}
          {shown.map((image, index) => {
            const isActive = index === activeIndex;
            return (
              <Image
                key={image.url}
                className="gallery-img"
                data-active={isActive}
                src={image.url}
                // Only the visible one is described; the rest are decorative
                // stand-ins so a screen reader is not read three photos of the
                // same product.
                alt={isActive ? image.alt : ""}
                aria-hidden={!isActive}
                fill
                priority={index === 0}
                sizes="(max-width: 760px) 100vw, 620px"
                style={{ objectFit: "contain" }}
              />
            );
          })}
        </div>

        {shown.length > 1 && (
          <div className="gallery-strip">
            {shown.map((image, index) => (
              <button
                key={image.url}
                type="button"
                className="gallery-thumb"
                data-active={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                aria-label={image.alt}
              >
                <Image src={image.url} alt="" fill sizes="72px" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel stack">
        <div>
          <h1 style={{ marginBottom: 4 }}>{name}</h1>
          <p className="muted" style={{ margin: 0 }}>{description}</p>
        </div>
        <hr className="divider" />

        {!onlyOneVariant && (
          <div>
            <label htmlFor="variant">
              {/* Size and colourway are both "variants" in the data, but a
                  shopper does not think in those terms. */}
              {looksLikeSizes(variants) ? "Size" : "Choose"}
            </label>
            <div className="swatches">
              {variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  className="swatch"
                  data-active={variant.id === selectedId}
                  onClick={() => selectVariant(variant.id)}
                >
                  {variant.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="row-split">
          <strong style={{ fontSize: 22 }}>
            {selected ? formatNaira(selected.price) : "—"}
          </strong>
        </div>

        <button
          className="btn"
          disabled={!selected}
          onClick={() => { add(selectedId); setAdded(true); }}
        >
          Add to cart
        </button>

        {added && (
          <div className="row-split">
            <span className="muted">Added to your cart.</span>
            <button className="btn-link" onClick={() => router.push("/cart")}>
              Go to cart →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const SIZE_LABELS = new Set(["XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL"]);

function looksLikeSizes(variants: { label: string }[]): boolean {
  return variants.every((v) => SIZE_LABELS.has(v.label.toUpperCase()));
}
