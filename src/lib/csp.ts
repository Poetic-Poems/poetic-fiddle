// The Supabase project ref differs per environment and NEXT_PUBLIC_SUPABASE_URL
// isn't set during CI's plain `npm run build` (src/lib/supabase-server.ts), so
// a wildcard host covers every environment without depending on an env var at
// config-eval time.
const SUPABASE_CONNECT_SRC = "https://*.supabase.co";

// Hosts poetic's song-handler embeds can point at (src/lib/render-share.ts'
// EMBED_ALLOWED_HOSTS, restated here as the frame-src origins). A srcdoc
// iframe (SharedPoemView.tsx) inherits this top-level policy in addition to
// its own <meta> CSP — CSP is additive, so both must allow a framed embed to
// load — and with no frame-src here that inherited policy would fall back
// to default-src 'self', blocking the embeds regardless of the <meta> tag's
// own allow-list (issue #97).
const EMBED_FRAME_SRC = "https://mega.nz https://audiomack.com";

/**
 * A strict, site-wide CSP for the app's own pages (editor, dashboard, legal) —
 * AC85's CSP half (REQUIREMENTS.md §12.4; the sanitisation half shipped in
 * M6). A srcdoc iframe has no response of its own to carry a CSP, so it
 * inherits this policy alongside its own <meta> CSP (the tag inside
 * PoemPreview.tsx's / SharedPoemView.tsx's srcDoc) — CSP is additive, so
 * content must satisfy both. Both components thread this policy's nonce
 * into their inline <style> to satisfy this policy's style-src as well as
 * their own (issue #97).
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
    `frame-src ${EMBED_FRAME_SRC}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
