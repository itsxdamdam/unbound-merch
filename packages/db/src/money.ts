/**
 * Money is integer kobo, everywhere, as bigint.
 *
 * The matcher compares a parsed bank amount against an order total with `===`.
 * That comparison is only safe if both sides came through here — no parseFloat,
 * no Number(), no arithmetic on strings scraped out of an email.
 */

export type Kobo = bigint;

const AMOUNT_SHAPE = /^\d{1,15}(\.\d{1,2})?$/;

/**
 * Parse a Naira amount as it appears in an email or a form into exact kobo.
 * Accepts "1,234.50", "₦1,234", "NGN 1,234.5", "1234.50".
 * Throws on anything ambiguous rather than guessing — a wrong amount here
 * silently confirms the wrong order.
 */
export function nairaToKobo(raw: string): Kobo {
  const cleaned = raw.replace(/[\s, ]/g, "").replace(/^(NGN|₦|N)/i, "");

  if (!AMOUNT_SHAPE.test(cleaned)) {
    throw new Error(`Unparseable Naira amount: ${JSON.stringify(raw)}`);
  }

  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
}

/** "₦12,345.60" for display. */
export function formatKobo(kobo: Kobo, opts: { symbol?: boolean } = {}): string {
  const negative = kobo < 0n;
  const abs = negative ? -kobo : kobo;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = opts.symbol === false ? "" : "₦";
  return `${negative ? "-" : ""}${symbol}${grouped}.${frac}`;
}

/**
 * Prisma returns BigInt; JSON.stringify throws on it. Use this at every
 * server -> client boundary rather than sprinkling `.toString()` at call sites.
 */
export function serializeBigInts<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  ) as T;
}

/** Tolerance window used only to LOG a near-miss. Never to auto-match. */
export const NEAR_MISS_TOLERANCE_KOBO = 100n; // ₦1

export function isNearMiss(a: Kobo, b: Kobo): boolean {
  const diff = a > b ? a - b : b - a;
  return diff !== 0n && diff <= NEAR_MISS_TOLERANCE_KOBO;
}
