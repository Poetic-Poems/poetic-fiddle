"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import { useNonce } from "@/lib/nonce-context";
import { POEM_SANITIZE_CONFIG } from "@/lib/sanitize-poem";
import {
  evaluatePostscriptPreviews,
  POSTSCRIPT_RESIZE_DEBOUNCE_MS,
  wirePoemToggles,
} from "@/lib/poem-toggles";

interface PoemPreviewProps {
  html: string;
  css: string;
}

/**
 * Renders sanitised poem HTML inside an isolated iframe, bundling poetic's
 * own CSS so page-level selectors (`body`, `h1`, …) style the preview
 * without ever touching Fiddle's app shell.
 *
 * This srcDoc inherits the app shell's CSP (src/lib/csp.ts) in addition to
 * anything of its own — before merging a change that touches this file, run
 * docs/CSP-REVIEW-CHECKLIST.md against a real browser.
 */
export function PoemPreview({ html, css }: PoemPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // A srcdoc iframe has no response of its own to carry a CSP, so it
  // inherits the parent document's — including its style-src nonce
  // requirement. Without a matching nonce here, the inherited policy drops
  // this <style> and poetic's entire stylesheet along with it (issue #97).
  const nonce = useNonce();

  const srcDoc = useMemo(() => {
    const sanitised = DOMPurify.sanitize(html, POEM_SANITIZE_CONFIG);
    const styleTag = nonce
      ? `<style nonce="${nonce}">${css}</style>`
      : `<style>${css}</style>`;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />${styleTag}</head><body><div class="container">${sanitised}</div></body></html>`;
  }, [html, css, nonce]);

  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    wirePoemToggles(doc);
    evaluatePostscriptPreviews(doc);
  }, []);

  // A ResizeObserver on the iframe itself, rather than a window `resize`
  // listener, is what covers the editor's mobile preview pane: that pane
  // stays mounted at `display: none` while the source pane shows, so the
  // iframe renders at zero size and evaluatePostscriptPreviews (run from
  // handleLoad above) sees a zero-size box and never clamps. Toggling the
  // pane back to visible changes the iframe's rendered size without firing
  // `load` or a window `resize`, but a ResizeObserver reports exactly that
  // 0 -> sized transition, so it also covers the window-resize case
  // TD-PPpfid-26080108's listener existed for.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let resizeTimer: ReturnType<typeof setTimeout>;
    const scheduleEvaluate = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const doc = iframeRef.current?.contentDocument;
        if (doc) evaluatePostscriptPreviews(doc);
      }, POSTSCRIPT_RESIZE_DEBOUNCE_MS);
    };

    const observer = new ResizeObserver(scheduleEvaluate);
    observer.observe(iframe);
    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="Poem preview"
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      onLoad={handleLoad}
      className="h-full min-h-0 w-full flex-1 rounded-lg border border-black/10 bg-white dark:border-white/10"
    />
  );
}
