import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Available-to-sell for a variant = stock on hand − stock currently held by
 * live reservations.
 *
 * "Live" deliberately means `active AND expiresAt > now`, not merely `active`.
 * The expiry sweep only runs once a minute, so between a reservation lapsing
 * and the sweep releasing it there is a window where the row is still `active`
 * but is no longer holding anything. Counting those would hide sellable stock
 * for up to a minute after every abandoned checkout.
 *
 * This is safe in the one direction that matters: it can briefly under-report
 * a hold, never over-report available stock. The oversell guard does not live
 * here anyway — it lives in the row lock createOrder takes.
 */
export async function availableStock(
  db: Db,
  variantId: string,
  now: Date = new Date(),
): Promise<number> {
  const map = await availableStockFor(db, [variantId], now);
  return map.get(variantId) ?? 0;
}

/** Batched form. One query for the variants, one for the held quantities. */
export async function availableStockFor(
  db: Db,
  variantIds: string[],
  now: Date = new Date(),
): Promise<Map<string, number>> {
  const available = new Map<string, number>();
  if (variantIds.length === 0) return available;

  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, stockQuantity: true },
  });

  const held = await db.stockReservation.groupBy({
    by: ["variantId"],
    where: {
      variantId: { in: variantIds },
      status: "active",
      expiresAt: { gt: now },
    },
    _sum: { quantity: true },
  });

  const heldBy = new Map(held.map((row) => [row.variantId, row._sum.quantity ?? 0]));

  for (const variant of variants) {
    const remaining = variant.stockQuantity - (heldBy.get(variant.id) ?? 0);
    // Never report negative: a manual stock edit downward can legitimately put
    // held above on-hand, and "-2 available" is not a useful thing to render.
    available.set(variant.id, Math.max(0, remaining));
  }

  return available;
}
