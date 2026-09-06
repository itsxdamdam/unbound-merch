"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { formatKobo } from "@store/db/money";
import { useCart } from "@/lib/cart";
import { checkoutAction, resolveCart, type ResolvedCart } from "../actions";

export default function CheckoutPage() {
  const { lines, ready } = useCart();
  const [cart, setCart] = useState<ResolvedCart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!ready) return;
    void resolveCart(lines).then(setCart);
  }, [lines, ready]);

  if (!ready || !cart) return <p className="empty">Loading…</p>;
  if (cart.lines.length === 0) {
    return (
      <>
        <h1>Checkout</h1>
        <p className="empty">
          Your cart is empty. <Link href="/">Browse the shop →</Link>
        </p>
      </>
    );
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      // On success this redirects and never returns; the cart is deliberately
      // NOT cleared here — the order page clears it once the order exists, so
      // a failed checkout doesn't lose the buyer's basket.
      const result = await checkoutAction(lines, {
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        address: String(formData.get("address") ?? ""),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <h1>Checkout</h1>
      <p className="lede">
        We&rsquo;ll hold your items for 15 minutes while you transfer.
      </p>

      <div className="cols">
        <form className="panel stack" action={onSubmit}>
          <div>
            <label htmlFor="name">Full name</label>
            <input id="name" name="name" required autoComplete="name" />
          </div>
          <div>
            <label htmlFor="phone">WhatsApp number</label>
            <input
              id="phone" name="phone" required inputMode="tel"
              autoComplete="tel" placeholder="08012345678"
            />
            <p className="hint">
              We message this number when your payment lands. Nigerian numbers only.
            </p>
          </div>
          <div>
            <label htmlFor="address">Delivery address</label>
            <textarea id="address" name="address" required rows={3} autoComplete="street-address" />
          </div>

          {error && <div className="notice notice-error">{error}</div>}

          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Creating your order…" : "Place order"}
          </button>
          <p className="hint" style={{ margin: 0 }}>
            No payment is taken here. The next page shows the account to transfer to.
          </p>
        </form>

        <div className="panel stack">
          <h2>Your order</h2>
          {cart.lines.map((line) => (
            <div className="row-split" key={line.variantId}>
              <span>
                {line.productName}{" "}
                <span className="muted">
                  {line.label} × {line.quantity}
                </span>
              </span>
              <span className="mono">
                {formatKobo(BigInt(line.unitPriceKobo) * BigInt(line.quantity))}
              </span>
            </div>
          ))}
          <hr className="divider" />
          <div className="row-split">
            <strong>Total</strong>
            <strong style={{ fontSize: 20 }}>{formatKobo(BigInt(cart.totalKobo))}</strong>
          </div>
        </div>
      </div>
    </>
  );
}
