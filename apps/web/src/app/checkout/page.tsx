"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/money";
import { useCart } from "@/lib/cart";
import { resolveCart, type ResolvedCart } from "@/lib/catalog";
import { initializePayment } from "@/lib/api";
import { rememberReference } from "@/lib/payment-reference";

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
    const resolved = cart;
    if (!resolved) return;

    startTransition(async () => {
      try {
        const { authorizationUrl, reference } = await initializePayment({
          amount: resolved.total,
          customerName: String(formData.get("name") ?? ""),
          customerEmail: String(formData.get("email") ?? ""),
          customerPhone: String(formData.get("phone") ?? ""),
          callbackUrl: `${window.location.origin}/payment/complete`,
          items: resolved.lines.map((line) => ({
            name: line.productName,
            size: line.variantLabel,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        });

        if (reference) rememberReference(reference);

        window.location.href = authorizationUrl;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
        );
      }
    });
  }

  return (
    <>
      <h1>Checkout</h1>
      <div className="cols">
        <form className="panel stack" action={onSubmit}>
          <div>
            <label htmlFor="name">Full name</label>
            <input id="name" name="name" required autoComplete="name" />
          </div>
          <div>
            <label htmlFor="phone">Whatsapp Number</label>
            <input
              id="phone"
              name="phone"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="08012345678"
            />
          </div>
          <span className="hint">
            Please ensure this is the correct number. We&rsquo;ll use this to
            contact you about your order.
          </span>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              required
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
            />
            <p className="hint">Paystack sends your payment receipt here.</p>
          </div>
          {error && <div className="notice notice-error">{error}</div>}

          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Taking you to Paystack…" : "Pay with Paystack"}
          </button>
          <p className="hint" style={{ margin: 0 }}>
            You&rsquo;ll pay on Paystack&rsquo;s secure page. We never see your
            card details.
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
                {formatNaira(line.unitPrice * line.quantity)}
              </span>
            </div>
          ))}
          <hr className="divider" />
          <div className="row-split">
            <strong>Total</strong>
            <strong style={{ fontSize: 20 }}>{formatNaira(cart.total)}</strong>
          </div>
        </div>
      </div>
    </>
  );
}
