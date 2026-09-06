/**
 * Generate the Prisma Client before `next build`.
 *
 * This exists as a script rather than an inline `prisma generate --schema
 * ../../packages/db/prisma/schema.prisma` for one reason: it locates the schema
 * by module resolution instead of by counting "../" segments. If @store/db is
 * not installed — the usual cause being a Vercel Root Directory that excludes
 * the rest of the monorepo — this says so in one line, instead of failing later
 * as a wall of implicit-any type errors that never mentions Prisma.
 *
 * Generation must happen at build time: npm 11.11 gates dependency install
 * scripts behind `allow-scripts`, so @prisma/client's postinstall does not run
 * on Vercel, and generating here also produces the query-engine binary for the
 * platform actually being built on.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

let schema;
try {
  schema = join(dirname(require.resolve("@store/db/package.json")), "prisma", "schema.prisma");
} catch {
  console.error(
    "\n  Cannot resolve @store/db from apps/web.\n" +
      "  The workspace is not installed. On Vercel this usually means the\n" +
      "  Root Directory is set to apps/web with \"Include files outside root\n" +
      "  directory\" turned OFF, so the rest of the monorepo is not there.\n",
  );
  process.exit(1);
}

if (!existsSync(schema)) {
  console.error(`\n  @store/db resolved, but no schema at ${schema}\n`);
  process.exit(1);
}

// `prisma` is a devDependency of this workspace, so npm puts it on PATH.
const result = spawnSync("prisma", ["generate", "--schema", schema], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`\n  Could not run the prisma CLI: ${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
