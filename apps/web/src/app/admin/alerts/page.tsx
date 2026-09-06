import Link from "next/link";
import { prisma } from "@store/db";
import { formatKobo } from "@store/db/money";
import { SimulateAlertForm } from "@/components/SimulateAlertForm";

export const dynamic = "force-dynamic";

const TZ = process.env.DISPLAY_TIMEZONE || "Africa/Lagos";

export default async function AlertsPage() {
  const alerts = await prisma.bankAlert.findMany({
    orderBy: { receivedAt: "desc" },
    take: 50,
    include: { matchedOrder: { select: { referenceCode: true } } },
  });

  const allowlist = process.env.ALERT_SENDER_ALLOWLIST ?? "";

  return (
    <>
      <div className="row-split" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>Bank alerts</h1>
        <Link href="/admin">← Orders</Link>
      </div>
      <p className="lede">
        Every message the alert mailbox receives, verified or not. Nothing here can
        confirm an order unless its sender passed DKIM for an allowlisted domain.
      </p>

      {allowlist ? (
        <div className="notice notice-info" style={{ marginBottom: 20 }}>
          Trusting alerts from: <strong className="mono">{allowlist}</strong> — and only
          when the mailbox provider reports DKIM (or SPF) pass for that domain.
        </div>
      ) : (
        <div className="notice notice-warn" style={{ marginBottom: 20 }}>
          <strong>ALERT_SENDER_ALLOWLIST is empty</strong>, so every alert will be rejected
          and nothing can auto-confirm. That is the safe default, not a bug.
        </div>
      )}

      <SimulateAlertForm />

      <div className="panel" style={{ marginTop: 22 }}>
        {alerts.length === 0 ? (
          <p className="empty">No alerts yet. Paste one above to exercise the pipeline.</p>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Received</th>
                  <th>From</th>
                  <th>Status</th>
                  <th>Parsed</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "short", timeStyle: "short", timeZone: TZ,
                      }).format(alert.receivedAt)}
                    </td>
                    <td>
                      <div className="mono" style={{ fontSize: 12 }}>{alert.fromAddress}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{alert.subject}</div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className={`badge badge-${alert.parseStatus}`}>
                        {alert.parseStatus.replace("_", " ")}
                      </span>
                      <div style={{ fontSize: 11, marginTop: 3 }}>
                        {alert.authVerified ? (
                          <span style={{ color: "var(--accent)" }}>sender verified</span>
                        ) : (
                          <span style={{ color: "var(--danger)" }}>unverified</span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {alert.parsedAmountKobo != null && (
                        <div className="mono">{formatKobo(alert.parsedAmountKobo)}</div>
                      )}
                      {alert.parsedReference && (
                        <div className="mono muted">{alert.parsedReference}</div>
                      )}
                      {alert.matchedOrder && (
                        <Link href={`/orders/${alert.matchedOrder.referenceCode}`}>
                          → {alert.matchedOrder.referenceCode}
                        </Link>
                      )}
                      {alert.parsedAmountKobo == null && !alert.parsedReference && (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: 11, maxWidth: 340 }}>
                      <div style={{ whiteSpace: "pre-wrap" }}>
                        {alert.parseNotes || alert.authDetail || "—"}
                      </div>
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
