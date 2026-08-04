import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@aiwebsite/config", "@aiwebsite/db", "@aiwebsite/templates"],
};

export default nextConfig;
