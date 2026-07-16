"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { renderPoem } from "poetic/browser";
import { poemLanguage, poemSyntaxHighlighting } from "@/lib/poem-syntax";
import { PoemPreview } from "@/components/PoemPreview";
import { SignInPrompt } from "@/components/SignInPrompt";
import { EXAMPLE_POEM, POEM_SYNTAX_REFERENCE_URL } from "@/lib/example-poem";
import { loadDraft, saveDraft, clearDraft } from "@/lib/draft-storage";
import { savePoem } from "@/lib/poems-store";
import { supabase } from "@/lib/supabase-client";
import { useSession } from "@/lib/use-session";

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
  const session = useSession();
  const [migratedUserId, setMigratedUserId] = useState<string | null>(null);
  const [poemId, setPoemId] = useState<string | null>(null);
  const [savedSource, setSavedSource] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // AC9: on first sign-in, the anonymous localStorage draft (if any) becomes
  // this session's poem instead of being silently left behind. Adjusted
  // during render (React's "resetting state when a prop changes" pattern)
  // rather than in an effect, guarded per-user so a later token refresh
  // (a new session object for the same user) doesn't re-run it; loadDraft()
  // returning null after the first run makes repeat sign-ins a no-op anyway.
  if (session && session.user.id !== migratedUserId) {
    setMigratedUserId(session.user.id);
    const draft = loadDraft();
    if (draft !== null) {
      setSource(draft);
      setRendered(tryRenderPoem(draft));
      clearDraft();
    }
    // A saved poem belongs to the account that saved it, so a different user
    // signing in starts from no row: their Save inserts a poem of their own
    // rather than updating one they don't own (which RLS would refuse anyway).
    forgetSavedPoem();
  }

  // Signing out does the same, so the editor doesn't hold a row identity no
  // session can write to.
  if (!session && migratedUserId !== null) {
    setMigratedUserId(null);
    forgetSavedPoem();
  }

  function forgetSavedPoem() {
    setPoemId(null);
    setSavedSource(null);
    setSaveError(null);
  }

  const handleChange = useCallback((value: string) => {
    setSource(value);
    saveDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRendered((previous) => tryRenderPoem(value, previous.html));
    }, DEBOUNCE_MS);
  }, []);

  const handleSave = useCallback(async () => {
    if (!session) {
      setSignInPromptAction("save");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const saved = await savePoem({
        id: poemId,
        ownerId: session.user.id,
        source,
      });
      setPoemId(saved.id);
      // The source as it was sent, not as it stands now: an edit made while the
      // save was in flight leaves the poem legitimately unsaved (AC14).
      setSavedSource(source);
    } catch (err) {
      // The editor keeps every edit either way — a failed save changes nothing
      // but the message (AC94, AC95).
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [poemId, session, source]);

  const hasUnsavedChanges = savedSource !== source;
  const saveStatus = !session
    ? ""
    : saving
      ? "Saving…"
      : hasUnsavedChanges
        ? "Unsaved changes"
        : "Saved";

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 pb-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {saveError && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {saveError}
          </p>
        )}
        <span
          role="status"
          aria-label="Save status"
          className="text-sm text-foreground/70"
        >
          {saveStatus}
        </span>
        {session && (
          <>
            <span className="text-sm text-foreground/70">
              {session.user.email}
            </span>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="text-sm text-foreground/70 underline underline-offset-2"
            >
              Sign out
            </button>
          </>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/5"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            if (!session) setSignInPromptAction("share");
          }}
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
