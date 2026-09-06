import type { PrismaClient } from "@store/db/prisma";
import { expireReservations } from "@store/db/orders";

export async function runExpirySweep(prisma: PrismaClient): Promise<void> {
  const result = await expireReservations(prisma);
  if (result.expiredOrders > 0) {
    console.log(
      `  [expiry] expired ${result.expiredOrders} order(s), released ${result.releasedReservations} reservation(s)`,
    );
  }
}
