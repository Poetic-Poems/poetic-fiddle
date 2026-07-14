"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { renderPoem } from "poetic/browser";
import { poemLanguage, poemSyntaxHighlighting } from "@/lib/poem-syntax";
import { PoemPreview } from "@/components/PoemPreview";
import { EXAMPLE_POEM, POEM_SYNTAX_REFERENCE_URL } from "@/lib/example-poem";

const DEBOUNCE_MS = 200;

const EXTENSIONS = [poemLanguage, poemSyntaxHighlighting];

function tryRenderPoem(text: string): { html: string; error: string | null } {
  try {
    return { html: renderPoem(text), error: null };
  } catch (err) {
    return {
      html: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function usePrefersDark() {
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) =>
      setPrefersDark(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return prefersDark;
}

interface EditorProps {
  poeticCss: string;
}

export default function Editor({ poeticCss }: EditorProps) {
  const [source, setSource] = useState(EXAMPLE_POEM);
  const [rendered, setRendered] = useState(() => tryRenderPoem(EXAMPLE_POEM));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const prefersDark = usePrefersDark();

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback((value: string) => {
    setSource(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRendered(tryRenderPoem(value));
    }, DEBOUNCE_MS);
  }, []);

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-2">
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="poem-source" className="text-sm font-medium">
            Your poem
          </label>
          <a
            href={POEM_SYNTAX_REFERENCE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline underline-offset-2"
          >
            Syntax reference
          </a>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-black/10 dark:border-white/10">
          <CodeMirror
            id="poem-source"
            value={source}
            height="100%"
            theme={prefersDark ? "dark" : "light"}
            extensions={EXTENSIONS}
            onChange={handleChange}
          />
        </div>
        <p
          role="status"
          className="min-h-5 text-sm text-amber-600 dark:text-amber-400"
        >
          {rendered.error
            ? `Couldn't parse the poem yet: ${rendered.error}`
            : ""}
        </p>
      </div>
      <div className="flex min-h-0 flex-col gap-2">
        <span className="text-sm font-medium">Preview</span>
        <PoemPreview html={rendered.html} css={poeticCss} />
      </div>
    </div>
  );
}
