"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatKobo } from "@store/db/money";
import { useCart } from "@/lib/cart";
import { resolveCart, type ResolvedCart } from "../actions";

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

  const overStock = cart.lines.filter((l) => l.quantity > l.available);

  return (
    <>
      <h1>Your cart</h1>
      <p className="lede">Prices are confirmed again when you check out.</p>

      <div className="cols">
        <div className="panel">
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Price</th>
                  <th className="num">Qty</th>
                  <th className="num">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.lines.map((line) => (
                  <tr key={line.variantId}>
                    <td>
                      <div className="cart-line">
                        {line.image && (
                          <Link className="cart-thumb" href={`/product/${line.productSlug}`}>
                            <Image src={line.image.url} alt={line.image.alt} fill sizes="56px" />
                          </Link>
                        )}
                        <div>
                          <Link href={`/product/${line.productSlug}`} style={{ fontWeight: 550 }}>
                            {line.productName}
                          </Link>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {line.label}
                            {line.quantity > line.available && (
                              <span style={{ color: "var(--danger)" }}>
                                {" "}· only {line.available} left
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="num">{formatKobo(BigInt(line.unitPriceKobo))}</td>
                    <td className="num">
                      <input
                        type="number" min={1} max={Math.max(1, line.available)}
                        value={line.quantity} style={{ width: 68 }}
                        onChange={(e) => setQuantity(line.variantId, Number(e.target.value))}
                      />
                    </td>
                    <td className="num">
                      {formatKobo(BigInt(line.unitPriceKobo) * BigInt(line.quantity))}
                    </td>
                    <td className="num">
                      <button className="btn-link" onClick={() => remove(line.variantId)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel stack">
          <div className="row-split">
            <span>Subtotal</span>
            <strong style={{ fontSize: 20 }}>{formatKobo(BigInt(cart.totalKobo))}</strong>
          </div>
          <p className="hint" style={{ margin: 0 }}>
            Delivery is arranged over WhatsApp after payment.
          </p>
          {overStock.length > 0 ? (
            <div className="notice notice-error">
              Reduce the quantities above — some items no longer have that much in stock.
            </div>
          ) : (
            <Link className="btn" href="/checkout">Checkout</Link>
          )}
          <Link className="btn btn-secondary" href="/">Keep shopping</Link>
        </div>
      </div>
    </>
  );
}
