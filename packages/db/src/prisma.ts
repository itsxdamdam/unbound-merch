/**
 * The single place the generated Prisma Client is imported from.
 *
 * Everything in the monorepo imports Prisma types and `PrismaClient` through
 * here rather than from `@prisma/client` directly. `@prisma/client` resolves to
 * whichever copy the installer happened to hoist, and on a layout that nests a
 * second copy the app can end up importing an ungenerated stub while
 * `prisma generate` wrote to a different one. This path is the generator's
 * declared `output`, so it is the same file on every machine.
 *
 * The generated directory is gitignored and rebuilt by `prisma generate`,
 * which runs in `postinstall` and again at the start of every build.
 */
export * from "./generated/client";
