import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@aiwebsite/ui",
    "@aiwebsite/db",
    "@aiwebsite/config",
    "@aiwebsite/templates",
    "@aiwebsite/ai",
  ],
};

export default nextConfig;
