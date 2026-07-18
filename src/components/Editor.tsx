"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CodeMirror from "@uiw/react-codemirror";
import { renderPoem } from "poetic/browser";
import { poemLanguage, poemSyntaxHighlighting } from "@/lib/poem-syntax";
import { PoemPreview } from "@/components/PoemPreview";
import { SignInPrompt } from "@/components/SignInPrompt";
import { EXAMPLE_POEM, POEM_SYNTAX_REFERENCE_URL } from "@/lib/example-poem";
import { loadDraft, saveDraft, clearDraft } from "@/lib/draft-storage";
import {
  loadPoem,
  savePoem,
  sharePoem,
  unsharePoem,
  updateAllowRemix,
} from "@/lib/poems-store";
import { revalidateSharedPoem } from "@/lib/revalidate-share";
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
  /**
   * Opens a specific saved poem instead of the anonymous draft/example —
   * the poem's id then survives a reload because it lives in the URL
   * (`/poems/[id]`) rather than only in this component's state.
   */
  initialPoemId?: string;
  /**
   * Seeds the editor with source that isn't (yet) a row of the poet's own —
   * a remix of someone else's shared poem (`/remix/[share_id]`, AC20). No
   * `poemId` comes with it deliberately: the copy is independent, so the
   * first Save inserts a new poem owned by whoever is signed in, leaving the
   * original untouched.
   */
  initialSource?: string;
}

