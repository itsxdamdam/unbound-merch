import type { PrismaClient } from "../generated/client";

export interface ExpirySweepResult {
  expiredOrders: number;
  releasedReservations: number;
}

/**
 * Release stock held by pending orders that ran out of time.
 *
 * `FOR UPDATE SKIP LOCKED` is the reason this needs no Redis and no job queue:
 * if a second worker (or an overlapping tick of the same worker) runs the
 * sweep concurrently, it skips the rows the first one has claimed rather than
 * blocking on them or double-releasing them. That is the whole concurrency
 * story for expiry.
 *
 * Ordering matters below: an order is only marked `expired` if it is STILL
 * `pending_payment` at the moment of the update. A payment confirmed between
 * the claim and the write leaves the order `paid`, and the guarded update
 * touches nothing — the sweep can never un-pay an order.
 */
export async function expireReservations(
  prisma: PrismaClient,
  now: Date = new Date(),
  batchSize = 100,
): Promise<ExpirySweepResult> {
  let expiredOrders = 0;
  let releasedReservations = 0;

  // Loop so a backlog drains fully rather than one batch per tick.
  for (;;) {
    const claimed = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Order"
        WHERE status = 'pending_payment' AND "expiresAt" <= ${now}
        ORDER BY "expiresAt"
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;
      if (rows.length === 0) return 0;

      const ids = rows.map((r) => r.id);

      const updated = await tx.order.updateMany({
        // The status guard is repeated here on purpose: it is what makes a
        // concurrent confirmPayment win the race instead of being overwritten.
        where: { id: { in: ids }, status: "pending_payment" },
        data: { status: "expired" },
      });

      const released = await tx.stockReservation.updateMany({
        where: { orderId: { in: ids }, status: "active" },
        data: { status: "released", settledAt: now },
      });

      await tx.orderEvent.createMany({
        data: ids.map((id) => ({
          orderId: id,
          type: "expired",
          fromStatus: "pending_payment" as const,
          toStatus: "expired" as const,
          actor: "system:expiry",
        })),
      });

      expiredOrders += updated.count;
      releasedReservations += released.count;
      return rows.length;
    });

    if (claimed < batchSize) break;
  }

  return { expiredOrders, releasedReservations };
}
