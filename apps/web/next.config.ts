import type { NextConfig } from "next";

const config: NextConfig = {
  // @store/db is source TypeScript in the workspace, not a built package.
  transpilePackages: ["@store/db"],
  experimental: {
    // Server Actions receive cart lines; keep the payload small on purpose.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default config;
