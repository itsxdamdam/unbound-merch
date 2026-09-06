"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@store/db";
import { confirmPayment, PaymentConfirmationError } from "@store/db/orders";

/**
 * Ingest a raw email exactly the way the IMAP watcher will.
 *
 * This writes the message down as `pending` and stops. It does not verify,
 * parse or match — the worker does all three on its next tick. That is the
 * point: the dev path and the production path run the identical pipeline, so
 * testing here actually tests what will run against a real mailbox.
 */
export async function simulateAlert(rawSource: string): Promise<{ error?: string; ok?: string }> {
  const trimmed = rawSource.trim();
  if (!trimmed) return { error: "Paste a raw email first." };

  // Read the Message-ID out of the raw source so replaying the same email is
  // the no-op it would be over IMAP, rather than a duplicate row.
  const messageId =
    /^message-id:\s*<?([^>\r\n]+)>?/im.exec(trimmed)?.[1] ??
    `simulated-${Date.now()}@local`;
  const from = /^from:.*?<?([^\s<>]+@[^\s<>]+)>?/im.exec(trimmed)?.[1] ?? "unknown@unknown";
  const subject = /^subject:\s*(.+)$/im.exec(trimmed)?.[1]?.trim() ?? "(no subject)";

  const existing = await prisma.bankAlert.findUnique({ where: { messageId } });
  if (existing) {
    return { error: `An alert with Message-ID ${messageId} already exists — that is the idempotency guard working.` };
  }

  await prisma.bankAlert.create({
    data: {
      messageId,
      mailbox: process.env.IMAP_MAILBOX ?? "INBOX",
      fromAddress: from,
      subject,
      rawSource: trimmed,
      receivedAt: new Date(),
      parseStatus: "pending",
    },
  });

  revalidatePath("/admin/alerts");
  return { ok: `Stored as pending. The worker will verify, parse and match it on its next tick.` };
}

/**
 * Manual confirmation. Deliberately routed through the same confirmPayment as
 * the matcher — there is no second mark-paid path — and always attributed to a
 * real admin row so OrderEvent.actor points at someone.
 */
export async function manuallyConfirm(
  orderId: string,
  note: string,
): Promise<{ error?: string; ok?: string }> {
  if (note.trim().length < 4) {
    return { error: "Write a short note saying how you verified this payment." };
  }

  const admin = await prisma.adminUser.findFirst({ where: { active: true } });
  if (!admin) {
    return { error: "No admin user exists. Run `npm run db:seed:admin` first." };
  }

  try {
    const result = await confirmPayment(prisma, orderId, {
      kind: "manual_admin",
      adminId: admin.id,
      note: note.trim(),
    });
    revalidatePath("/admin");
    return {
      ok: result.changed
        ? `Confirmed ${result.referenceCode}.`
        : `${result.referenceCode} was already paid — nothing changed.`,
    };
  } catch (error) {
    if (error instanceof PaymentConfirmationError) return { error: error.message };
    throw error;
  }
}
