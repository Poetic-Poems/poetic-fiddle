"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listPoems, type SavedPoem } from "@/lib/poems-store";
import { useSession } from "@/lib/use-session";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; poems: SavedPoem[] }
  | { kind: "error"; message: string };

export function PoemsDashboard() {
  const session = useSession();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  // Tracks whose poems `state` reflects, so a later sign-in as a different
  // account resets to loading (state update during render, matching the
  // pattern Editor.tsx uses for its own per-user resets).
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null);

  if (session && session.user.id !== loadedForUserId) {
    setLoadedForUserId(session.user.id);
    setState({ kind: "loading" });
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

  if (!session) {
    return (
      <p className="px-6 text-sm text-foreground/70">
        Sign in to see your saved poems.
      </p>
    );
  }

  if (state.kind === "loading") {
    return (
      <p role="status" className="px-6 text-sm text-foreground/70">
        Loading your poems…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <p role="alert" className="px-6 text-sm text-red-700 dark:text-red-400">
        {state.message}
      </p>
    );
  }

  if (state.poems.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 px-6">
        <p className="text-sm text-foreground/70">
          You haven&rsquo;t saved a poem yet.
        </p>
        <Link
          href="/"
          className="text-sm text-primary underline underline-offset-2"
        >
          Start writing
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2 px-6">
      {state.poems.map((poem) => (
        <li key={poem.id}>
          <Link
            href={`/poems/${poem.id}`}
            className="flex items-center justify-between gap-4 rounded-lg border border-black/10 px-4 py-3 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
          >
            <span className="font-serif text-base font-medium">
              {poem.title || "Untitled"}
            </span>
            <span className="text-xs text-foreground/60">
              {new Date(poem.updatedAt).toLocaleDateString()}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
