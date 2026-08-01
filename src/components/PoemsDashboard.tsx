"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  deletePoem,
  getRemixDefault,
  listPoems,
  updateRemixDefault,
  type SavedPoem,
} from "@/lib/poems-store";
import { revalidateSharedPoem } from "@/lib/revalidate-share";
import { useSession } from "@/lib/use-session";
import { errorMessage } from "@/lib/errors";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; poems: SavedPoem[] }
  | { kind: "error"; message: string };

type RemixDefaultState =
  | { kind: "loading" }
  | { kind: "loaded"; value: boolean }
  | { kind: "error"; message: string };

export function PoemsDashboard() {
  const { session, loading: sessionLoading } = useSession();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [remixDefaultState, setRemixDefaultState] = useState<RemixDefaultState>(
    { kind: "loading" },
  );
  const [remixDefaultSaving, setRemixDefaultSaving] = useState(false);
  // Which poem (if any) is showing its "delete this poem?" confirmation, so
  // that step is per-row rather than a single global flag.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Tracks whose poems `state` reflects, so a later sign-in as a different
  // account resets to loading (state update during render, matching the
  // pattern Editor.tsx uses for its own per-user resets).
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null);

  if (session && session.user.id !== loadedForUserId) {
    setLoadedForUserId(session.user.id);
    setState({ kind: "loading" });
    setRemixDefaultState({ kind: "loading" });
  }

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    listPoems(session.user.id)
      .then((poems) => {
        if (!cancelled) setState({ kind: "loaded", poems });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message: errorMessage(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // AC114: the poet's global remix default, loaded alongside their poems so
  // the setting is visible as soon as the dashboard is.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getRemixDefault(session.user.id)
      .then((value) => {
        if (!cancelled) setRemixDefaultState({ kind: "loaded", value });
      })
      .catch((err) => {
        if (!cancelled) {
          setRemixDefaultState({
            kind: "error",
            message: errorMessage(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleRemixDefaultChange(checked: boolean) {
    if (!session) return;
    setRemixDefaultSaving(true);
    try {
      const value = await updateRemixDefault(session.user.id, checked);
      setRemixDefaultState({ kind: "loaded", value });
    } catch (err) {
      setRemixDefaultState({
        kind: "error",
        message: errorMessage(err),
      });
    } finally {
      setRemixDefaultSaving(false);
    }
  }

  // Deletes a poem after the poet has confirmed (AC22, AC92, TD26072414).
  // Runs only from the row's own confirmation step, so a stray click can't
  // remove a poem without that second, explicit step. A shared poem's row is
  // gone once this resolves, but its share page can still be served from
  // cache until the next natural expiry — the same gap Editor.tsx's
  // save/share/unshare already close by invalidating the cache tag, so a
  // deleted poem's permalink stops serving right away rather than staying
  // visible for up to the fallback expiry (AC92: removed from every surface).
  async function handleDeletePoem(poem: SavedPoem) {
    setDeletingId(poem.id);
    setDeleteError(null);
    try {
      await deletePoem(poem.id);
      setState((prev) =>
        prev.kind === "loaded"
          ? {
              kind: "loaded",
              poems: prev.poems.filter((p) => p.id !== poem.id),
            }
          : prev,
      );
      setConfirmDeleteId(null);
      if (poem.shareId) revalidateSharedPoem(poem.shareId).catch(() => {});
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  // While the session is still resolving, an already-signed-in poet must not
  // briefly see the sign-in prompt below (F-UX-06).
  if (sessionLoading) {
    return (
      <p role="status" className="px-6 text-sm text-foreground/70">
        Loading…
      </p>
    );
  }

  if (!session) {
    return (
      <p className="px-6 text-sm text-foreground/70">
        Sign in to see your saved poems.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 px-6">
        {remixDefaultState.kind === "loaded" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={remixDefaultState.value}
              disabled={remixDefaultSaving}
              onChange={(event) =>
                handleRemixDefaultChange(event.target.checked)
              }
            />
            <span className="text-foreground/70">
              Let others remix my poems by default (off unless you turn this on;
              you can still allow or block remixing per poem)
            </span>
            {remixDefaultSaving && (
              <span role="status" className="text-xs text-foreground/70">
                Saving…
              </span>
            )}
          </label>
        )}
        {remixDefaultState.kind === "error" && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {remixDefaultState.message}
          </p>
        )}
      </div>
      {state.kind === "loading" && (
        <p role="status" className="px-6 text-sm text-foreground/70">
          Loading your poems…
        </p>
      )}
      {state.kind === "error" && (
        <p role="alert" className="px-6 text-sm text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}
      {deleteError && (
        <p role="alert" className="px-6 text-sm text-red-700 dark:text-red-400">
          {deleteError}
        </p>
      )}
      {state.kind === "loaded" && state.poems.length === 0 && (
        <div className="flex flex-col items-start gap-2 px-6">
          <p className="text-sm text-foreground/70">
            You haven&rsquo;t saved a poem yet.
          </p>
          <Link
            href="/"
            className="text-sm text-link underline underline-offset-2"
          >
            Start writing
          </Link>
        </div>
      )}
      {state.kind === "loaded" && state.poems.length > 0 && (
        <ul className="flex flex-col gap-2 px-6">
          {state.poems.map((poem) => (
            <li key={poem.id} className="flex flex-wrap items-center gap-2">
              <Link
                href={`/poems/${poem.id}`}
                className="flex flex-1 items-center justify-between gap-4 rounded-lg border border-black/10 px-4 py-3 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
              >
                <span className="flex items-center gap-2 font-serif text-base font-medium">
                  {poem.title || "Untitled"}
                  {poem.shareId && (
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-normal text-foreground/70 dark:bg-white/10">
                      Shared
                    </span>
                  )}
                </span>
                <span className="text-xs text-foreground/60">
                  {new Date(poem.updatedAt).toLocaleDateString()}
                </span>
              </Link>
              {confirmDeleteId === poem.id ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                  <span className="text-foreground/70">Delete this poem?</span>
                  <button
                    type="button"
                    onClick={() => handleDeletePoem(poem)}
                    disabled={deletingId === poem.id}
                    className="rounded-md border border-red-700 px-2 py-1 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    {deletingId === poem.id ? "Deleting…" : "Delete forever"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={deletingId === poem.id}
                    className="rounded-md border border-black/10 px-2 py-1 font-medium hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(poem.id)}
                  aria-label={`Delete "${poem.title || "Untitled"}"`}
                  className="shrink-0 rounded-md border border-black/10 px-2 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
