"use client";

import { useCallback, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import { useNonce } from "@/lib/nonce-context";

interface PoemPreviewProps {
  html: string;
  css: string;
}

// poetic's Analysis section (_poem-content.pug, upstream in the poetic repo)
// keeps its show/hide and synopsis/full state in `aria-expanded`,
// `aria-pressed` and `data-*` attributes, which poetic.css keys visibility off
// through attribute selectors; poetic's own poetic.js flips them from a single
// delegated click listener. Fiddle never loads that script — the preview
// iframe grants no allow-scripts at all — so mirror the listener here,
// reaching the document through allow-same-origin rather than by executing
// script inside the sandboxed content. Setting the same attributes (rather
// than inline styles or classes of Fiddle's own) is what keeps the CSS in
// charge of what is visible, so the preview matches a published page.
export function wireAnalysisToggles(doc: Document) {
  doc.addEventListener("click", (event) => {
    // Not `instanceof Element`: in the preview iframe these nodes come from
    // another realm, whose Element is a different constructor.
    const target = event.target as Element | null;
    if (typeof target?.closest !== "function") return;

    const showButton = target.closest(".analysis.show");
    if (showButton) {
      showButton.setAttribute("aria-expanded", "true");
      return;
    }

    const hideButton = target.closest(".analysis.hide");
    if (hideButton) {
      const showButtonId = hideButton.getAttribute("data-analysis-toggle");
      if (showButtonId) {
        doc
          .getElementById(showButtonId)
          ?.setAttribute("aria-expanded", "false");
      }
      return;
    }

    const selectButton = target.closest(".analysis.selector");
    const group = selectButton?.closest(".full-or-synopsis-selector");
    if (!selectButton || !group) return;

    const panel = selectButton.getAttribute("data-analysis-select");
    if (panel) group.setAttribute("data-selected", panel);
    group.querySelectorAll(".analysis.selector").forEach((button) => {
      button.setAttribute("aria-pressed", String(button === selectButton));
    });
  });
}

/**
 * Renders sanitised poem HTML inside an isolated iframe, bundling poetic's
 * own CSS so page-level selectors (`body`, `h1`, …) style the preview
 * without ever touching Fiddle's app shell.
 */
export function PoemPreview({ html, css }: PoemPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // A srcdoc iframe has no response of its own to carry a CSP, so it
  // inherits the parent document's — including its style-src nonce
  // requirement. Without a matching nonce here, the inherited policy drops
  // this <style> and poetic's entire stylesheet along with it (issue #97).
  const nonce = useNonce();

  const srcDoc = useMemo(() => {
    const sanitised = DOMPurify.sanitize(html);
    const styleTag = nonce
      ? `<style nonce="${nonce}">${css}</style>`
      : `<style>${css}</style>`;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />${styleTag}</head><body><div class="container">${sanitised}</div></body></html>`;
  }, [html, css, nonce]);

  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc) wireAnalysisToggles(doc);
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
