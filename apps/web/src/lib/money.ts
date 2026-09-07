import type { Kobo } from "./types";

/**
 * Display formatting only.
 *
 * Everything that decides an amount — totals, comparisons against what
 * Paystack charged — happens on the backend. This turns a kobo string into
 * something a person reads, and does nothing else.
 */
export function formatKobo(kobo: Kobo, opts: { symbol?: boolean } = {}): string {
  const value = BigInt(kobo);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = opts.symbol === false ? "" : "₦";
  return `${negative ? "-" : ""}${symbol}${grouped}.${frac}`;
}

/** Line total, in kobo, as a string. BigInt so nothing rounds. */
export function multiplyKobo(kobo: Kobo, quantity: number): Kobo {
  return (BigInt(kobo) * BigInt(quantity)).toString();
}

export function sumKobo(values: Kobo[]): Kobo {
  return values.reduce((total, value) => total + BigInt(value), 0n).toString();
}
