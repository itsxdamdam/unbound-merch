import { genericNgParser } from "./generic-ng";
import type { BankParser, NormalizedEmail, ParseResult } from "./types";

/**
 * Parser selection.
 *
 * Bank-specific parsers go FIRST, in order of specificity. `generic-ng` claims
 * everything, so it must stay last. When you send me a real alert I'll add a
 * module here (e.g. `gtbankParser`) rather than loosening the generic one —
 * that keeps each template's quirks isolated and independently testable.
 */
const PARSERS: BankParser[] = [
  // e.g. gtbankParser, zenithParser, kudaParser, opayParser,
  genericNgParser,
];

export function selectParser(email: NormalizedEmail): BankParser {
  for (const parser of PARSERS) {
    try {
      if (parser.matches(email)) return parser;
    } catch {
      // A broken matcher must not take down ingestion.
    }
  }
  return genericNgParser;
}

export interface ParseOutcome {
  parserName: string;
  parserVersion: number;
  result: ParseResult;
}

export function parseAlertEmail(email: NormalizedEmail): ParseOutcome {
  const parser = selectParser(email);
  try {
    return { parserName: parser.name, parserVersion: parser.version, result: parser.parse(email) };
  } catch (error) {
    return {
      parserName: parser.name,
      parserVersion: parser.version,
      result: {
        ok: false,
        reason: "parser_threw",
        notes: [error instanceof Error ? error.message : String(error)],
        partial: {},
      },
    };
  }
}
