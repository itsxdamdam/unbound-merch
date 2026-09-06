import Link from "next/link";
import { prisma } from "@store/db";
import { formatKobo } from "@store/db/money";
import { ConfirmButton } from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

const TZ = process.env.DISPLAY_TIMEZONE || "Africa/Lagos";

function when(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: TZ,
  }).format(date);
}

export default async function AdminPage() {
  const [orders, counts, pendingAlerts, outbox] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: true },
    }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.bankAlert.count({
      where: { parseStatus: { in: ["pending", "unmatched", "parse_failed", "rejected"] } },
    }),
    prisma.notification.count({ where: { status: { in: ["pending", "failed"] } } }),
  ]);

  const byStatus = new Map(counts.map((c) => [c.status, c._count]));

  return (
    <>
      <div className="row-split" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>Orders</h1>
        <Link href="/admin/alerts">
          Bank alerts{pendingAlerts > 0 ? ` (${pendingAlerts})` : ""} →
        </Link>
      </div>
      <p className="lede">
        All times {TZ}. {outbox} message(s) waiting in the outbox.
      </p>

      <div className="chips">
        {["pending_payment", "paid", "manual_review", "expired", "cancelled"].map((s) => (
          <span className="chip" key={s}>
            {s.replace("_", " ")} · {byStatus.get(s as never) ?? 0}
          </span>
        ))}
      </div>

      <div className="panel">
        {orders.length === 0 ? (
          <p className="empty">No orders yet. Place one from the shop to see it here.</p>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Buyer</th>
                  <th>Items</th>
                  <th className="num">Total</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link className="mono" href={`/orders/${order.referenceCode}`}>
                        {order.referenceCode}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge badge-${order.status}`}>
                        {order.status.replace("_", " ")}
                      </span>
                      {order.paymentSource && (
                        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                          via {order.paymentSource.replace("_", " ")}
                        </div>
                      )}
                    </td>
                    <td>
                      {order.buyerName}
                      <div className="muted mono" style={{ fontSize: 11 }}>{order.buyerPhone}</div>
                    </td>
                    <td>
                      {order.items.map((i) => (
                        <div key={i.id} style={{ fontSize: 12 }}>
                          {i.quantity}× {i.nameSnapshot}{" "}
                          <span className="muted">{i.variantLabelSnapshot}</span>
                        </div>
                      ))}
                    </td>
                    <td className="num">{formatKobo(order.totalKobo)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{when(order.createdAt)}</td>
                    <td>
                      {order.status === "paid" ? (
                        <span className="muted" style={{ fontSize: 12 }}>
                          {order.paidAt ? when(order.paidAt) : "—"}
                        </span>
                      ) : order.status === "cancelled" ? (
                        <span className="muted" style={{ fontSize: 12 }}>—</span>
                      ) : (
                        <ConfirmButton orderId={order.id} reference={order.referenceCode} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
