import type { NormalizedEmail } from "./parsers/types";

/**
 * Sender verification gate — the load-bearing security control in this system.
 *
 * The brief's principle is "the only source of truth is the bank alert email".
 * That holds ONLY if a bank alert is unforgeable. It isn't, by default: the
 * From: header is free text, and anyone who learns the alert mailbox address
 * can send it a convincing "GTBank: Credit Alert ₦45,000 ORD-7F3K2" and be
 * shipped goods for free. Reference codes appear on the buyer's own payment
 * page, so the attacker already has every field they need.
 *
 * So an alert is eligible for automatic matching only if BOTH hold:
 *   1. The envelope/From domain is on ALERT_SENDER_ALLOWLIST, and
 *   2. The provider's own Authentication-Results header reports dkim=pass
 *      (or spf=pass) for that domain.
 *
 * (2) is what makes (1) meaningful — the mailbox provider (Gmail/Zoho) already
 * did the cryptographic work, so we read its verdict rather than redoing it.
 * Anything failing either check is stored as `rejected`: visible in the admin
 * queue, never auto-matched.
 */

export interface VerificationResult {
  verified: boolean;
  /** Stored verbatim on BankAlert.authDetail. */
  detail: string;
}

function allowlist(): string[] {
  return (process.env.ALERT_SENDER_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function domainOf(address: string): string | null {
  const match = address.toLowerCase().match(/@([a-z0-9.-]+)/);
  return match?.[1] ?? null;
}

export function verifyAlertSender(email: NormalizedEmail): VerificationResult {
  const allowed = allowlist();
  if (allowed.length === 0) {
    return {
      verified: false,
      detail: "ALERT_SENDER_ALLOWLIST is empty — refusing to trust any sender.",
    };
  }

  const domain = domainOf(email.from);
  if (!domain) {
    return { verified: false, detail: `Unparseable From address: ${email.from}` };
  }

  // Exact domain or subdomain of an allowlisted entry.
  const domainAllowed = allowed.some(
    (entry) => domain === entry || domain.endsWith(`.${entry}`),
  );
  if (!domainAllowed) {
    return { verified: false, detail: `Sender domain not allowlisted: ${domain}` };
  }

  const auth = email.authenticationResults ?? "";
  if (!auth) {
    return {
      verified: false,
      detail: "No Authentication-Results header; cannot confirm DKIM/SPF.",
    };
  }

  const dkimPass = /dkim=pass/i.test(auth);
  const spfPass = /spf=pass/i.test(auth);
  // The passing signature must belong to the allowlisted domain, not merely be
  // present — a forwarder can sign a forged body with its own domain.
  const dkimDomain = auth.match(/dkim=pass[^;]*?header\.(?:i|d)=@?([a-z0-9.-]+)/i)?.[1];
  const dkimBoundToSender =
    dkimDomain != null &&
    allowed.some((entry) => dkimDomain === entry || dkimDomain.endsWith(`.${entry}`));

  if (dkimPass && dkimBoundToSender) {
    return { verified: true, detail: `dkim=pass for ${dkimDomain}` };
  }
  if (spfPass && !dkimPass) {
    return {
      verified: true,
      detail: `spf=pass (no DKIM signature bound to ${domain}) — weaker than DKIM`,
    };
  }

  return {
    verified: false,
    detail: `Authentication-Results did not pass for ${domain}: ${auth.slice(0, 400)}`,
  };
}
