"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export function CartPill() {
  const { count, ready } = useCart();
  // Render the same markup on server and first client paint; the count only
  // appears once localStorage has been read.
  return (
    <Link className="cart-pill" href="/cart">
      Cart{ready && count > 0 ? ` · ${count}` : ""}
    </Link>
  );
}
