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
 * inherits this policy too — alongside, not instead of, any <meta> CSP of its
 * own (the tag inside SharedPoemView.tsx's srcDoc; PoemPreview.tsx's has
 * none). CSP is additive, so content must satisfy every policy that applies.
 * Both components therefore thread this policy's nonce into their inline
 * <style>, which its style-src requires regardless of what a <meta> CSP
 * allows (issue #97).
 *
 * `nonce` is minted per-request by `src/proxy.ts` — script-src/style-src carry
 * it instead of `'unsafe-inline'`. Poem content itself never reaches this
 * top-level document unsanitised — it's always rendered inside a sandboxed,
 * script-less iframe (PoemPreview.tsx / SharedPoemView.tsx).
 *
 * `style-src-attr` is separate from `style-src` because a nonce is an
 * element-level source — it can never satisfy an attribute-level check — and
 * poetic's rendered markup carries per-instance sizing as inline `style`
 * attributes (`.song-embed-player`'s `--song-embed-height`/
 * `--song-embed-aspect-ratio`, `.postscript-content`'s `--preview-lines`;
 * see poetic's `_poem-content.pug` and `song-handlers.js`). Adding
 * `'unsafe-inline'` to the nonce-carrying `style-src` instead would be
 * ignored (a nonce voids `'unsafe-inline'` within the same directive), so
 * this has to be its own directive (issue #119). The relaxation is narrow —
 * `<style>` elements stay nonce-gated, so TD26072101 isn't reverted — and a
 * style attribute cannot execute script; the content carrying them is
 * DOMPurify-sanitised and confined to sandboxed, script-less iframes. Any
 * exfiltration channel a style attribute could open is closed separately by
 * `img-src`/`font-src`, which allow only `'self'` and `data:`.
 *
 * Every engine the app targets honours `style-src-attr` (Chrome 75, Firefox
 * 108, Safari 15.4). An older one ignores the unrecognised directive and
 * falls back to `style-src`, so it fails closed — the attributes stay
 * dropped there, exactly as they are everywhere without this directive —
 * rather than the relaxation applying where it wasn't understood.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
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
