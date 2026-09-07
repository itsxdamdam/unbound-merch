import type { Naira } from "./types";

/**
 * Display formatting.
 *
 * Prices are whole naira, so no decimals are shown — "₦9,000", the way a
 * Nigerian shop actually prints it, not "₦9,000.00".
 */
export function formatNaira(amount: Naira, opts: { symbol?: boolean } = {}): string {
  const symbol = opts.symbol === false ? "" : "₦";
  const grouped = Math.abs(amount).toLocaleString("en-NG", { maximumFractionDigits: 0 });
  return `${amount < 0 ? "-" : ""}${symbol}${grouped}`;
}