export default function Editor({
  poeticCss,
  initialPoemId,
  initialSource,
}: EditorProps) {
  const [source, setSource] = useState(() =>
    initialPoemId ? "" : (initialSource ?? loadDraft() ?? EXAMPLE_POEM),
  );
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
  const [opening, setOpening] = useState(Boolean(initialPoemId));
  const [openError, setOpenError] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [unsharing, setUnsharing] = useState(false);
  // Null means "inherit the poet's remix_default" (AC114).
  const [allowRemix, setAllowRemix] = useState<boolean | null>(null);
  const [allowRemixSaving, setAllowRemixSaving] = useState(false);
  const [allowRemixError, setAllowRemixError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // AC21: an anonymous remix is just an anonymous draft — persisted to
  // localStorage on arrival so it survives a reload, and adopted into the
  // account on sign-in like any other draft (AC7–AC10). It replaces whatever
  // draft was there, which is the same single-draft model the editor already
  // has: one anonymous poem in progress at a time.
  useEffect(() => {
    if (initialSource !== undefined) saveDraft(initialSource);
  }, [initialSource]);

  // Opening a saved poem fetches its source once and adopts it as this
  // session's poem (AC15) — the fix for the reload-loses-the-id gap: the id
  // now comes from the URL, not just from in-memory state.
  useEffect(() => {
    if (!initialPoemId) return;
    let cancelled = false;
    loadPoem(initialPoemId)
      .then((poem) => {
        if (cancelled) return;
        setSource(poem.source);
        setRendered(tryRenderPoem(poem.source));
        setPoemId(poem.id);
        setSavedSource(poem.source);
        setShareId(poem.shareId);
        setAllowRemix(poem.allowRemix);
        setOpening(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setOpenError(err instanceof Error ? err.message : String(err));
        setOpening(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialPoemId]);

  // AC9: on first sign-in, the anonymous localStorage draft (if any) becomes
  // this session's poem instead of being silently left behind. Adjusted
  // during render (React's "resetting state when a prop changes" pattern)
  // rather than in an effect, guarded per-user so a later token refresh
  // (a new session object for the same user) doesn't re-run it; loadDraft()
  // returning null after the first run makes repeat sign-ins a no-op anyway.
  //
  // Opening a specific poem (`initialPoemId`) skips the draft migration and
  // the forget below: this render also fires the first time a *returning*
  // signed-in poet's session resolves after a reload, which is exactly the
  // case that must NOT forget the poem `initialPoemId` is in the middle of
  // (re)loading. A remix (`initialSource`) skips it for the mirror-image
  // reason: the poem to keep is the one the URL names, so a leftover draft
  // must not overwrite it — the effect above has already made the remix the
  // stored draft, so nothing is stranded either way.
  if (session && session.user.id !== migratedUserId) {
    setMigratedUserId(session.user.id);
    if (!initialPoemId && initialSource === undefined) {
      const draft = loadDraft();
      if (draft !== null) {
        setSource(draft);
        setRendered(tryRenderPoem(draft));
        clearDraft();
      }
      // A saved poem belongs to the account that saved it, so a different
      // user signing in starts from no row: their Save inserts a poem of
      // their own rather than updating one they don't own (which RLS would
      // refuse anyway).
      forgetSavedPoem();
    }
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
    setShareId(null);
    setShareError(null);
    setAllowRemix(null);
    setAllowRemixError(null);
  }

  const handleChange = useCallback((value: string) => {
    setSource(value);
    saveDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRendered((previous) => tryRenderPoem(value, previous.html));
    }, DEBOUNCE_MS);
  }, []);

  const hasUnsavedChanges = savedSource !== source;

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
      // Already shared: the permalink must reflect this save, not a stale
      // cached render, as soon as it's re-opened (AC19, AC82). Best-effort —
      // a failure here just leaves the cache to expire on its own schedule,
      // so it doesn't turn an otherwise-successful save into an error.
      if (saved.shareId) {
        revalidateSharedPoem(saved.shareId).catch(() => {});
      }
    } catch (err) {
      // The editor keeps every edit either way — a failed save changes nothing
      // but the message (AC94, AC95).
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [poemId, session, source]);

  const handleShare = useCallback(async () => {
    if (!session) {
      setSignInPromptAction("share");
      return;
    }

    setSharing(true);
    setShareError(null);
    try {
      // Share always mints/reveals a link for the *current* source (AC17):
      // save first if there's nothing saved yet, or the poem has changed
      // since the last save.
      let idToShare = poemId;
      if (idToShare === null || hasUnsavedChanges) {
        const saved = await savePoem({
          id: poemId,
          ownerId: session.user.id,
          source,
        });
        setPoemId(saved.id);
        setSavedSource(source);
        idToShare = saved.id;
      }
      // Idempotent: re-clicking Share on an already-shared poem returns the
      // same id rather than minting a new one.
      const newShareId = await sharePoem(idToShare);
      setShareId(newShareId);
      revalidateSharedPoem(newShareId).catch(() => {});
    } catch (err) {
      setShareError(err instanceof Error ? err.message : String(err));
    } finally {
      setSharing(false);
    }
  }, [hasUnsavedChanges, poemId, session, source]);

  // Reverses Share: moves the poem back to draft so its permalink stops
  // serving. `poemId` is always set here (this only renders once `shareId`
  // is), and the cache invalidation is best-effort, matching handleSave's
  // treatment of the same call — a failure here leaves the cache to expire
  // on its own schedule rather than turning a successful unshare into an
  // error.
  const handleUnshare = useCallback(async () => {
    if (!poemId || !shareId) return;

    setUnsharing(true);
    setShareError(null);
    try {
      await unsharePoem(poemId);
      setShareId(null);
      revalidateSharedPoem(shareId).catch(() => {});
    } catch (err) {
      setShareError(err instanceof Error ? err.message : String(err));
    } finally {
      setUnsharing(false);
    }
  }, [poemId, shareId]);

  // Sets this poem's remix override (AC114). Mirrors handleShare's
  // save-if-needed pattern: a poet setting the override on an unsaved poem
  // saves it first, rather than the control silently doing nothing.
  const handleAllowRemixChange = useCallback(
    async (value: boolean | null) => {
      if (!session) {
        setSignInPromptAction("save");
        return;
      }

      setAllowRemixSaving(true);
      setAllowRemixError(null);
      try {
        let idToUpdate = poemId;
        if (idToUpdate === null || hasUnsavedChanges) {
          const saved = await savePoem({
            id: poemId,
            ownerId: session.user.id,
            source,
          });
          setPoemId(saved.id);
          setSavedSource(source);
          idToUpdate = saved.id;
        }
        setAllowRemix(await updateAllowRemix(idToUpdate, value));
      } catch (err) {
        setAllowRemixError(err instanceof Error ? err.message : String(err));
      } finally {
        setAllowRemixSaving(false);
      }
    },
    [hasUnsavedChanges, poemId, session, source],
  );

  const shareUrl =
    shareId && typeof window !== "undefined"
      ? `${window.location.origin}/share/${shareId}`
      : null;

  const saveStatus = !session
    ? ""
    : saving
      ? "Saving…"
      : hasUnsavedChanges
        ? "Unsaved changes"
        : "Saved";

  if (openError) {
    return (
      <div className="flex flex-1 flex-col items-start gap-3 px-6 pb-6">
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {openError}
        </p>
        <Link
          href="/poems"
          className="text-sm text-primary underline underline-offset-2"
        >
          Back to My poems
        </Link>
      </div>
    );
  }

  if (opening) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 pb-6">
        <p role="status" className="text-sm text-foreground/70">
          Opening your poem…
        </p>
      </div>
    );
  }

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
            <Link
              href="/poems"
              className="text-sm text-foreground/70 underline underline-offset-2"
            >
              My poems
            </Link>
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
          onClick={handleShare}
          disabled={sharing}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {sharing ? "Sharing…" : "Share"}
        </button>
      </div>
      {session && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10">
          <label htmlFor="poem-allow-remix" className="text-foreground/70">
            Remixing this poem:
          </label>
          <select
            id="poem-allow-remix"
            value={
              allowRemix === null ? "default" : allowRemix ? "allow" : "deny"
            }
            disabled={allowRemixSaving}
            onChange={(event) => {
              const next = event.target.value;
              handleAllowRemixChange(
                next === "default" ? null : next === "allow",
              );
            }}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          >
            <option value="default">Use my default setting</option>
            <option value="allow">Always allow</option>
            <option value="deny">Never allow</option>
          </select>
          {allowRemixError && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {allowRemixError}
            </p>
          )}
        </div>
      )}
      {shareError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {shareError}
        </p>
      )}
      {shareUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10">
          <span className="text-foreground/70">Share link:</span>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {shareUrl}
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="ml-auto rounded-md border border-black/10 px-2 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={handleUnshare}
            disabled={unsharing}
            className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/5"
          >
            {unsharing ? "Unsharing…" : "Unshare"}
          </button>
        </div>
      )}
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
