/**
 * Drive one full purchase end-to-end, without a browser or a bank.
 *
 *   npm run demo                  # a genuine credit alert; the order gets paid
 *   npm run demo forged-sender    # the forgery attack; must be rejected
 *   npm run demo debit-trap       # right amount, wrong direction
 *   npm run demo underpayment     # ₦1 short; must land in review
 *   npm run demo -- --list        # every scenario
 *
 * It creates a real order through createOrder, then writes a raw email into
 * the alerts table exactly as the admin form (and, later, the IMAP watcher)
 * does. Verification, parsing and matching are left to the worker, so what
 * this exercises is the real pipeline rather than a parallel one.
 */
import { PrismaClient } from "@prisma/client";
import { createOrder } from "../packages/db/src/orders/createOrder";
import { formatKobo } from "../packages/db/src/money";
import { FIXTURES } from "../apps/web/src/lib/alertFixtures";

import { loadRootEnv } from "../packages/db/src/env";

// The .env lives at the repo root; these scripts may be run from anywhere.
loadRootEnv();

const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2];

  if (arg === "--list" || arg === "-l") {
    for (const fixture of FIXTURES) {
      console.log(`\n  ${fixture.id}\n    ${fixture.label}\n    ${fixture.expectation}`);
    }
    return;
  }

  const scenario = arg ?? "valid-credit";
  const fixture = FIXTURES.find((f) => f.id === scenario);
  if (!fixture) {
    console.error(`Unknown scenario "${scenario}". Try: npm run demo -- --list`);
    process.exitCode = 1;
    return;
  }

  const variant = await prisma.productVariant.findFirstOrThrow({
    where: { product: { slug: "jersey" }, label: "L" },
    include: { product: true },
  });

  const order = await createOrder(prisma, {
    items: [{ variantId: variant.id, quantity: 1 }],
    buyerName: "Ada Obi",
    buyerPhone: "+2348031112222",
    deliveryAddress: "4 Marina Road, Lagos Island",
  });

  console.log(`\n  order        ${order.referenceCode}`);
  console.log(`  item         ${variant.product.name} (${variant.label})`);
  console.log(`  total        ${formatKobo(order.totalKobo)}`);
  console.log(`  page         http://localhost:3000/orders/${order.referenceCode}`);
  console.log(`\n  scenario     ${fixture.id}`);
  console.log(`  expected     ${fixture.expectation}`);

  // Amount written the way a bank template writes it, so the parser has to do
  // real work rather than being handed clean input.
  const amount = (Number(order.totalKobo) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  });
  const raw = fixture.build({ reference: order.referenceCode, amount });

  const messageId =
    /^message-id:\s*<?([^>\r\n]+)>?/im.exec(raw)?.[1] ?? `demo-${Date.now()}@local`;
  const from = /^from:.*?<?([^\s<>]+@[^\s<>]+)>?/im.exec(raw)?.[1] ?? "unknown@unknown";
  const subject = /^subject:\s*(.+)$/im.exec(raw)?.[1]?.trim() ?? "(no subject)";

  await prisma.bankAlert.create({
    data: {
      messageId,
      mailbox: process.env.IMAP_MAILBOX ?? "INBOX",
      fromAddress: from,
      subject,
      rawSource: raw,
      receivedAt: new Date(),
      parseStatus: "pending",
    },
  });

  console.log(`\n  delivered to the mailbox as \x1b[33mpending\x1b[0m.`);
  console.log(`  the worker picks it up on its next tick — watch its console.`);
  console.log(`  review queue: http://localhost:3000/admin/alerts\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
