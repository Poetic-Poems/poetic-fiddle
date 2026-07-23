"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getRemixDefault,
  listPoems,
  updateRemixDefault,
  type SavedPoem,
} from "@/lib/poems-store";
import { useSession } from "@/lib/use-session";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; poems: SavedPoem[] }
  | { kind: "error"; message: string };

type RemixDefaultState =
  | { kind: "loading" }
  | { kind: "loaded"; value: boolean }
  | { kind: "error"; message: string };

export function PoemsDashboard() {
  const session = useSession();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [remixDefaultState, setRemixDefaultState] = useState<RemixDefaultState>(
    { kind: "loading" },
  );
  const [remixDefaultSaving, setRemixDefaultSaving] = useState(false);
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
            message: err instanceof Error ? err.message : String(err),
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
            message: err instanceof Error ? err.message : String(err),
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
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRemixDefaultSaving(false);
    }
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
            <li key={poem.id}>
              <Link
                href={`/poems/${poem.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-black/10 px-4 py-3 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
