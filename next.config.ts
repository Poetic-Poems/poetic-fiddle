import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // poetic/browser is CommonJS; let Next.js's bundler transpile it rather
  // than treating it as pre-built. See TECH-DEBT.md TD26071301.
  transpilePackages: ["poetic"],
};

export default nextConfig;
