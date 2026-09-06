import { PrismaClient } from "./generated/client";
import { loadRootEnv } from "./env";

// Must run before the client is constructed: Prisma resolves env("DATABASE_URL")
// at construction time, not on first query.
loadRootEnv();

/**
 * PrismaClient singleton.
 *
 * Next.js dev-mode hot reload re-evaluates modules on every edit. Without the
 * global cache that means a new connection pool per reload, which exhausts
 * Postgres connections within a few saves. In production the global is unused.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
