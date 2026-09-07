"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, verifyPayment } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { forgetReference, recallReference } from "@/lib/payment-reference";
import { useCart } from "@/lib/cart";
import type { PaymentVerification } from "@/lib/types";

/**
 * Where Paystack returns the buyer. The redirect itself proves nothing — anyone
 * can reach this URL — so only the backend's verify call decides.
 */
export default function PaymentCompletePage() {
  return (
    <Suspense fallback={<p className="empty">Checking your payment…</p>}>
      <PaymentComplete />
    </Suspense>
  );
}

type State =
  | { phase: "checking" }
  | { phase: "done"; result: PaymentVerification }
  | { phase: "error"; message: string }
  | { phase: "no-reference" };

function PaymentComplete() {
  const searchParams = useSearchParams();
  const { clear } = useCart();
  const [state, setState] = useState<State>({ phase: "checking" });

  // Paystack appends both; `reference` is ours, `trxref` is theirs, and they
  // are normally identical.
  const reference =
    searchParams.get("reference") ?? searchParams.get("trxref") ?? null;

  useEffect(() => {
    const target = reference ?? recallReference();
    if (!target) {
      setState({ phase: "no-reference" });
      return;
    }

    let cancelled = false;
    verifyPayment(target)
      .then((result) => {
        if (cancelled) return;
        setState({ phase: "done", result });
        // Only on a confirmed payment: a failed attempt keeps the basket.
        if (result.paid) {
          clear();
          forgetReference();
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const unknownReference = error instanceof ApiError && error.status === 404;
        setState({
          phase: "error",
          message: unknownReference
            ? "We have no record of this payment reference."
            : error instanceof Error
              ? error.message
              : "Could not reach the payment service.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [reference, clear]);

  if (state.phase === "checking") {
    return <p className="empty">Checking your payment…</p>;
  }

  if (state.phase === "no-reference") {
    return (
      <>
        <h1>Payment</h1>
        <div className="notice notice-warn">
          <strong>No payment reference.</strong> If you just paid, check your email for
          the Paystack receipt and send us the reference — we&rsquo;ll pick it up from
          there.
        </div>
        <p style={{ marginTop: 20 }}>
          <Link className="btn btn-secondary" href="/">Back to the shop</Link>
        </p>
      </>
    );
  }

  if (state.phase === "error") {
    return (
      <>
        <h1>Payment</h1>
        <div className="notice notice-error">
          <strong>We couldn&rsquo;t confirm this payment.</strong> {state.message}
          <br />
          Do not pay again — message us and we&rsquo;ll check it by hand.
        </div>
        <p style={{ marginTop: 20 }}>
          <Link className="btn btn-secondary" href="/">Back to the shop</Link>
        </p>
      </>
    );
  }

  const { result } = state;

  return (
    <>
      <h1>{result.paid ? "Payment received" : "Payment not completed"}</h1>

      {result.paid ? (
        <div className="notice" style={{ background: "#e7f3ec", borderColor: "#b8ddc7" }}>
          <strong>Thank you.</strong> We&rsquo;ve got your payment and we&rsquo;ll be in
          touch to arrange delivery.
        </div>
      ) : (
        <div className="notice notice-warn">
          <strong>This payment didn&rsquo;t go through</strong> — Paystack reports{" "}
          <span className="mono">{result.status}</span>. Your items are still in your
          cart, so you can try again.
        </div>
      )}

      <div className="panel stack" style={{ marginTop: 22, maxWidth: 460 }}>
        {result.items.length > 0 && (
          <>
            {result.items.map((item, index) => (
              <div className="row-split" key={`${item.name}-${item.size}-${index}`}>
                <span>
                  {item.name}{" "}
                  <span className="muted">
                    {item.size} × {item.quantity}
                  </span>
                </span>
                <span className="mono">{formatNaira(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            <hr className="divider" />
          </>
        )}

        {result.amount != null && (
          <div className="row-split">
            <strong>Total</strong>
            <strong style={{ fontSize: 20 }}>{formatNaira(result.amount)}</strong>
          </div>
        )}
        <div className="row-split">
          <span className="muted">Reference</span>
          <span className="mono">{result.reference}</span>
        </div>
        <div className="row-split">
          <span className="muted">Status</span>
          <span className="mono">{result.status}</span>
        </div>
        {result.channel && (
          <div className="row-split">
            <span className="muted">Paid by</span>
            <span>{result.channel}</span>
          </div>
        )}
      </div>

      <p style={{ marginTop: 20 }}>
        <Link className="btn btn-secondary" href={result.paid ? "/" : "/checkout"}>
          {result.paid ? "Back to the shop" : "Try again"}
        </Link>
      </p>
    </>
  );
}
