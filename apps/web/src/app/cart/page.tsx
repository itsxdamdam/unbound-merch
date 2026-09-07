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
                    <label className="visually-hidden" htmlFor={`qty-${line.variantId}`}>
                      Quantity for {line.productName}
                    </label>
                    <input
                      id={`qty-${line.variantId}`}
                      type="number" min={1} max={99}
                      value={line.quantity}
                      onChange={(e) => setQuantity(line.variantId, Number(e.target.value))}
                    />
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
