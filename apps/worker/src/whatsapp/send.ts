import type { PrismaClient } from "@store/db/prisma";

/**
 * The seam every outbound message passes through.
 *
 * Nothing outside this directory imports whatsapp-web.js. That is what makes
 * the eventual move to the WhatsApp Cloud API one adapter file rather than a
 * rewrite — and it is what lets the whole system run locally, with no QR
 * pairing and no ban risk, by swapping in the `fake` driver.
 *
 *   WHATSAPP_DRIVER=fake  (default) — logs, records, never touches WhatsApp
 *   WHATSAPP_DRIVER=web             — real whatsapp-web.js session
 */
export interface SendResult {
  ok: boolean;
  /** WhatsApp's own message id, when the driver produces one. */
  waMessageId?: string;
  error?: string;
}

export interface WhatsAppDriver {
  readonly name: string;
  /** Cheap liveness check; the outbox will not drain while this is false. */
  isReady(): boolean;
  /** Must reject numbers that are not on WhatsApp rather than blind-sending. */
  send(phone: string, body: string): Promise<SendResult>;
}

/**
 * Development driver. Prints the message the way the buyer would receive it
 * and reports success, so the full outbox path — dedupe, governor pacing,
 * status transitions, WhatsAppMessage rows — is exercised for real.
 */
export const fakeDriver: WhatsAppDriver = {
  name: "fake",
  isReady: () => true,
  async send(phone, body) {
    console.log(
      `\n  ┌─ [whatsapp:fake] -> ${phone}\n` +
        body
          .split("\n")
          .map((line) => `  │ ${line}`)
          .join("\n") +
        `\n  └─ (not actually sent)\n`,
    );
    return { ok: true, waMessageId: `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  },
};

/**
 * Real driver placeholder. Deliberately not wired to whatsapp-web.js yet:
 * pairing a live number is a decision with ban risk attached, and it must be a
 * conscious act rather than something that happens because someone ran the dev
 * server. See PROPOSAL.md for the pacing and warm-up rules it must obey.
 */
export const webDriver: WhatsAppDriver = {
  name: "web",
  isReady: () => false,
  async send() {
    return {
      ok: false,
      error:
        "whatsapp-web.js driver is not wired up yet. Run with WHATSAPP_DRIVER=fake, " +
        "or implement client.ts (QR pairing, session persistence, health events) first.",
    };
  },
};

export function driverFromEnv(): WhatsAppDriver {
  return process.env.WHATSAPP_DRIVER === "web" ? webDriver : fakeDriver;
}

/**
 * Send, and record. Every outbound message becomes a WhatsAppMessage row
 * whether or not it succeeded — the governor reads its rate counters from that
 * table rather than from memory, so a worker restart cannot reset the budget
 * and burst.
 */
export async function sendWhatsAppMessage(
  prisma: PrismaClient,
  driver: WhatsAppDriver,
  args: { phone: string; body: string; orderId?: string | null },
): Promise<SendResult> {
  const result = await driver.send(args.phone, args.body);

  await prisma.whatsAppMessage.create({
    data: {
      orderId: args.orderId ?? null,
      direction: "outbound",
      phone: args.phone,
      body: args.body,
      waMessageId: result.waMessageId ?? null,
      sentAt: result.ok ? new Date() : null,
    },
  });

  return result;
}
