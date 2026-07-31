"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderPoem } from "poetic/browser";
import { EXAMPLE_POEM } from "@/lib/example-poem";
import { loadDraft, saveDraft, clearDraft } from "@/lib/draft-storage";
import {
  loadPoem,
  savePoem,
  sharePoem,
  unsharePoem,
  updateAllowRemix,
} from "@/lib/poems-store";
import { revalidateSharedPoem } from "@/lib/revalidate-share";
import { useSession } from "@/lib/use-session";
import { errorMessage } from "@/lib/errors";

const DEBOUNCE_MS = 200;

export function tryRenderPoem(
  text: string,
  previousHtml: string = "",
): { html: string; error: string | null } {
  try {
    return { html: renderPoem(text), error: null };
  } catch (err) {
    return {
      html: previousHtml,
      error: errorMessage(err),
    };
  }
}

export interface UsePoemPersistenceOptions {
  /**
   * Opens a specific saved poem instead of the anonymous draft/example —
   * the poem's id then survives a reload because it lives in the URL
   * (`/poems/[id]`) rather than only in this hook's state.
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

/**
 * Orchestrates a poem's whole persistence lifecycle: which anonymous draft or
 * saved poem the editor opens with, session-driven draft migration, debounced
 * preview rendering, and the four Supabase-backed save/share/unshare/
 * allow-remix flows. `Editor.tsx` owns presentation only; every state
 * transition that isn't purely about how the editor looks lives here.
 */
export function usePoemPersistence({
  initialPoemId,
  initialSource,
}: UsePoemPersistenceOptions) {
  const session = useSession();

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
  const pendingDraftRef = useRef<string | null>(null);
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
  const [linkCopied, setLinkCopied] = useState(false);
  const linkCopiedTimeoutRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  // Null means "inherit the poet's remix_default" (AC114).
  const [allowRemix, setAllowRemix] = useState<boolean | null>(null);
  const [allowRemixSaving, setAllowRemixSaving] = useState(false);
  const [allowRemixError, setAllowRemixError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        // Flush: unmounting mid-debounce (e.g. navigating away right after
        // typing) must not drop the last edit that hadn't reached storage yet.
        if (pendingDraftRef.current !== null)
          saveDraft(pendingDraftRef.current);
      }
      if (linkCopiedTimeoutRef.current)
        clearTimeout(linkCopiedTimeoutRef.current);
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
        setOpenError(errorMessage(err));
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
    pendingDraftRef.current = value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pendingDraftRef.current = null;
      saveDraft(value);
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
      setSaveError(errorMessage(err));
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
      setShareError(errorMessage(err));
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
      setShareError(errorMessage(err));
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
        setAllowRemixError(errorMessage(err));
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

  const handleCopyShareLink = useCallback(() => {
    if (!shareUrl) return;
    setShareError(null);
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setLinkCopied(true);
        if (linkCopiedTimeoutRef.current)
          clearTimeout(linkCopiedTimeoutRef.current);
        linkCopiedTimeoutRef.current = setTimeout(
          () => setLinkCopied(false),
          2000,
        );
      })
      .catch((err) => {
        setShareError(errorMessage(err));
      });
  }, [shareUrl]);

  const saveStatus = !session
    ? ""
    : saving
      ? "Saving…"
      : hasUnsavedChanges
        ? "Unsaved changes"
        : "Saved";

  const dismissSignInPrompt = useCallback(() => {
    setSignInPromptAction(null);
  }, []);

  return {
    session,
    source,
    rendered,
    handleChange,
    opening,
    openError,
    saving,
    saveError,
    saveStatus,
    handleSave,
    sharing,
    shareError,
    shareId,
    shareUrl,
    handleShare,
    unsharing,
    handleUnshare,
    linkCopied,
    handleCopyShareLink,
    allowRemix,
    allowRemixSaving,
    allowRemixError,
    handleAllowRemixChange,
    signInPromptAction,
    dismissSignInPrompt,
  };
}
