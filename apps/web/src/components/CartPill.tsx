"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

// `ready` gates the count: the cart is read from localStorage after mount, and
// a server-rendered number would be a hydration mismatch.
export function CartPill() {
  const { count, ready } = useCart();
  const showCount = ready && count > 0;

  return (
    <Link
      className="cart-link"
      href="/cart"
      aria-label={showCount ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.55L20.5 8H6" />
        <circle cx="10" cy="20" r="1.3" />
        <circle cx="17.5" cy="20" r="1.3" />
      </svg>
      {showCount && <span className="cart-count">{count}</span>}
    </Link>
  );
}
