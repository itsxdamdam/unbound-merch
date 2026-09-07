"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { formatKobo, multiplyKobo } from "@/lib/money";
import { useCart } from "@/lib/cart";
import { resolveCart, type ResolvedCart } from "@/lib/catalog";
import { createOrder } from "@/lib/api";

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
      try {
        // Ids and quantities only. The backend prices the order and starts the
        // Paystack transaction; nothing here decides what anyone is charged.
        const { authorizationUrl } = await createOrder({
          items: lines,
          buyerName: String(formData.get("name") ?? ""),
          buyerPhone: String(formData.get("phone") ?? ""),
          buyerEmail: String(formData.get("email") ?? ""),
        });
        // Full navigation, not a router push: Paystack is another origin.
        window.location.href = authorizationUrl;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong. Please try again.",
        );
      }
    });
  }

  return (
    <>
      <h1>Checkout</h1>
      <p className="lede">
        We&rsquo;ll hold your items for 15 minutes while you pay.
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
              We confirm your payment here and arrange delivery on WhatsApp.
              Nigerian numbers only.
            </p>
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email" name="email" required type="email"
              autoComplete="email" placeholder="you@example.com"
            />
            <p className="hint">Paystack sends your payment receipt here.</p>
          </div>
          {error && <div className="notice notice-error">{error}</div>}

          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Taking you to Paystack…" : "Pay with Paystack"}
          </button>
          <p className="hint" style={{ margin: 0 }}>
            You&rsquo;ll pay on Paystack&rsquo;s secure page. We never see your card details.
          </p>
        </form>

        <div className="panel stack">
          <h2>Your order</h2>
          {cart.lines.map((line) => (
            <div className="row-split" key={line.variantId}>
              <span>
                {line.productName}{" "}
                <span className="muted">
                  {line.variantLabel} × {line.quantity}
                </span>
              </span>
              <span className="mono">
                {formatKobo(multiplyKobo(line.unitPriceKobo, line.quantity))}
              </span>
            </div>
          ))}
          <hr className="divider" />
          <div className="row-split">
            <strong>Total</strong>
            <strong style={{ fontSize: 20 }}>{formatKobo(cart.totalKobo)}</strong>
          </div>
        </div>
      </div>
    </>
  );
}
