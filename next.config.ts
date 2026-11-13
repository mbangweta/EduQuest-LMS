import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: do NOT set `output: "standalone"` — Vercel handles output optimization
  // itself, and `standalone` causes asset path issues on Vercel's CDN.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
