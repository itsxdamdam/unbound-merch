import type { PrismaClient } from "@prisma/client";
import { confirmPayment, PaymentConfirmationError } from "@store/db/orders";
import type { ParsedAlert } from "./parsers/types";

export type MatchOutcome =
  | { status: "matched"; orderId: string; referenceCode: string }
  | { status: "unmatched"; notes: string[] }
  | { status: "ignored"; notes: string[] };

/**
 * Bind a parsed alert to exactly one order, or refuse.
 *
 * The matcher is deliberately the least clever component in the system. It
 * requires BOTH a reference and an exact amount, and it refuses on any
 * ambiguity rather than picking a most-likely candidate. Every "helpful"
 * relaxation here — fuzzy amounts, newest-order-wins, reference-only matching —
 * converts into shipping goods to the wrong person, and the cost of refusing
 * is that a human spends thirty seconds in the review queue.
 */
export async function matchAlert(
  prisma: PrismaClient,
  alertId: string,
  parsed: ParsedAlert,
  authVerified: boolean,
): Promise<MatchOutcome> {
  const notes: string[] = [];

  // A forged or unverified sender is never eligible, no matter how clean the
  // parse is. This is the check that stops "email the alert mailbox a fake
  // credit alert and get free goods".
  if (!authVerified) {
    return { status: "ignored", notes: ["Sender not verified — never auto-matched."] };
  }

  if (parsed.direction !== "credit") {
    return { status: "ignored", notes: [`Direction is ${parsed.direction}, not a credit.`] };
  }

  if (!parsed.reference) {
    notes.push("No order reference in the narration.");
    // Surface same-amount candidates so the review UI can show them, but do
    // NOT auto-confirm even when exactly one exists — an unreferenced transfer
    // that happens to equal an order total is a coincidence, not a proof.
    const candidates = await prisma.order.findMany({
      where: { status: "pending_payment", totalKobo: parsed.amountKobo },
      select: { referenceCode: true },
      take: 5,
    });
    notes.push(
      candidates.length === 0
        ? "No pending order matches this amount either."
        : `Pending orders with this exact amount: ${candidates.map((c) => c.referenceCode).join(", ")}`,
    );
    return { status: "unmatched", notes };
  }

  const order = await prisma.order.findUnique({
    where: { referenceCode: parsed.reference },
    select: { id: true, referenceCode: true, status: true, totalKobo: true },
  });

  if (!order) {
    return { status: "unmatched", notes: [`No order with reference ${parsed.reference}.`] };
  }

  if (order.totalKobo !== parsed.amountKobo) {
    const diff = parsed.amountKobo - order.totalKobo;
    return {
      status: "unmatched",
      notes: [
        `Reference ${parsed.reference} found, but the amount does not match: ` +
          `alert ${parsed.amountKobo} kobo vs order ${order.totalKobo} kobo ` +
          `(${diff > 0n ? "over" : "under"}payment of ${diff < 0n ? -diff : diff} kobo).`,
      ],
    };
  }

  if (parsed.referenceConfidence === "loose") {
    notes.push(
      "Reference was recovered by loose matching (no word boundary) — amount matched exactly, so it was accepted.",
    );
  }

  try {
    const result = await confirmPayment(prisma, order.id, {
      kind: "bank_alert",
      bankAlertId: alertId,
      amountKobo: parsed.amountKobo,
    });
    if (!result.changed) {
      notes.push("Order was already paid; this alert changed nothing.");
    }
    return { status: "matched", orderId: result.orderId, referenceCode: result.referenceCode };
  } catch (error) {
    if (error instanceof PaymentConfirmationError) {
      return { status: "unmatched", notes: [...notes, error.message] };
    }
    throw error;
  }
}
