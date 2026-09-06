import type { PrismaClient } from "@prisma/client";
import { normalizeEmail } from "../imap/normalize";
import { verifyAlertSender } from "../imap/verifySender";
import { parseAlertEmail } from "../imap/parsers/registry";
import { matchAlert } from "../imap/matcher";

/**
 * Drain BankAlert rows sitting in `pending`.
 *
 * Ingestion (IMAP, or the admin's simulate form in development) does one thing:
 * write the raw message down. All verification, parsing and matching happens
 * here. Keeping them separate means a parser bug can be fixed and the stored
 * raw sources re-processed, rather than the evidence having been lost at
 * receive time.
 */
export async function processPendingAlerts(prisma: PrismaClient): Promise<number> {
  const pending = await prisma.bankAlert.findMany({
    where: { parseStatus: "pending" },
    orderBy: { receivedAt: "asc" },
    take: 25,
  });

  for (const alert of pending) {
    const email = await normalizeEmail(alert.rawSource, alert.mailbox);
    const verification = verifyAlertSender(email);

    // Rejected on sender grounds: still stored and still visible in the review
    // queue, but permanently ineligible for automatic matching.
    if (!verification.verified) {
      await prisma.bankAlert.update({
        where: { id: alert.id },
        data: {
          authVerified: false,
          authDetail: verification.detail,
          parseStatus: "rejected",
          processedAt: new Date(),
          parseNotes: `Sender verification failed: ${verification.detail}`,
        },
      });
      console.log(`  [alerts] ${alert.id} -> REJECTED (${alert.fromAddress}): ${verification.detail}`);
      continue;
    }

    const { parserName, parserVersion, result } = parseAlertEmail(email);

    if (!result.ok) {
      // A debit or a non-transaction mail is not a parser failure — the parser
      // did its job and correctly declined. Filing those as `parse_failed`
      // would bury genuine template breakages in a queue full of routine
      // marketing mail, so they get the schema's `ignored` status instead.
      const declined = result.reason === "debit_alert" || result.reason === "not_a_transaction";

      await prisma.bankAlert.update({
        where: { id: alert.id },
        data: {
          authVerified: true,
          authDetail: verification.detail,
          parserName,
          parserVersion,
          parseStatus: declined ? "ignored" : "parse_failed",
          parsedAmountKobo: result.partial.amountKobo ?? null,
          parsedReference: result.partial.reference ?? null,
          parsedNarration: result.partial.narration ?? null,
          parseNotes: [`reason: ${result.reason}`, ...result.notes].join("\n"),
          processedAt: new Date(),
        },
      });
      console.log(
        `  [alerts] ${alert.id} -> ${declined ? "ignored" : "parse_failed"} (${result.reason})`,
      );
      continue;
    }

    const parsed = result.data;
    const outcome = await matchAlert(prisma, alert.id, parsed, true);

    // matchAlert -> confirmPayment already set parseStatus/matchedOrderId
    // inside its transaction on the matched path; only annotate here.
    await prisma.bankAlert.update({
      where: { id: alert.id },
      data: {
        authVerified: true,
        authDetail: verification.detail,
        parserName,
        parserVersion,
        parsedAmountKobo: parsed.amountKobo,
        parsedReference: parsed.reference,
        parsedNarration: parsed.narration,
        parseStatus: outcome.status === "matched" ? "matched" : outcome.status,
        parseNotes: [...parsed.notes, ...("notes" in outcome ? outcome.notes : [])].join("\n"),
        processedAt: new Date(),
      },
    });

    if (outcome.status === "matched") {
      console.log(`  [alerts] ${alert.id} -> confirmed ${outcome.referenceCode}`);
    } else {
      console.log(`  [alerts] ${alert.id} -> ${outcome.status}`);
    }
  }

  return pending.length;
}
