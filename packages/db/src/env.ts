import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Local-development fallback for monorepo `.env` discovery.
 *
 * The `.env` lives at the repo root, but each app runs with its own directory
 * as cwd: Next.js loads `.env` from `apps/web`, and the worker's
 * `dotenv/config` loads from `apps/worker`. Neither finds the root file, so
 * every database call fails with "Environment variable not found:
 * DATABASE_URL" — which reads like a Prisma problem and is really a path one.
 *
 * Rather than duplicating the file into each app (two copies of a connection
 * string that will drift) or symlinking it (a symlink that dangles in CI,
 * where `.env` is not committed), this walks up for the real one.
 *
 * Deliberately inert wherever real environment variables exist — Vercel,
 * Docker, CI — because it returns immediately if DATABASE_URL is already set.
 * It never overwrites a variable that is already present.
 */
export function loadRootEnv(): void {
  if (process.env.DATABASE_URL) return;

  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      applyEnvFile(candidate);
      if (process.env.DATABASE_URL) return;
    }
    const parent = dirname(dir);
    if (parent === dir) return; // reached the filesystem root
    dir = parent;
  }
}

function applyEnvFile(path: string): void {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return; // Unreadable is the same as absent; never crash a boot over it.
  }

  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue; // A real env var always wins.

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
