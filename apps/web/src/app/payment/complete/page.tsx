"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, verifyPayment } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { forgetReference, recallReference } from "@/lib/payment-reference";
import { useCart } from "@/lib/cart";
import type { PaymentVerification } from "@/lib/types";

// Where Paystack returns the buyer. The redirect proves nothing; only the
// backend's verify call decides.
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

  // Paystack appends both, normally identical.
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
  const outcome = describe(result);

  return (
    <>
      <h1>{outcome.title}</h1>

      <div className={`notice ${outcome.tone}`}>
        <strong>{outcome.headline}</strong> {outcome.detail}
      </div>

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
        <Link className="btn btn-secondary" href={outcome.retry ? "/checkout" : "/"}>
          {outcome.retry ? "Try again" : "Back to the shop"}
        </Link>
      </p>
    </>
  );
}

interface Outcome {
  title: string;
  headline: string;
  detail: string;
  tone: string;
  retry: boolean;
}

// Paystack's transaction statuses. Anything unrecognised is treated as not
// paid and sent to a human rather than guessed at.
function describe(result: PaymentVerification): Outcome {
  if (result.paid) {
    return {
      title: "Payment received",
      headline: "Thank you.",
      detail: "We\u2019ve gotten your payment and we\u2019ll be in touch for pickup location.",
      tone: "notice-ok",
      retry: false,
    };
  }

  switch (result.status.toLowerCase()) {
    case "failed":
      return {
        title: "Payment declined",
        headline: "Your bank declined the payment.",
        detail:
          "Nothing was charged. This is usually an insufficient balance, a card limit, " +
          "or a block on online payments \u2014 trying another card or your bank app often works. " +
          "Your items are still in your cart.",
        tone: "notice-error",
        retry: true,
      };

    case "abandoned":
      return {
        title: "Payment not completed",
        headline: "The payment was cancelled before it finished.",
        detail: "Nothing was charged, and your items are still in your cart.",
        tone: "notice-warn",
        retry: true,
      };

    case "reversed":
      return {
        title: "Payment reversed",
        headline: "This payment was reversed.",
        detail:
          "Any amount taken is on its way back to you. Nothing is owed, and you can " +
          "order again whenever you like.",
        tone: "notice-warn",
        retry: true,
      };

    case "pending":
    case "ongoing":
    case "queued":
      return {
        title: "Payment pending",
        headline: "Your bank hasn\u2019t finished this payment yet.",
        detail:
          "Do not pay again \u2014 refresh this page in a minute. Bank transfers and USSD " +
          "can take a few minutes to settle.",
        tone: "notice-warn",
        retry: false,
      };

    default:
      return {
        title: "Payment not completed",
        headline: "This payment did not go through.",
        detail:
          `Paystack reports \u201c${result.status}\u201d. Nothing was charged and your items ` +
          "are still in your cart. If you think you were charged, message us with the " +
          "reference below rather than paying again.",
        tone: "notice-warn",
        retry: true,
      };
  }
}
