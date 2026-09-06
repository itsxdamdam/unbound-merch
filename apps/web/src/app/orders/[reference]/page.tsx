import { notFound } from "next/navigation";
import { prisma } from "@store/db";
import { formatKobo } from "@store/db/money";
import { normalizeReference } from "@store/db/reference";
import { OrderLive } from "@/components/OrderLive";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const code = normalizeReference(decodeURIComponent(reference));
  if (!code) notFound();

  const order = await prisma.order.findUnique({
    where: { referenceCode: code },
    include: { items: true },
  });
  if (!order) notFound();

  const bank = {
    name: process.env.SELLER_BANK_NAME ?? "—",
    accountNumber: process.env.SELLER_ACCOUNT_NUMBER ?? "—",
    accountName: process.env.SELLER_ACCOUNT_NAME ?? "—",
  };

  return (
    <>
      <h1>Order {order.referenceCode}</h1>
      <p className="lede">
        Transfer the exact amount, and put the reference in the narration.
      </p>

      <OrderLive
        expiresAt={order.expiresAt.toISOString()}
        status={order.status}
        reference={order.referenceCode}
      />

      <div className="cols" style={{ marginTop: 22 }}>
        <div className="panel stack">
          <h2>Transfer to</h2>
          <div className="row-split">
            <span className="muted">Bank</span>
            <strong>{bank.name}</strong>
          </div>
          <div className="row-split">
            <span className="muted">Account number</span>
            <strong className="mono" style={{ fontSize: 18, letterSpacing: ".05em" }}>
              {bank.accountNumber}
            </strong>
          </div>
          <div className="row-split">
            <span className="muted">Account name</span>
            <strong>{bank.accountName}</strong>
          </div>
          <hr className="divider" />
          <div className="row-split">
            <span className="muted">Amount — exactly</span>
            <strong style={{ fontSize: 22 }}>{formatKobo(order.totalKobo)}</strong>
          </div>
          <div>
            <span className="muted">Narration / remark</span>
            <div className="ref" style={{ marginTop: 4 }}>{order.referenceCode}</div>
          </div>

          {/* Both of these are how the alert gets matched automatically. A
              buyer who skips them still gets their goods, but only after the
              seller matches it by hand. */}
          <div className="notice notice-info">
            Send the <strong>exact amount</strong> and include{" "}
            <strong>{order.referenceCode}</strong> in the narration. That&rsquo;s what
            confirms your order automatically. A different amount, or a missing
            reference, means we have to check it manually first.
          </div>
        </div>

        <div className="panel stack">
          <h2>Your order</h2>
          {order.items.map((item) => (
            <div className="row-split" key={item.id}>
              <span>
                {item.nameSnapshot}{" "}
                <span className="muted">
                  {item.variantLabelSnapshot} × {item.quantity}
                </span>
              </span>
              <span className="mono">
                {formatKobo(item.unitPriceKobo * BigInt(item.quantity))}
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
          {order.deliveryAddress && (
            <div>
              <span className="muted">Deliver to</span>
              <div>{order.deliveryAddress}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
