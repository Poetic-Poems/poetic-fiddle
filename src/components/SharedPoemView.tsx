"use client";

import { useCallback, useMemo, useRef } from "react";
import { wireAnalysisToggles } from "@/components/PoemPreview";

interface SharedPoemViewProps {
  /**
   * Already sanitised and embed-activated by src/lib/render-share.ts — this
   * component trusts it and does not sanitise again (re-running DOMPurify's
   * default config here would strip the real <iframe> embeds that step adds).
   */
  html: string;
  css: string;
  title: string;
}

const EMBED_HOSTS = "https://mega.nz https://audiomack.com";

/**
 * A strict Content-Security-Policy for the sandboxed document below, as a
 * backstop independent of the server-side sanitisation: even if a <script>
 * somehow survived DOMPurify, `script-src 'none'` stops it running here. It
 * does not restrict the allow-listed embeds themselves — those are separate
 * framed documents governed by their own origin's policy, not this one;
 * `frame-src` here just re-states the same host allow-list as a second,
 * browser-enforced line of defence (AC86).
 */
const CONTENT_SECURITY_POLICY = `default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; style-src 'unsafe-inline'; img-src * data:; media-src *; frame-src ${EMBED_HOSTS};`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders a shared poem's sanitised HTML inside an isolated iframe — the
 * same style-isolation technique PoemPreview uses for full poetic CSS
 * fidelity (AC24) — except this sandbox also grants `allow-scripts`: AC25
 * requires the *full* media player here (not the editor preview's
 * best-effort), and a sandboxed iframe's restrictions propagate to anything
 * nested inside it, including the song-embed iframes render-share.ts
 * activates. `allow-scripts` + `allow-same-origin` together would normally
 * be avoided (MDN warns against the combination), but the CSP above
 * neutralises the residual risk for our own sanitised content, and
 * `allow-same-origin` is what lets `wireAnalysisToggles` reach the iframe's
 * DOM the same way the editor preview does — without it, a poem's Analysis
 * section would stay permanently hidden (poeticCss sets `display: none`
 * until the toggle reveals it), which AC84's "viewable without client-side
 * JS" doesn't excuse.
 *
 * Uses `srcDoc`, a plain HTML attribute the browser honours with no JS: the
 * page is fully viewable without client-side JS (AC84); `wireAnalysisToggles`
 * only enhances the Analysis show/hide toggle once JS does run.
 */
export function SharedPoemView({ html, css, title }: SharedPoemViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = useMemo(
    () =>
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" /><title>${escapeHtml(title)}</title><style>${css}</style></head><body><div class="container">${html}</div></body></html>`,
    [html, css, title],
  );

  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc) wireAnalysisToggles(doc);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin allow-popups"
      onLoad={handleLoad}
      className="h-full min-h-[70vh] w-full flex-1 rounded-lg border border-black/10 bg-white dark:border-white/10"
    />
  );
}
