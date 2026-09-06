// Prisma is a value import, not a type-only one: Prisma.join builds the
// FOR UPDATE lock query below.
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { generateReferenceCode } from "../reference";
import { EmptyCartError, InsufficientStockError } from "./errors";

export interface CartLine {
  variantId: string;
  quantity: number;
}

export interface CreateOrderInput {
  items: CartLine[];
  buyerName: string;
  buyerPhone: string;
  deliveryAddress?: string | null;
  /** Defaults to RESERVATION_MINUTES. */
  reservationMinutes?: number;
}

function reservationMinutes(explicit?: number): number {
  if (explicit != null) return explicit;
  const parsed = Number(process.env.RESERVATION_MINUTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

/**
 * Create a pending order and hold its stock, atomically.
 *
 * Two things here are load-bearing:
 *
 * 1. **The total is computed from the database, never from the request.**
 *    The client sends variant ids and quantities and nothing else. If the
 *    browser could contribute a price, a buyer could order a ₦17,000 jersey
 *    for ₦1 and the bank alert for ₦1 would legitimately confirm it.
 *
 * 2. **The variant rows are locked FOR UPDATE before availability is read.**
 *    Without the lock, two concurrent checkouts for the last item both read
 *    "1 available", both pass the check, and both reserve it. The lock
 *    serialises that pair so the second sees the first's reservation.
 */
export async function createOrder(
  prisma: PrismaClient,
  input: CreateOrderInput,
): Promise<{ id: string; referenceCode: string; totalKobo: bigint; expiresAt: Date }> {
  // Collapse duplicate lines up front: the schema has one reservation row per
  // (order, variant), so two cart lines for the same size must become qty 2.
  const merged = new Map<string, number>();
  for (const line of input.items) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error(`Invalid quantity for ${line.variantId}: ${line.quantity}`);
    }
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
  }
  if (merged.size === 0) throw new EmptyCartError();

  const variantIds = [...merged.keys()].sort(); // Sorted: deadlock-free lock order.
  const minutes = reservationMinutes(input.reservationMinutes);

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + minutes * 60_000);

    // Take the row locks. Sorted ids mean two concurrent carts touching the
    // same variants always grab them in the same order, so they queue instead
    // of deadlocking.
    await tx.$queryRaw`
      SELECT id FROM "ProductVariant"
      WHERE id IN (${Prisma.join(variantIds)})
      ORDER BY id
      FOR UPDATE
    `;

    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: { select: { name: true, active: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    // Held quantities, read INSIDE the lock so they cannot be stale.
    const held = await tx.stockReservation.groupBy({
      by: ["variantId"],
      where: { variantId: { in: variantIds }, status: "active", expiresAt: { gt: now } },
      _sum: { quantity: true },
    });
    const heldBy = new Map(held.map((r) => [r.variantId, r._sum.quantity ?? 0]));

    let totalKobo = 0n;
    const itemRows: Prisma.OrderItemCreateManyOrderInput[] = [];
    const reservationRows: Prisma.StockReservationCreateManyOrderInput[] = [];

    for (const variantId of variantIds) {
      const quantity = merged.get(variantId)!;
      const variant = byId.get(variantId);

      if (!variant || !variant.active || !variant.product.active) {
        throw new InsufficientStockError(variantId, quantity, 0, "this item");
      }

      const label = `${variant.product.name} (${variant.label})`;
      const available = variant.stockQuantity - (heldBy.get(variantId) ?? 0);
      if (available < quantity) {
        throw new InsufficientStockError(variantId, quantity, Math.max(0, available), label);
      }

      totalKobo += variant.priceKobo * BigInt(quantity);
      itemRows.push({
        variantId,
        quantity,
        unitPriceKobo: variant.priceKobo,
        nameSnapshot: variant.product.name,
        variantLabelSnapshot: variant.label,
      });
      reservationRows.push({ variantId, quantity, status: "active", expiresAt });
    }

    // Reference codes are random over ~24M values, so a collision is rare but
    // not impossible. Retry a few times rather than failing a paid-intent
    // checkout on a coin flip.
    let order: { id: string; referenceCode: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const referenceCode = generateReferenceCode();
      try {
        order = await tx.order.create({
          data: {
            referenceCode,
            status: "pending_payment",
            totalKobo,
            buyerName: input.buyerName.trim(),
            buyerPhone: input.buyerPhone.trim(),
            deliveryAddress: input.deliveryAddress?.trim() || null,
            expiresAt,
            items: { createMany: { data: itemRows } },
            reservations: { createMany: { data: reservationRows } },
          },
          select: { id: true, referenceCode: true },
        });
        break;
      } catch (error) {
        const isCollision =
          typeof error === "object" &&
          error !== null &&
          (error as { code?: string }).code === "P2002" &&
          String((error as { meta?: { target?: string[] } }).meta?.target).includes(
            "referenceCode",
          );
        if (!isCollision) throw error;
      }
    }
    if (!order) throw new Error("Could not allocate a unique reference code.");

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "created",
        toStatus: "pending_payment",
        actor: "system:checkout",
        detail: {
          totalKobo: totalKobo.toString(),
          expiresAt: expiresAt.toISOString(),
          items: itemRows.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPriceKobo: i.unitPriceKobo.toString(),
          })),
        },
      },
    });

    return { id: order.id, referenceCode: order.referenceCode, totalKobo, expiresAt };
  });
}
