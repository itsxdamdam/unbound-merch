import type { PrismaClient } from "../generated/client";
import { PaymentConfirmationError } from "./errors";

export type ConfirmationSource =
  | { kind: "bank_alert"; bankAlertId: string; amountKobo: bigint }
  | { kind: "manual_admin"; adminId: string; note: string };

export interface ConfirmPaymentResult {
  /** False when the order was already paid — the call was a no-op. */
  changed: boolean;
  orderId: string;
  referenceCode: string;
}

/**
 * THE single path by which an Order becomes `paid`. Nothing else in this
 * codebase may write `status: "paid"`.
 *
 * Everything that makes the system trustworthy is enforced here rather than at
 * the call sites, because call sites multiply and this file does not:
 *
 *  - A bank alert confirms only if its parsed amount EXACTLY equals the order
 *    total. Near-misses are logged and refused, never rounded into a match.
 *  - `Order.confirmingBankAlertId` is `@unique` in the schema, so one alert
 *    physically cannot confirm two orders even if the matcher has a bug.
 *  - Idempotent: re-running against an already-paid order returns
 *    `changed: false` instead of decrementing stock a second time.
 *  - The buyer notification is an outbox row with a unique `dedupeKey`, so a
 *    double-confirm cannot produce a double-message.
 */
export async function confirmPayment(
  prisma: PrismaClient,
  orderId: string,
  source: ConfirmationSource,
): Promise<ConfirmPaymentResult> {
  return prisma.$transaction(async (tx) => {
    // Lock the order row first: two alerts landing for the same reference in
    // the same second must serialise, or both pass the status check.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { reservations: true },
    });
    if (!order) throw new PaymentConfirmationError(orderId, "Order not found.");

    // Idempotency, before any guard that could throw: replaying the same alert
    // is a normal event (IMAP redelivery), not an error.
    if (order.status === "paid") {
      return { changed: false, orderId: order.id, referenceCode: order.referenceCode };
    }

    if (order.status === "cancelled") {
      throw new PaymentConfirmationError(
        orderId,
        "Order was cancelled. Refund or re-order manually — do not auto-confirm.",
      );
    }

    // An expired order whose money genuinely arrived is a real situation, but
    // its stock has already been handed back to other buyers. That is a human
    // decision (refund, or re-reserve if still in stock), never an automatic
    // one — so a bank alert may not resurrect it.
    if (order.status === "expired" && source.kind === "bank_alert") {
      throw new PaymentConfirmationError(
        orderId,
        "Payment arrived after the reservation expired and stock was released. " +
          "Needs a human: confirm stock is still available, then confirm manually.",
      );
    }

    if (source.kind === "bank_alert") {
      if (source.amountKobo !== order.totalKobo) {
        throw new PaymentConfirmationError(
          orderId,
          `Amount mismatch: alert ${source.amountKobo} kobo vs order ${order.totalKobo} kobo.`,
        );
      }
    }

    const now = new Date();

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "paid",
        paidAt: now,
        paymentSource: source.kind,
        confirmingBankAlertId: source.kind === "bank_alert" ? source.bankAlertId : undefined,
        confirmedByAdminId: source.kind === "manual_admin" ? source.adminId : undefined,
      },
    });

    // Commit the holds: the stock is now sold, not merely reserved. Only
    // `active` rows are touched, which is what keeps a re-run from
    // decrementing twice.
    for (const reservation of order.reservations) {
      if (reservation.status !== "active") continue;
      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: "committed", settledAt: now },
      });
      await tx.productVariant.update({
        where: { id: reservation.variantId },
        data: { stockQuantity: { decrement: reservation.quantity } },
      });
    }

    if (source.kind === "bank_alert") {
      await tx.bankAlert.update({
        where: { id: source.bankAlertId },
        data: { parseStatus: "matched", matchedOrderId: order.id, processedAt: now },
      });
    }

    // Outbox, not a direct send. The web app never talks to WhatsApp; the
    // worker drains this. The dedupeKey is what makes a double-confirm
    // incapable of double-messaging.
    await tx.notification.createMany({
      data: [
        {
          dedupeKey: `order:${order.id}:paid:buyer`,
          orderId: order.id,
          channel: "whatsapp",
          toPhone: order.buyerPhone,
          body: buyerPaidMessage(order.referenceCode, order.buyerName),
        },
      ],
      skipDuplicates: true,
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "paid",
        fromStatus: order.status,
        toStatus: "paid",
        actor: source.kind === "bank_alert" ? "system:matcher" : `admin:${source.adminId}`,
        detail:
          source.kind === "bank_alert"
            ? { bankAlertId: source.bankAlertId, amountKobo: source.amountKobo.toString() }
            : { note: source.note },
      },
    });

    return { changed: true, orderId: order.id, referenceCode: order.referenceCode };
  });
}

/**
 * Kept short and specific. One reference, no link, no marketing — see the
 * ban-risk notes in PROPOSAL.md; link-heavy repeated bodies are what get a
 * number classified as spam.
 */
function buyerPaidMessage(referenceCode: string, buyerName: string): string {
  const firstName = buyerName.trim().split(/\s+/)[0] || "there";
  return `Hi ${firstName}, we've received your payment for order ${referenceCode}. We're preparing it now and will message you when it ships. Thank you!`;
}
