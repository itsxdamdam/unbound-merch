/**
 * Create the admin row from env, so OrderEvent.actor and
 * Order.confirmedByAdminId point at something real rather than a string.
 *
 * ADMIN_PASSWORD_HASH is stored as given and never generated here — a seed
 * script that invents a password is a seed script that ships a known one.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL;
if (!email) {
  console.error("ADMIN_EMAIL is not set in .env");
  process.exit(1);
}

const passwordHash = process.env.ADMIN_PASSWORD_HASH ?? "";
if (!passwordHash) {
  console.warn(
    "! ADMIN_PASSWORD_HASH is empty. The admin row is created so manual\n" +
      "  confirmation works in development, but there is no usable login\n" +
      "  credential — set a real hash before exposing /admin to the internet.",
  );
}

const admin = await prisma.adminUser.upsert({
  where: { email },
  update: { active: true },
  create: {
    email,
    passwordHash,
    displayName: email.split("@")[0] ?? "admin",
    active: true,
  },
});

console.log(`admin ready: ${admin.email} (${admin.id})`);
await prisma.$disconnect();
