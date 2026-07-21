import type { NextConfig } from "next";

// The site-wide Content-Security-Policy (AC85's CSP half; REQUIREMENTS.md
// §12.4) lives in src/proxy.ts, not here: it carries a nonce minted fresh per
// request (script-src/style-src 'nonce-<value>', no 'unsafe-inline'), and
// headers() can only return a static value with no way to mint one. It does
// not touch the share iframe's own CSP (the <meta> tag inside
// SharedPoemView.tsx's srcDoc), which keeps governing that separate document.
const nextConfig: NextConfig = {
  // poetic/browser is CommonJS; let Next.js's bundler transpile it rather
  // than treating it as pre-built. See TECH-DEBT.md TD26071301.
  transpilePackages: ["poetic"],
};

export default nextConfig;
