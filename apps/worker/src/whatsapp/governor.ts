/**
 * Outbound WhatsApp pacing — ban-risk mitigation.
 *
 * whatsapp-web.js drives a real WhatsApp Web session. WhatsApp's terms
 * prohibit automated and bulk sending, and enforcement is automated and
 * appeal-hostile. Nothing in this file makes automation permitted; it makes
 * our traffic look like what it actually is — low-volume transactional replies
 * to people who just handed us their number and their money.
 *
 * The dominant ban signal is recipient-side: blocks and "report spam" taps in
 * the first minutes after a message. Volume and pacing are secondary. So the
 * strongest control is not in this file at all — it is that we only ever
 * message a buyer who initiated contact by checking out, about the specific
 * order they just paid for. Everything below is the second line of defence.
 */

import type { PrismaClient } from "@prisma/client";

export interface GovernorConfig {
  /** Minimum gap between two outbound sends. */
  minGapMs: number;
  /** Random extra delay on top, so the cadence is not machine-regular. */
  jitterMs: number;
  hourlyCap: number;
  dailyCap: number;
  /** Day 1 cap during warm-up; grows toward dailyCap. */
  warmupStartCap: number;
  warmupDays: number;
  /** Local hours (in DISPLAY_TIMEZONE) outside which non-urgent sends wait. */
  quietHoursStart: number;
  quietHoursEnd: number;
}

export function configFromEnv(): GovernorConfig {
  const num = (key: string, fallback: number) => {
    const raw = process.env[key];
    const parsed = raw == null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    minGapMs: num("WA_MIN_GAP_MS", 8_000),
    jitterMs: num("WA_JITTER_MS", 7_000),
    hourlyCap: num("WA_HOURLY_CAP", 40),
    dailyCap: num("WA_DAILY_CAP", 200),
    warmupStartCap: num("WA_WARMUP_START_CAP", 20),
    warmupDays: num("WA_WARMUP_DAYS", 14),
    quietHoursStart: num("WA_QUIET_START_HOUR", 22),
    quietHoursEnd: num("WA_QUIET_END_HOUR", 7),
  };
}

/**
 * Warm-up ramp. A number that has never sent anything and then emits 200
 * messages on its first day is the single most bannable pattern there is.
 *
 * Geometric, not linear: a linear ramp from 20 to 200 over 14 days jumps 60%
 * on day one, which is the opposite of a warm-up. Geometric keeps the early
 * days genuinely quiet and does the growing at the end, once the number has
 * accumulated a clean history.
 */
export function effectiveDailyCap(cfg: GovernorConfig, daysActive: number): number {
  if (daysActive >= cfg.warmupDays) return cfg.dailyCap;
  if (daysActive <= 0) return cfg.warmupStartCap;
  const growth = cfg.dailyCap / cfg.warmupStartCap;
  return Math.floor(cfg.warmupStartCap * growth ** (daysActive / cfg.warmupDays));
}

export type GovernorVerdict =
  | { allow: true; delayMs: number }
  | { allow: false; reason: string; retryAfterMs: number };

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Counts come from the WhatsAppMessage audit table rather than an in-memory
 * counter, so a worker restart cannot reset the budget and burst.
 */
export async function checkQuota(
  prisma: PrismaClient,
  cfg: GovernorConfig,
  now = new Date(),
): Promise<GovernorVerdict> {
  const [lastSent, sentLastHour, sentToday, firstEver] = await Promise.all([
    prisma.whatsAppMessage.findFirst({
      where: { direction: "outbound", sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
    prisma.whatsAppMessage.count({
      where: { direction: "outbound", sentAt: { gte: new Date(now.getTime() - HOUR_MS) } },
    }),
    prisma.whatsAppMessage.count({
      where: { direction: "outbound", sentAt: { gte: new Date(now.getTime() - DAY_MS) } },
    }),
    prisma.whatsAppMessage.findFirst({
      where: { direction: "outbound", sentAt: { not: null } },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true },
    }),
  ]);

  const daysActive = firstEver?.sentAt
    ? (now.getTime() - firstEver.sentAt.getTime()) / DAY_MS
    : 0;
  const dailyCap = effectiveDailyCap(cfg, daysActive);

  if (sentToday >= dailyCap) {
    return {
      allow: false,
      reason: `Daily cap reached (${sentToday}/${dailyCap}, day ${daysActive.toFixed(1)} of warm-up)`,
      retryAfterMs: HOUR_MS,
    };
  }
  if (sentLastHour >= cfg.hourlyCap) {
    return {
      allow: false,
      reason: `Hourly cap reached (${sentLastHour}/${cfg.hourlyCap})`,
      retryAfterMs: 10 * 60_000,
    };
  }

  const sinceLast = lastSent?.sentAt ? now.getTime() - lastSent.sentAt.getTime() : Infinity;
  if (sinceLast < cfg.minGapMs) {
    return { allow: false, reason: "Min gap not elapsed", retryAfterMs: cfg.minGapMs - sinceLast };
  }

  return { allow: true, delayMs: Math.floor(Math.random() * cfg.jitterMs) };
}

/**
 * Sending to a number that is not on WhatsApp is a strong spam signal — it is
 * what scrape-and-blast operations look like. Buyers mistype phone numbers at
 * checkout constantly, so validate before every first send to a number and
 * fail the notification loudly instead of firing into the void.
 */
export async function resolveRecipient(
  client: { getNumberId(phone: string): Promise<{ _serialized: string } | null> },
  e164Phone: string,
): Promise<{ ok: true; jid: string } | { ok: false; reason: string }> {
  const digits = e164Phone.replace(/[^\d]/g, "");
  if (digits.length < 10) return { ok: false, reason: `Implausible phone: ${e164Phone}` };

  try {
    const id = await client.getNumberId(digits);
    if (!id) return { ok: false, reason: "Number is not registered on WhatsApp" };
    return { ok: true, jid: id._serialized };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Identical bodies repeated N times read as a broadcast. Every message we send
 * already carries order-specific data (reference, amount, items); this picks a
 * varying opener so even two same-minute confirmations differ.
 */
export function varyOpening(variants: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return variants[Math.abs(hash) % variants.length];
}

export function inQuietHours(cfg: GovernorConfig, now: Date, timeZone: string): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone }).format(now),
  );
  // Window wraps midnight, e.g. 22:00 -> 07:00.
  return cfg.quietHoursStart > cfg.quietHoursEnd
    ? hour >= cfg.quietHoursStart || hour < cfg.quietHoursEnd
    : hour >= cfg.quietHoursStart && hour < cfg.quietHoursEnd;
}
