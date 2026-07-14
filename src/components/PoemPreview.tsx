"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";

interface PoemPreviewProps {
  html: string;
  css: string;
}

/**
 * Renders sanitised poem HTML inside an isolated iframe, bundling poetic's
 * own CSS so page-level selectors (`body`, `h1`, …) style the preview
 * without ever touching Fiddle's app shell.
 */
export function PoemPreview({ html, css }: PoemPreviewProps) {
  const srcDoc = useMemo(() => {
    const sanitised = DOMPurify.sanitize(html);
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><style>${css}</style></head><body><div class="container">${sanitised}</div></body></html>`;
  }, [html, css]);

  return (
    <iframe
      title="Poem preview"
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      className="h-full min-h-0 w-full flex-1 rounded-lg border border-black/10 bg-white dark:border-white/10"
    />
  );
}
