import type { NextConfig } from "next";

// Consolation is a local admin UI for an in-memory AWS emulator: every page reads
// live emulator state, so nothing is prerendered or cached (cacheComponents off).
const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
