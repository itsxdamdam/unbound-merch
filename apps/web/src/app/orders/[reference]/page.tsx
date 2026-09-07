import { notFound } from "next/navigation";
import { formatKobo, multiplyKobo } from "@/lib/money";
import { getOrder } from "@/lib/api";
import { isApiConfigured } from "@/lib/api";
import { OrderLive } from "@/components/OrderLive";
import { PayButton } from "@/components/PayButton";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  // Orders live entirely on the backend — there is no local store to fall back
  // to, so this page is honest about needing one rather than inventing data.
  if (!isApiConfigured()) {
    return (
      <>
        <h1>Order {decodeURIComponent(reference)}</h1>
        <div className="notice notice-warn">
          <strong>No backend configured.</strong> Set <code>NEXT_PUBLIC_API_URL</code> to
          look orders up. The catalogue renders from placeholder data, but orders
          cannot.
        </div>
      </>
    );
  }

  const order = await getOrder(decodeURIComponent(reference));
  if (!order) notFound();

  return (
    <>
      <h1>Order {order.referenceCode}</h1>
      <p className="lede">
        {order.status === "pending_payment"
          ? "Your items are held until you complete payment."
          : "Thanks for your order."}
      </p>

      <OrderLive
        expiresAt={order.expiresAt}
        status={order.status}
        reference={order.referenceCode}
      />

      <div className="cols" style={{ marginTop: 22 }}>
        <div className="panel stack">
          <h2>Payment</h2>
          <div className="row-split">
            <span className="muted">Amount</span>
            <strong style={{ fontSize: 22 }}>{formatKobo(order.totalKobo)}</strong>
          </div>
          <div className="row-split">
            <span className="muted">Reference</span>
            <span className="mono">{order.referenceCode}</span>
          </div>

          {order.status === "pending_payment" && (
            <>
              <hr className="divider" />
              {/* For a buyer who closed the Paystack tab and came back. The
                  hold is still theirs until it expires. */}
              <PayButton referenceCode={order.referenceCode} />
              <p className="hint" style={{ margin: 0 }}>
                You pay on Paystack&rsquo;s secure page — card, bank transfer or USSD.
                We never see your card details.
              </p>
            </>
          )}

          {order.status === "paid" && (
            <>
              <hr className="divider" />
              <p className="muted" style={{ margin: 0 }}>
                Paid. We&rsquo;ve sent a WhatsApp message to {order.buyerPhone} asking
                where to deliver it.
              </p>
            </>
          )}
        </div>

        <div className="panel stack">
          <h2>Your order</h2>
          {order.items.map((item, index) => (
            <div className="row-split" key={`${item.name}-${item.variantLabel}-${index}`}>
              <span>
                {item.name}{" "}
                <span className="muted">
                  {item.variantLabel} × {item.quantity}
                </span>
              </span>
              <span className="mono">
                {formatKobo(multiplyKobo(item.unitPriceKobo, item.quantity))}
              </span>
            </div>
          ))}
          <hr className="divider" />
          <div className="row-split">
            <strong>Total</strong>
            <strong style={{ fontSize: 20 }}>{formatKobo(order.totalKobo)}</strong>
          </div>
          <hr className="divider" />
          <div className="row-split">
            <span className="muted">Name</span>
            <span>{order.buyerName}</span>
          </div>
          <div className="row-split">
            <span className="muted">WhatsApp</span>
            <span className="mono">{order.buyerPhone}</span>
          </div>
          <div className="row-split">
            <span className="muted">Email</span>
            <span className="mono">{order.buyerEmail}</span>
          </div>
        </div>
      </div>
    </>
  );
}
