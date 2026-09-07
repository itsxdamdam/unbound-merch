"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatNaira } from "@/lib/money";
import { useCart } from "@/lib/cart";
import { resolveCart, type ResolvedCart } from "@/lib/catalog";

export default function CartPage() {
  const { lines, ready, setQuantity, remove } = useCart();
  const [cart, setCart] = useState<ResolvedCart | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!ready) return;
    startTransition(async () => setCart(await resolveCart(lines)));
  }, [lines, ready]);

  // Items removed from the catalogue since they were added shouldn't sit in
  // the cart invisibly failing checkout.
  useEffect(() => {
    for (const id of cart?.dropped ?? []) remove(id);
  }, [cart, remove]);

  if (!ready || !cart) return <p className="empty">Loading your cart…</p>;

  if (cart.lines.length === 0) {
    return (
      <>
        <h1>Your cart</h1>
        <p className="empty">
          Nothing here yet. <Link href="/">Browse the shop →</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Your cart</h1>
      <p className="lede">Prices are confirmed again when you check out.</p>

      <div className="cols">
        <div className="panel">
          <ul className="cart-items">
            {cart.lines.map((line) => (
              <li className="cart-item" key={line.variantId}>
                {line.image ? (
                  <Link className="cart-thumb" href={`/product/${line.productSlug}`}>
                    <Image src={line.image.url} alt={line.image.alt} fill sizes="56px" />
                  </Link>
                ) : (
                  <span className="cart-thumb" aria-hidden="true" />
                )}

                <div className="cart-item-main">
                  <Link className="cart-item-name" href={`/product/${line.productSlug}`}>
                    {line.productName}
                  </Link>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {line.variantLabel} · {formatNaira(line.unitPrice)}
                  </div>

                  <div className="cart-item-controls">
                    {/* A stepper, not a number field: clearing a typed
                        quantity on a phone leaves an empty value. */}
                    <div className="qty" role="group" aria-label={`Quantity, ${line.productName}`}>
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={line.quantity <= 1}
                        onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                      >
                        &minus;
                      </button>
                      <span className="qty-value" aria-live="polite">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={line.quantity >= 99}
                        onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button className="btn-link" onClick={() => remove(line.variantId)}>
                      Remove
                    </button>
                  </div>
                </div>

                <span className="cart-item-total mono">
                  {formatNaira(line.unitPrice * line.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel stack">
          <div className="row-split">
            <span>Subtotal</span>
            <strong style={{ fontSize: 20 }}>{formatNaira(cart.total)}</strong>
          </div>
          <Link className="btn" href="/checkout">Checkout</Link>
          <Link className="btn btn-secondary" href="/">Keep shopping</Link>
        </div>
      </div>
    </>
  );
}
