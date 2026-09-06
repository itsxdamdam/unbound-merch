import type { PrismaClient } from "@prisma/client";
import { checkQuota, configFromEnv, inQuietHours } from "../whatsapp/governor";
import { sendWhatsAppMessage, type WhatsAppDriver } from "../whatsapp/send";

const MAX_ATTEMPTS = 5;

/**
 * Send queued notifications, one at a time, under the governor.
 *
 * One per tick is deliberate. The governor enforces a minimum gap between
 * sends, so draining a backlog in a tight loop would either violate it or
 * require sleeping inside the job; letting the 60s tick do the pacing keeps
 * the cadence irregular for free and means a backlog drains steadily rather
 * than as a burst — and bursts are the pattern that gets numbers banned.
 *
 * Nothing here can lose a message: a failed send increments `attempts` and
 * sets `nextAttemptAt`, and a dead WhatsApp session simply leaves rows
 * `pending` until a number is paired again.
 */
export async function drainOutbox(
  prisma: PrismaClient,
  driver: WhatsAppDriver,
): Promise<void> {
  const cfg = configFromEnv();
  const now = new Date();
  const timeZone = process.env.DISPLAY_TIMEZONE || "Africa/Lagos";

  if (!driver.isReady()) return;

  // Order confirmations are time-sensitive enough to be worth sending late at
  // night; anything non-urgent added later should check inQuietHours() here.
  if (inQuietHours(cfg, now, timeZone)) {
    // Payment confirmations still go out — a buyer who just paid at 23:00 is
    // actively waiting and will not report it as spam.
  }

  const next = await prisma.notification.findFirst({
    where: { status: "pending", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
  });
  if (!next) return;

  const verdict = await checkQuota(prisma, cfg, now);
  if (!verdict.allow) {
    console.log(`  [outbox] holding: ${verdict.reason}`);
    await prisma.notification.update({
      where: { id: next.id },
      data: { nextAttemptAt: new Date(now.getTime() + verdict.retryAfterMs) },
    });
    return;
  }

  const result = await sendWhatsAppMessage(prisma, driver, {
    phone: next.toPhone,
    body: next.body,
    orderId: next.orderId,
  });

  if (result.ok) {
    await prisma.notification.update({
      where: { id: next.id },
      data: { status: "sent", sentAt: new Date(), attempts: { increment: 1 } },
    });
    console.log(`  [outbox] sent ${next.dedupeKey}`);
    return;
  }

  const attempts = next.attempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  await prisma.notification.update({
    where: { id: next.id },
    data: {
      // `dead` rather than dropped: an undelivered payment confirmation is
      // something a human needs to see, not something to silently discard.
      status: exhausted ? "dead" : "pending",
      attempts,
      lastError: result.error ?? "unknown send failure",
      // Exponential backoff, capped at ~30 min.
      nextAttemptAt: new Date(Date.now() + Math.min(30 * 60_000, 2 ** attempts * 5_000)),
    },
  });
  console.log(
    `  [outbox] ${exhausted ? "DEAD" : "retry"} ${next.dedupeKey}: ${result.error}`,
  );
}
