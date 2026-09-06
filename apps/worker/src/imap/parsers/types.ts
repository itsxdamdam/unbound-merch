/**
 * Pluggable bank-alert parsers.
 *
 * One module per bank template. A parser's job is narrow and boring: turn a
 * normalized email into { direction, amount, reference } or an explicit
 * failure. It must never reach the database, and it must never guess.
 *
 * Rule that everything else depends on: when a parser is unsure, it returns
 * `ok: false`. An unparsed alert becomes a manual-review item, which costs the
 * seller thirty seconds. A wrongly-parsed alert ships goods for free.
 */

export interface NormalizedEmail {
  messageId: string;
  from: string;
  subject: string;
  /** text/plain part, if present. */
  text: string | null;
  /** text/html part, if present. */
  html: string | null;
  /** html with tags stripped and entities decoded — see htmlToText(). */
  htmlAsText: string | null;
  receivedAt: Date;
  /** Raw Authentication-Results header, for the verification gate. */
  authenticationResults: string | null;
  headers: Record<string, string>;
}

export type AlertDirection = "credit" | "debit" | "unknown";

export interface ParsedAlert {
  direction: AlertDirection;
  /** Exact kobo. Produced only via nairaToKobo(). */
  amountKobo: bigint;
  /** Canonical ORD-XXXXX, or null when the narration carried no code. */
  reference: string | null;
  /** How confidently the reference was recovered from the body. */
  referenceConfidence: "strict" | "loose" | null;
  /** The narration/remark field verbatim, when the template exposes one. */
  narration: string | null;
  senderName: string | null;
  accountLast4: string | null;
  valueDate: Date | null;
  /** Human-readable trail of which heuristics fired. Stored on the alert row. */
  notes: string[];
}

export type ParseResult =
  | { ok: true; data: ParsedAlert }
  | {
      ok: false;
      /** Machine-ish code: no_amount, ambiguous_amount, not_a_transaction, ... */
      reason: string;
      notes: string[];
      /** Whatever was recovered, for the review UI to display. */
      partial: Partial<ParsedAlert>;
    };

export interface BankParser {
  /** Stable id, stored on BankAlert.parserName. */
  name: string;
  /** Bump when the extraction logic changes, so old rows stay explainable. */
  version: number;
  /**
   * Cheap check: does this template belong to this parser? Usually a From:
   * address plus a subject shape. Must not throw.
   */
  matches(email: NormalizedEmail): boolean;
  parse(email: NormalizedEmail): ParseResult;
}

/** Body text a parser should search: plain part first, then flattened HTML. */
export function bodyText(email: NormalizedEmail): string {
  return [email.subject, email.text, email.htmlAsText]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

/**
 * Minimal HTML flattener. Bank alerts are table-based layouts where the label
 * and the value sit in adjacent cells, so cell/row boundaries become
 * whitespace rather than being dropped — otherwise "Amount" and "5,000.00"
 * fuse into "Amount5,000.00" and every label-anchored regex misses.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|table|h[1-6]|li)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
