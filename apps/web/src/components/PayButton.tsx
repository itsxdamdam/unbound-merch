"use client";

import { useState, useTransition } from "react";
import { startPayment } from "@/lib/api";

/**
 * Sends the buyer to Paystack. Separate from checkout because a buyer who
 * abandoned the Paystack tab has a valid pending order and needs a way back in
 * without re-entering anything.
 */
export function PayButton({ referenceCode }: { referenceCode: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const { authorizationUrl } = await startPayment(referenceCode);
              // Another origin, so a full navigation rather than a router push.
              window.location.href = authorizationUrl;
            } catch {
              setError("We couldn't start the payment. Your items are still held — try again.");
            }
          })
        }
      >
        {pending ? "Taking you to Paystack…" : "Pay now"}
      </button>
      {error && <div className="notice notice-error">{error}</div>}
    </>
  );
}
