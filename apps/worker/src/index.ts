import { PrismaClient } from "@store/db/prisma";
import { driverFromEnv } from "./whatsapp/send";
import { startLoop, TICK_MS } from "./jobs/loop";
import { configFromEnv, effectiveDailyCap } from "./whatsapp/governor";

import { loadRootEnv } from "@store/db/env";

// The .env lives at the repo root; these scripts may be run from anywhere.
loadRootEnv();

/**
 * Worker entrypoint. Long-running, not serverless: it holds an IMAP IDLE
 * connection and a WhatsApp session, neither of which survives a function
 * invocation boundary.
 */
const prisma = new PrismaClient();
const driver = driverFromEnv();

function banner() {
  const cfg = configFromEnv();
  const allowlist = process.env.ALERT_SENDER_ALLOWLIST || "(empty)";
  console.log("─".repeat(72));
  console.log("  unbound-merch worker");
  console.log("─".repeat(72));
  console.log(`  tick               every ${TICK_MS / 1000}s`);
  console.log(`  whatsapp driver    ${driver.name}${driver.name === "fake" ? "  (messages are printed, never sent)" : ""}`);
  console.log(`  warm-up cap        day 0: ${effectiveDailyCap(cfg, 0)}  ->  day ${cfg.warmupDays}: ${cfg.dailyCap}`);
  console.log(`  alert allowlist    ${allowlist}`);
  if (!process.env.ALERT_SENDER_ALLOWLIST) {
    console.log("  \x1b[33m!\x1b[0m allowlist is empty — every alert will be rejected. That is the safe default.");
  }
  console.log(`  imap               not connected (alerts are ingested via the admin form in dev)`);
  console.log("─".repeat(72));
}

async function main() {
  banner();
  const loop = startLoop(prisma, driver);

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} — stopping after the current tick.`);
    loop.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
