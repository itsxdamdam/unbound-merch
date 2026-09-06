/** What the review queue holds right now, as a table. `npm run alerts` */
import { PrismaClient } from "../packages/db/src/generated/client";
import { formatKobo } from "../packages/db/src/money";

import { loadRootEnv } from "../packages/db/src/env";

// The .env lives at the repo root; these scripts may be run from anywhere.
loadRootEnv();

const prisma = new PrismaClient();

async function main() {
  const alerts = await prisma.bankAlert.findMany({
    orderBy: { receivedAt: "asc" },
    include: { matchedOrder: { select: { referenceCode: true, status: true } } },
  });

  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));

  console.log(
    "\n" + pad("SUBJECT", 30) + pad("VERIFIED", 10) + pad("STATUS", 14) +
    pad("AMOUNT", 13) + pad("ORDER", 12) + "NOTE",
  );
  console.log("─".repeat(140));

  for (const a of alerts) {
    console.log(
      pad(a.subject, 30) +
        pad(a.authVerified ? "yes" : "NO", 10) +
        pad(a.parseStatus, 14) +
        pad(a.parsedAmountKobo != null ? formatKobo(a.parsedAmountKobo) : "—", 13) +
        pad(a.matchedOrder?.referenceCode ?? "—", 12) +
        (a.parseNotes ?? a.authDetail ?? "").split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 70),
    );
  }

  const orders = await prisma.order.findMany({ orderBy: { createdAt: "asc" } });
  console.log("\n" + pad("ORDER", 12) + pad("STATUS", 18) + pad("TOTAL", 13) + "PAID VIA");
  console.log("─".repeat(70));
  for (const o of orders) {
    console.log(
      pad(o.referenceCode, 12) + pad(o.status, 18) + pad(formatKobo(o.totalKobo), 13) +
        (o.paymentSource ?? "—"),
    );
  }
  console.log();
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
