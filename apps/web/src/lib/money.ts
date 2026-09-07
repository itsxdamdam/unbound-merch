import type { Naira } from "./types";

// Whole naira, so no decimals: "₦9,000", not "₦9,000.00".
export function formatNaira(amount: Naira, opts: { symbol?: boolean } = {}): string {
  const symbol = opts.symbol === false ? "" : "₦";
  const grouped = Math.abs(amount).toLocaleString("en-NG", { maximumFractionDigits: 0 });
  return `${amount < 0 ? "-" : ""}${symbol}${grouped}`;
}
