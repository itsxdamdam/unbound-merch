import { nairaToKobo } from "@store/db/money";
import { extractReferences } from "@store/db/reference";
import { bodyText, type BankParser, type ParseResult, type NormalizedEmail } from "./types";

/**
 * PLACEHOLDER parser — calibrate against a real sample before trusting it.
 *
 * This is the fallback that runs when no bank-specific parser claims the mail.
 * It encodes the shape most Nigerian credit alerts share (a labelled amount, a
 * narration line, a credit/debit word) without committing to any one bank's
 * wording. Once you hand me a real alert, I'll add e.g. `gtbank.ts` with tight
 * anchors and demote this one to a last resort.
 *
 * Three refusals are deliberate and should survive calibration:
 *   1. Anything that doesn't positively read as a CREDIT is ignored. A debit
 *      alert for ₦25,000 must never confirm a ₦25,000 order.
 *   2. Balance figures are excluded before amount selection. "Available
 *      Balance: ₦25,000.00" is the classic false positive.
 *   3. Two candidate amounts, or two candidate references, means manual
 *      review. Not a coin flip.
 */

const CREDIT_HINTS =
  /\b(credit(ed)?|inflow|received|lodg(e)?ment|transfer\s+from|CR)\b/i;
const DEBIT_HINTS = /\b(debit(ed)?|withdraw(al|n)?|outflow|purchase|\bDR\b)\b/i;

/** Labels whose numbers are NOT the transaction amount. */
const EXCLUDED_LABELS =
  /\b(available|current|ledger|opening|closing|book)\s*(balance|bal)\b/i;

/** Labels that positively identify the transaction amount. */
const AMOUNT_LABEL =
  /\b(?:transaction\s+amount|credit\s+amount|amount(?:\s+credited)?|amt)\b\s*[:\-]?\s*/i;

const CURRENCY = String.raw`(?:NGN|₦|N)`;
const NUMBER = String.raw`\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?`;

/** Priority 1: an amount sitting right after an explicit amount label. */
const LABELLED_AMOUNT = new RegExp(
  AMOUNT_LABEL.source + String.raw`(?:${CURRENCY})?\s*(${NUMBER})`,
  "gi",
);

/** Priority 2: any currency-prefixed number anywhere in the body. */
const BARE_AMOUNT = new RegExp(String.raw`${CURRENCY}\s*(${NUMBER})`, "gi");

const NARRATION_LABEL =
  /\b(?:narration|remarks?|description|details|payment\s+ref(?:erence)?)\b\s*[:\-]?\s*(.+)/i;

/** Strip lines containing a balance label so their numbers can't be selected. */
function withoutBalanceLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !EXCLUDED_LABELS.test(line))
    .join("\n");
}

function collectAmounts(text: string, pattern: RegExp): bigint[] {
  const found = new Set<string>();
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    found.add(match[1]);
  }
  const amounts = new Set<bigint>();
  for (const raw of found) {
    try {
      amounts.add(nairaToKobo(raw));
    } catch {
      // Unparseable candidate — ignore it rather than failing the whole mail.
    }
  }
  return [...amounts];
}

export const genericNgParser: BankParser = {
  name: "generic-ng",
  version: 1,

  // The fallback claims everything; registry.ts only reaches it last.
  matches: () => true,

  parse(email: NormalizedEmail): ParseResult {
    const notes: string[] = [];
    const raw = bodyText(email);
    const text = withoutBalanceLines(raw);

    // --- 1. Direction -----------------------------------------------------
    const looksCredit = CREDIT_HINTS.test(raw);
    const looksDebit = DEBIT_HINTS.test(raw);

    if (!looksCredit) {
      return {
        ok: false,
        reason: looksDebit ? "debit_alert" : "not_a_transaction",
        notes: [
          looksDebit
            ? "Debit alert — never eligible to confirm an order."
            : "No credit keyword found in subject or body.",
        ],
        partial: { direction: looksDebit ? "debit" : "unknown" },
      };
    }
    if (looksDebit) {
      // Some templates mention both ("Debit Card", footer boilerplate). Don't
      // silently pick credit — a human decides.
      notes.push("Body contains both credit and debit keywords.");
      return {
        ok: false,
        reason: "ambiguous_direction",
        notes,
        partial: { direction: "unknown" },
      };
    }

    // --- 2. Amount --------------------------------------------------------
    let amounts = collectAmounts(text, LABELLED_AMOUNT);
    if (amounts.length > 0) {
      notes.push("Amount taken from a labelled field.");
    } else {
      amounts = collectAmounts(text, BARE_AMOUNT);
      if (amounts.length > 0) {
        notes.push("Amount taken from a bare currency figure (no label found).");
      }
    }

    if (amounts.length === 0) {
      return { ok: false, reason: "no_amount", notes, partial: { direction: "credit" } };
    }
    if (amounts.length > 1) {
      notes.push(`Candidates: ${amounts.map(String).join(", ")} kobo.`);
      return {
        ok: false,
        reason: "ambiguous_amount",
        notes,
        partial: { direction: "credit" },
      };
    }
    const amountKobo = amounts[0];

    // --- 3. Reference -----------------------------------------------------
    // Searched over the FULL body, not just the narration line: banks truncate
    // and relocate narration constantly.
    const hits = extractReferences(raw);
    let reference: string | null = null;
    let referenceConfidence: "strict" | "loose" | null = null;

    if (hits.length === 1) {
      reference = hits[0].code;
      referenceConfidence = hits[0].confidence;
      if (referenceConfidence === "loose") {
        notes.push(`Reference ${reference} recovered from mangled text.`);
      }
    } else if (hits.length > 1) {
      notes.push(`Multiple references present: ${hits.map((h) => h.code).join(", ")}.`);
      return {
        ok: false,
        reason: "ambiguous_reference",
        notes,
        partial: { direction: "credit", amountKobo },
      };
    } else {
      // No reference is a normal outcome, not an error: the buyer forgot to
      // type it. The matcher will fall back to amount-based candidates and
      // route this to manual review.
      notes.push("No reference code found in body.");
    }

    const narrationMatch = raw.match(NARRATION_LABEL);

    return {
      ok: true,
      data: {
        direction: "credit",
        amountKobo,
        reference,
        referenceConfidence,
        narration: narrationMatch?.[1]?.trim() ?? null,
        senderName: null,
        accountLast4: null,
        valueDate: null,
        notes,
      },
    };
  },
};
