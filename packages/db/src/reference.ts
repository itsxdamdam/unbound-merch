import { randomInt } from "node:crypto";

/**
 * Order reference codes.
 *
 * Design constraints, in priority order:
 *  1. A human retypes this into a bank app's narration field, on a phone,
 *     often from a screenshot. So: short, uppercase, no ambiguous glyphs.
 *  2. It comes back to us through a bank's alert template, which may
 *     uppercase it, strip the hyphen, truncate it, or glue it to other text.
 *     So: recoverable with and without the separator and word boundaries.
 *  3. It is not a secret. Knowing a reference must not let anyone confirm an
 *     order — confirmation requires a verified bank alert carrying real money.
 */

/** Crockford-ish: no 0/O, 1/I/L, U. 30 symbols. */
export const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const PREFIX = "ORD";
export const CODE_LENGTH = 5;

/** ~24.3M combinations; collisions handled by the @unique + retry on insert. */
export function generateReferenceCode(): string {
  let body = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    body += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${PREFIX}-${body}`;
}

/** Canonical form: ORD-XXXXX. Returns null if the input isn't a valid code. */
export function normalizeReference(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact.startsWith(PREFIX)) return null;
  const body = compact.slice(PREFIX.length);
  if (body.length !== CODE_LENGTH) return null;
  if (![...body].every((ch) => ALPHABET.includes(ch))) return null;
  return `${PREFIX}-${body}`;
}

const STRICT = new RegExp(
  `\\b${PREFIX}[-\\s_.]?([${ALPHABET}]{${CODE_LENGTH}})\\b`,
  "gi",
);

/** No word boundaries — catches "TRFORD7F3K2FROMJOHN" style mangling. */
const LOOSE = new RegExp(`${PREFIX}[-\\s_.]?([${ALPHABET}]{${CODE_LENGTH}})`, "gi");

export interface ReferenceHit {
  code: string;
  /** `strict` hits are trustworthy; `loose` hits should be flagged in notes. */
  confidence: "strict" | "loose";
}

/**
 * Pull every candidate reference out of a blob of text.
 *
 * Returns ALL distinct hits rather than the first one. If a body yields more
 * than one distinct code we do not pick a winner — the caller sends it to
 * manual review. Guessing between two references risks crediting the wrong
 * buyer, which is worse than a human looking at it.
 */
export function extractReferences(text: string): ReferenceHit[] {
  const seen = new Map<string, ReferenceHit["confidence"]>();

  for (const [pattern, confidence] of [
    [STRICT, "strict"],
    [LOOSE, "loose"],
  ] as const) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const code = `${PREFIX}-${match[1].toUpperCase()}`;
      if (!seen.has(code)) seen.set(code, confidence);
    }
  }

  return [...seen].map(([code, confidence]) => ({ code, confidence }));
}
