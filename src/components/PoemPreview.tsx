"use client";

import { useCallback, useMemo, useRef } from "react";
import DOMPurify from "dompurify";

interface PoemPreviewProps {
  html: string;
  css: string;
}

// poetic's Analysis section (_poem-content.pug, upstream in the poetic
// repo) shows/hides its content via inline onclick handlers, which
// DOMPurify.sanitize() strips. The preview iframe has no allow-scripts, so
// those handlers couldn't run even unsanitised — rewire the same behaviour
// here instead, via allow-same-origin DOM access rather than by executing
// script inside the sandboxed content.
export function wireAnalysisToggles(doc: Document) {
  doc
    .querySelectorAll<HTMLElement>("button.analysis.show")
    .forEach((showButton) => {
      const panel = doc.getElementById(showButton.id.replace(/^show-/, ""));
      if (!panel) return;
      const hideButton = panel.querySelector<HTMLElement>(
        "button.analysis.hide",
      );

      showButton.addEventListener("click", () => {
        panel.style.display = "block";
        showButton.style.display = "none";
      });
      hideButton?.addEventListener("click", () => {
        panel.style.display = "none";
        showButton.style.display = "block";
      });
    });

  doc
    .querySelectorAll<HTMLElement>("button.analysis.selector")
    .forEach((selectorButton) => {
      const match = selectorButton.id.match(
        /^analysis-select-(syno|full)--(.+)$/,
      );
      if (!match) return;
      const [, variant, slug] = match;
      const synoPanel = doc.getElementById(`analysis-syno--${slug}`);
      const fullPanel = doc.getElementById(`analysis-full--${slug}`);
      const synoButton = doc.getElementById(`analysis-select-syno--${slug}`);
      const fullButton = doc.getElementById(`analysis-select-full--${slug}`);
      if (!synoPanel || !fullPanel || !synoButton || !fullButton) return;

      const showsSynopsis = variant === "syno";
      selectorButton.addEventListener("click", () => {
        // The full panel starts with poetic's `hidden` class, whose
        // `display: none !important` an inline style.display can't
        // override, so toggle that class rather than style.display.
        synoPanel.classList.toggle("hidden", !showsSynopsis);
        fullPanel.classList.toggle("hidden", showsSynopsis);
        synoButton.classList.toggle("selected", showsSynopsis);
        fullButton.classList.toggle("selected", !showsSynopsis);
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

  const srcDoc = useMemo(() => {
    const sanitised = DOMPurify.sanitize(html);
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><style>${css}</style></head><body><div class="container">${sanitised}</div></body></html>`;
  }, [html, css]);

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
