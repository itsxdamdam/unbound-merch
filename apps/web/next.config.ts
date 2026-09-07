import type { NextConfig } from "next";

const config: NextConfig = {
  /**
   * Build output directory, overridable.
   *
   * `next dev` and `next build` both write to `.next` by default, so running a
   * build while a dev server is up deletes files out from under it. The dev
   * server then throws a stream of
   * `ENOENT ... _buildManifest.js.tmp.<random>` and stays broken until it is
   * restarted.
   *
   * Setting NEXT_DIST_DIR sends a build somewhere else:
   *
   *   NEXT_DIST_DIR=.next-build npm run build
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default config;
