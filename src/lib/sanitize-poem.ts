import type { Config } from "dompurify";

/**
 * The untrusted-content sanitisation boundary shared by every context that
 * turns poetic's rendered HTML into something shown to a visitor: the live
 * preview (`PoemPreview.tsx`, client-side, DOMPurify's browser build) and the
 * share page (`render-share.ts`, server-side, DOMPurify instantiated against
 * a jsdom `window`). poetic performs no sanitisation itself — see
 * poetic/docs/RENDERER-BROWSER.md — so this is the one place that decision is
 * made, rather than two independently-maintained copies of it.
 *
 * This intentionally accepts DOMPurify's own defaults (no `<script>`, no
 * `on*` handlers, no `<iframe>` — everything else, including inline `style`
 * and `data-*` attributes poetic's own markup relies on, kept) rather than a
 * bespoke allow-list, so a future tightening happens once, here, instead of
 * drifting between the two call sites. Each context still layers on whatever
 * return-shape option only it needs (e.g. `RETURN_DOM_FRAGMENT` server-side).
 */
export const POEM_SANITIZE_CONFIG: Config = {};
