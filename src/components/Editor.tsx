"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { renderPoem } from "poetic/browser";
import { poemLanguage, poemSyntaxHighlighting } from "@/lib/poem-syntax";
import { PoemPreview } from "@/components/PoemPreview";
import { SignInPrompt } from "@/components/SignInPrompt";
import { EXAMPLE_POEM, POEM_SYNTAX_REFERENCE_URL } from "@/lib/example-poem";
import { loadDraft, saveDraft } from "@/lib/draft-storage";

const DEBOUNCE_MS = 200;

const EXTENSIONS = [poemLanguage, poemSyntaxHighlighting];

export function tryRenderPoem(
  text: string,
  previousHtml: string = "",
): { html: string; error: string | null } {
  try {
    return { html: renderPoem(text), error: null };
  } catch (err) {
    return {
      html: previousHtml,
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
  const [source, setSource] = useState(() => loadDraft() ?? EXAMPLE_POEM);
  const [rendered, setRendered] = useState(() => tryRenderPoem(source));
  const [signInPromptAction, setSignInPromptAction] = useState<
    "save" | "share" | null
  >(null);
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
    saveDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRendered((previous) => tryRenderPoem(value, previous.html));
    }, DEBOUNCE_MS);
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 pb-6">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setSignInPromptAction("save")}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setSignInPromptAction("share")}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
        >
          Share
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
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
      <SignInPrompt
        action={signInPromptAction}
        onClose={() => setSignInPromptAction(null)}
      />
    </div>
  );
}
