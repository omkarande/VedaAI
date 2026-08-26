import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const dir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: dir,
  // Lets a production build run against its own output directory while a dev
  // server is using .next, instead of the two corrupting each other.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: "80mb",
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
