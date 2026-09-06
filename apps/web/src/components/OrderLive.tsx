"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";

/**
 * Countdown + status poller for the payment page.
 *
 * The buyer is sitting on this page in another app's queue waiting for a
 * transfer to land, so the page has to tell them the truth on its own: it
 * polls for the status change instead of asking them to refresh.
 */
export function OrderLive({
  expiresAt,
  status,
  reference,
}: {
  expiresAt: string;
  status: string;
  reference: string;
}) {
  const router = useRouter();
  const { clear } = useCart();
  const [remaining, setRemaining] = useState(() => msLeft(expiresAt));

  // The order exists now, so the basket has served its purpose. Clearing here
  // rather than at checkout means a failed checkout keeps the buyer's items.
  useEffect(() => { clear(); }, [clear]);

  useEffect(() => {
    if (status !== "pending_payment") return;
    const tick = setInterval(() => setRemaining(msLeft(expiresAt)), 1000);
    // Poll for the worker confirming payment. 5s is frequent enough to feel
    // instant and light enough for a single-seller shop.
    const poll = setInterval(() => router.refresh(), 5000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [expiresAt, status, router]);

  if (status === "paid") {
    return (
      <div className="notice" style={{ background: "#e7f3ec", borderColor: "#b8ddc7" }}>
        <strong>Payment received.</strong> We&rsquo;ve got your transfer for {reference} and
        we&rsquo;re preparing your order. You&rsquo;ll get a WhatsApp message shortly.
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="notice notice-error">
        <strong>This order expired</strong> and the items went back on sale. If you already
        sent the money, don&rsquo;t send it again — message us with reference {reference} and
        we&rsquo;ll sort it out by hand.
      </div>
    );
  }

  if (status !== "pending_payment") {
    return <div className="notice notice-info">This order is {status.replace("_", " ")}.</div>;
  }

  if (remaining <= 0) {
    return (
      <div className="notice notice-warn">
        <strong>Time&rsquo;s up.</strong> Checking whether your transfer arrived in time…
      </div>
    );
  }

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const urgent = remaining < 5 * 60_000;

  return (
    <div className="notice notice-warn">
      <strong style={{ color: urgent ? "var(--danger)" : undefined }}>
        {minutes}:{String(seconds).padStart(2, "0")} left
      </strong>{" "}
      to complete your transfer. We&rsquo;re watching for it — this page updates itself.
    </div>
  );
}

function msLeft(iso: string): number {
  return Math.max(0, new Date(iso).getTime() - Date.now());
}
