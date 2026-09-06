import { simpleParser } from "mailparser";
import { htmlToText, type NormalizedEmail } from "./parsers/types";

/**
 * Raw RFC822 -> NormalizedEmail.
 *
 * The raw source is kept verbatim on the BankAlert row rather than only the
 * normalized form: when a bank silently changes its template, the stored
 * originals are the only thing that lets the parser be rebuilt and re-tested
 * against real history.
 */
export async function normalizeEmail(
  raw: string | Buffer,
  fallbackMailbox = "INBOX",
): Promise<NormalizedEmail> {
  const parsed = await simpleParser(raw);

  const headers: Record<string, string> = {};
  for (const [key, value] of parsed.headers) {
    headers[key.toLowerCase()] =
      typeof value === "string" ? value : JSON.stringify(value);
  }

  const html = typeof parsed.html === "string" ? parsed.html : null;

  return {
    messageId: parsed.messageId ?? `no-message-id-${Date.now()}@${fallbackMailbox}`,
    from: parsed.from?.value?.[0]?.address ?? parsed.from?.text ?? "",
    subject: parsed.subject ?? "",
    text: parsed.text ?? null,
    html,
    htmlAsText: html ? htmlToText(html) : null,
    receivedAt: parsed.date ?? new Date(),
    // Read from the raw header map: this is the mailbox provider's own verdict
    // on DKIM/SPF, and it is the load-bearing input to verifyAlertSender.
    authenticationResults: headers["authentication-results"] ?? null,
    headers,
  };
}
