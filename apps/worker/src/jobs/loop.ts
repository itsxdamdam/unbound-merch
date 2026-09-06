import type { PrismaClient } from "@store/db/prisma";
import type { WhatsAppDriver } from "../whatsapp/send";
import { runExpirySweep } from "./expireReservations.job";
import { processPendingAlerts } from "./processAlerts.job";
import { drainOutbox } from "./drainOutbox.job";

export const TICK_MS = 60_000;

/**
 * One tick. Each job is isolated: a throw in one must not stop the others,
 * because a parser crash on a malformed email should never also stop stock
 * from being released back to the shop.
 */
export async function tick(prisma: PrismaClient, driver: WhatsAppDriver): Promise<void> {
  for (const [name, job] of [
    ["expiry", () => runExpirySweep(prisma)],
    ["alerts", () => processPendingAlerts(prisma)],
    ["outbox", () => drainOutbox(prisma, driver)],
  ] as const) {
    try {
      await job();
    } catch (error) {
      console.error(`  [${name}] job failed:`, error);
    }
  }
}

/**
 * Run ticks forever, non-overlapping. `setInterval` is wrong here: if a tick
 * ever runs longer than the interval they pile up and the sweep starts racing
 * itself. Chaining the next timer only after the current tick settles keeps
 * exactly one in flight.
 */
export function startLoop(
  prisma: PrismaClient,
  driver: WhatsAppDriver,
  intervalMs = TICK_MS,
): { stop: () => void } {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const run = async () => {
    if (stopped) return;
    await tick(prisma, driver);
    if (!stopped) timer = setTimeout(run, intervalMs);
  };

  void run();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
