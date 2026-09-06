/**
 * Integration check for the order lifecycle, run against the live dev database.
 *
 * These are the invariants the whole system rests on, so they are checked
 * end-to-end against real Postgres rather than mocked: the row locking, the
 * SKIP LOCKED sweep, and the unique constraints are precisely the parts a unit
 * test with a fake client would not exercise.
 *
 *   npm run db:verify
 *
 * It creates orders and then cleans up after itself, restoring stock.
 */
import { PrismaClient } from "@prisma/client";
import { createOrder } from "../src/orders/createOrder";
import { confirmPayment } from "../src/orders/confirmPayment";
import { expireReservations } from "../src/orders/expireReservations";
import { availableStock } from "../src/orders/availableStock";
import { InsufficientStockError, PaymentConfirmationError } from "../src/orders/errors";
import { formatKobo } from "../src/money";

import { loadRootEnv } from "../src/env";

// The .env lives at the repo root; these scripts may be run from anywhere.
loadRootEnv();

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
const createdOrderIds: string[] = [];

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  \x1b[31mFAIL\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const buyer = {
  buyerName: "Test Buyer",
  buyerPhone: "+2348012345678",
  deliveryAddress: "12 Test Road, Lagos",
};

async function main() {
  const jerseyL = await prisma.productVariant.findFirstOrThrow({
    where: { product: { slug: "jersey" }, label: "L" },
  });
  const cap = await prisma.productVariant.findFirstOrThrow({
    where: { product: { slug: "cap" } },
  });

  console.log("\n\x1b[1m1. Reservation holds stock without decrementing it\x1b[0m");
  const startAvailable = await availableStock(prisma, jerseyL.id);
  const order = await createOrder(prisma, {
    ...buyer,
    items: [{ variantId: jerseyL.id, quantity: 2 }],
  });
  createdOrderIds.push(order.id);
  const afterReserve = await availableStock(prisma, jerseyL.id);
  const jerseyAfterReserve = await prisma.productVariant.findUniqueOrThrow({
    where: { id: jerseyL.id },
  });
  check("available drops by the reserved quantity", afterReserve === startAvailable - 2,
    `${startAvailable} -> ${afterReserve}`);
  check("on-hand stock is NOT yet decremented",
    jerseyAfterReserve.stockQuantity === jerseyL.stockQuantity,
    `stockQuantity still ${jerseyAfterReserve.stockQuantity}`);
  check("total is computed from DB prices",
    order.totalKobo === jerseyL.priceKobo * 2n,
    formatKobo(order.totalKobo));

  console.log("\n\x1b[1m2. A cart cannot exceed available stock\x1b[0m");
  try {
    await createOrder(prisma, {
      ...buyer,
      items: [{ variantId: jerseyL.id, quantity: afterReserve + 1 }],
    });
    check("oversell is refused", false, "createOrder succeeded when it should not have");
  } catch (error) {
    check("oversell is refused", error instanceof InsufficientStockError,
      error instanceof Error ? error.message : String(error));
  }

  console.log("\n\x1b[1m3. Concurrent checkouts for the last unit cannot both win\x1b[0m");
  const scarce = await prisma.productVariant.findFirstOrThrow({
    where: { product: { slug: "tote-bag" } },
  });
  const scarceAvailable = await availableStock(prisma, scarce.id);
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, () =>
      createOrder(prisma, {
        ...buyer,
        items: [{ variantId: scarce.id, quantity: Math.ceil(scarceAvailable / 2) }],
      }),
    ),
  );
  for (const r of results) {
    if (r.status === "fulfilled") createdOrderIds.push(r.value.id);
  }
  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const finalScarce = await availableStock(prisma, scarce.id);
  check("no more than the available stock was ever handed out", finalScarce >= 0,
    `${fulfilled}/4 concurrent carts succeeded, ${finalScarce} left`);

  console.log("\n\x1b[1m4. A bank alert with the wrong amount cannot confirm\x1b[0m");
  const bogusAlert = await prisma.bankAlert.create({
    data: {
      messageId: `verify-wrong-${Date.now()}@test`,
      mailbox: "INBOX", fromAddress: "alerts@gtbank.com",
      subject: "Credit Alert", rawSource: "(verification fixture)",
      authVerified: true, receivedAt: new Date(),
      parsedAmountKobo: order.totalKobo - 100n, parsedReference: order.referenceCode,
    },
  });
  try {
    await confirmPayment(prisma, order.id, {
      kind: "bank_alert", bankAlertId: bogusAlert.id, amountKobo: order.totalKobo - 100n,
    });
    check("near-miss amount is refused", false, "it confirmed!");
  } catch (error) {
    check("near-miss amount is refused", error instanceof PaymentConfirmationError,
      error instanceof Error ? error.message : String(error));
  }
  const stillPending = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  check("order is still pending after the refused alert",
    stillPending.status === "pending_payment", stillPending.status);

  console.log("\n\x1b[1m5. An exact-amount verified alert confirms, once\x1b[0m");
  const goodAlert = await prisma.bankAlert.create({
    data: {
      messageId: `verify-good-${Date.now()}@test`,
      mailbox: "INBOX", fromAddress: "alerts@gtbank.com",
      subject: "Credit Alert", rawSource: "(verification fixture)",
      authVerified: true, receivedAt: new Date(),
      parsedAmountKobo: order.totalKobo, parsedReference: order.referenceCode,
    },
  });
  const first = await confirmPayment(prisma, order.id, {
    kind: "bank_alert", bankAlertId: goodAlert.id, amountKobo: order.totalKobo,
  });
  const paid = await prisma.productVariant.findUniqueOrThrow({ where: { id: jerseyL.id } });
  check("order transitions to paid", first.changed === true);
  check("on-hand stock is decremented exactly once",
    paid.stockQuantity === jerseyL.stockQuantity - 2,
    `${jerseyL.stockQuantity} -> ${paid.stockQuantity}`);
  const committed = await prisma.stockReservation.findMany({ where: { orderId: order.id } });
  check("reservation is committed, not released",
    committed.every((r) => r.status === "committed"));
  const notifications = await prisma.notification.findMany({ where: { orderId: order.id } });
  check("exactly one buyer notification is queued", notifications.length === 1,
    notifications[0]?.dedupeKey);

  console.log("\n\x1b[1m6. Replaying the same confirmation is a no-op\x1b[0m");
  const second = await confirmPayment(prisma, order.id, {
    kind: "bank_alert", bankAlertId: goodAlert.id, amountKobo: order.totalKobo,
  });
  const afterReplay = await prisma.productVariant.findUniqueOrThrow({ where: { id: jerseyL.id } });
  const afterReplayNotifs = await prisma.notification.findMany({ where: { orderId: order.id } });
  check("replay reports no change", second.changed === false);
  check("replay does not decrement stock again",
    afterReplay.stockQuantity === paid.stockQuantity,
    `still ${afterReplay.stockQuantity}`);
  check("replay does not queue a second message", afterReplayNotifs.length === 1);

  console.log("\n\x1b[1m7. One alert cannot confirm two orders\x1b[0m");
  const otherOrder = await createOrder(prisma, {
    ...buyer, items: [{ variantId: cap.id, quantity: 1 }],
  });
  createdOrderIds.push(otherOrder.id);
  try {
    await confirmPayment(prisma, otherOrder.id, {
      kind: "bank_alert", bankAlertId: goodAlert.id, amountKobo: otherOrder.totalKobo,
    });
    check("re-using a spent alert is refused", false, "it confirmed a second order!");
  } catch (error) {
    check("re-using a spent alert is refused", true,
      `blocked by ${(error as { code?: string }).code ?? "constraint"}`);
  }

  console.log("\n\x1b[1m8. Expiry releases held stock, and cannot un-pay an order\x1b[0m");
  const capBefore = await availableStock(prisma, cap.id);
  const doomed = await createOrder(prisma, {
    ...buyer, items: [{ variantId: cap.id, quantity: 3 }], reservationMinutes: -1,
  });
  createdOrderIds.push(doomed.id);
  const heldDuring = await availableStock(prisma, cap.id);
  const sweep = await expireReservations(prisma);
  const capAfter = await availableStock(prisma, cap.id);
  const doomedRow = await prisma.order.findUniqueOrThrow({ where: { id: doomed.id } });
  check("sweep expires the lapsed order", doomedRow.status === "expired",
    `${sweep.expiredOrders} order(s), ${sweep.releasedReservations} reservation(s)`);
  check("released stock returns to the available pool", capAfter === capBefore,
    `${capBefore} -> held ${heldDuring} -> ${capAfter}`);
  const paidOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  check("the paid order is untouched by the sweep", paidOrder.status === "paid");
}

async function cleanup() {
  // Hand back stock committed by the run, then drop the test rows.
  for (const orderId of createdOrderIds) {
    const reservations = await prisma.stockReservation.findMany({
      where: { orderId, status: "committed" },
    });
    for (const r of reservations) {
      await prisma.productVariant.update({
        where: { id: r.variantId },
        data: { stockQuantity: { increment: r.quantity } },
      });
    }
  }
  await prisma.order.updateMany({
    where: { id: { in: createdOrderIds } },
    data: { confirmingBankAlertId: null },
  });
  await prisma.bankAlert.deleteMany({ where: { rawSource: "(verification fixture)" } });
  await prisma.notification.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
}

main()
  .then(async () => {
    await cleanup();
    console.log(`\n\x1b[1m${passed} passed, ${failed} failed\x1b[0m\n`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    console.error("\nverification aborted:", error);
    await cleanup().catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  });
