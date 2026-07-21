import type { NextConfig } from "next";

// The Supabase project ref differs per environment and NEXT_PUBLIC_SUPABASE_URL
// isn't set during CI's plain `npm run build` (src/lib/supabase-server.ts), so
// a wildcard host covers every environment without depending on an env var at
// config-eval time.
const SUPABASE_CONNECT_SRC = "https://*.supabase.co";

// A strict, site-wide CSP for the app's own pages (editor, dashboard, legal) —
// AC85's CSP half (REQUIREMENTS.md §12.4; the sanitisation half shipped in
// M6). It does not touch the share iframe's own CSP (the <meta> tag inside
// SharedPoemView.tsx's srcDoc), which keeps governing that separate document.
//
// script-src/style-src carry 'unsafe-inline': the App Router embeds its RSC
// hydration payload as inline <script> tags, and CodeMirror (style-mod)
// injects the editor's styles as an inline <style> tag; next.config.ts's
// headers() can't hand out a per-request nonce to make either of those
// stricter (that needs middleware — TECH-DEBT.md TD26072101). Poem content
// itself never reaches this top-level document unsanitised — it's always
// rendered inside a sandboxed, script-less iframe (PoemPreview.tsx /
// SharedPoemView.tsx) — so this allowance doesn't reopen AC85's actual threat
// model of a poem's own markup executing in a viewer's session.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_CONNECT_SRC}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // poetic/browser is CommonJS; let Next.js's bundler transpile it rather
  // than treating it as pre-built. See TECH-DEBT.md TD26071301.
  transpilePackages: ["poetic"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
        ],
      },
    ];
  },
};

export default nextConfig;
