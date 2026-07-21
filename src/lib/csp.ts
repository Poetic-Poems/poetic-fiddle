// The Supabase project ref differs per environment and NEXT_PUBLIC_SUPABASE_URL
// isn't set during CI's plain `npm run build` (src/lib/supabase-server.ts), so
// a wildcard host covers every environment without depending on an env var at
// config-eval time.
const SUPABASE_CONNECT_SRC = "https://*.supabase.co";

/**
 * A strict, site-wide CSP for the app's own pages (editor, dashboard, legal) —
 * AC85's CSP half (REQUIREMENTS.md §12.4; the sanitisation half shipped in
 * M6). It does not touch the share iframe's own CSP (the <meta> tag inside
 * SharedPoemView.tsx's srcDoc), which keeps governing that separate document.
 *
 * `nonce` is minted per-request by `src/proxy.ts` — script-src/style-src carry
 * it instead of `'unsafe-inline'`. Poem content itself never reaches this
 * top-level document unsanitised — it's always rendered inside a sandboxed,
 * script-less iframe (PoemPreview.tsx / SharedPoemView.tsx).
 */
export function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src 'self' ${SUPABASE_CONNECT_SRC}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
