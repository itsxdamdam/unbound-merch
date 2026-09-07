"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatKobo } from "@/lib/money";
import { useCart } from "@/lib/cart";

export interface DetailImage {
  url: string;
  alt: string;
  variantId: string | null;
}

export interface DetailVariant {
  id: string;
  label: string;
  /** Kobo, as a string. See lib/types.ts. */
  priceKobo: string;
  available: number;
}

/**
 * Gallery + variant picker + add to cart.
 *
 * These are one component because they are one interaction: choosing "Purple"
 * has to change the photograph, and choosing "XL" must not. Splitting them
 * would mean lifting the selected variant into a shared parent for no gain.
 */
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
  const firstInStock = variants.find((v) => v.available > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstInStock?.id ?? "");
  const [activeIndex, setActiveIndex] = useState(0);
  const [added, setAdded] = useState(false);

  const selected = variants.find((v) => v.id === selectedId);

  // Images bound to this variant if there are any (colourways), otherwise the
  // product-level angles (a tee's front and back, same for every size).
  const shown = useMemo(() => {
    const forVariant = images.filter((i) => i.variantId === selectedId);
    return forVariant.length > 0 ? forVariant : images.filter((i) => i.variantId === null);
  }, [images, selectedId]);

  const active = shown[Math.min(activeIndex, shown.length - 1)] ?? null;
  const soldOut = !selected || selected.available < 1;
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
          {active ? (
            <Image
              key={active.url}
              src={active.url}
              alt={active.alt}
              fill
              priority
              sizes="(max-width: 760px) 100vw, 620px"
              style={{ objectFit: "contain" }}
            />
          ) : (
            <span className="thumb-empty">no photo</span>
          )}
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
                  disabled={variant.available < 1}
                  onClick={() => selectVariant(variant.id)}
                >
                  {variant.label}
                  {variant.available < 1 && <span className="swatch-out"> · sold out</span>}
                </button>
              ))}
            </div>
            {selected && selected.available > 0 && selected.available <= 3 && (
              <p className="hint" style={{ color: "var(--danger)" }}>
                Only {selected.available} left in {selected.label}.
              </p>
            )}
          </div>
        )}

        <div className="row-split">
          <strong style={{ fontSize: 22 }}>
            {selected ? formatKobo(selected.priceKobo) : "—"}
          </strong>
          <span className="muted">
            {soldOut ? "Sold out" : `${selected.available} available`}
          </span>
        </div>

        <button
          className="btn"
          disabled={soldOut}
          onClick={() => { add(selectedId); setAdded(true); }}
        >
          {soldOut ? "Sold out" : "Add to cart"}
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
