"use client";

import type { Session } from "@supabase/supabase-js";
import { useSession } from "@/lib/use-session";
import { useSignInMigration } from "@/lib/use-sign-in-migration";
import { usePoemCrud } from "@/lib/use-poem-crud";

export { tryRenderPoem } from "@/lib/try-render-poem";

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

export interface UsePoemPersistenceResult {
  session: Session | null;
  source: string;
  rendered: { html: string; error: string | null };
  handleChange: (value: string) => void;
  open: {
    opening: boolean;
    openError: string | null;
  };
  save: {
    saving: boolean;
    saveError: string | null;
    saveStatus: string;
    handleSave: () => Promise<void>;
  };
  share: {
    sharing: boolean;
    shareError: string | null;
    shareId: string | null;
    shareUrl: string | null;
    handleShare: () => Promise<void>;
    unsharing: boolean;
    handleUnshare: () => Promise<void>;
    linkCopied: boolean;
    handleCopyShareLink: () => void;
  };
  remix: {
    allowRemix: boolean | null;
    allowRemixSaving: boolean;
    allowRemixError: string | null;
    handleAllowRemixChange: (value: boolean | null) => Promise<void>;
  };
  signInPromptAction: "save" | "share" | null;
  dismissSignInPrompt: () => void;
}

/**
 * Orchestrates a poem's whole persistence lifecycle: which anonymous draft or
 * saved poem the editor opens with, session-driven draft migration, debounced
 * preview rendering, and the four Supabase-backed save/share/unshare/
 * allow-remix flows. `Editor.tsx` owns presentation only; every state
 * transition that isn't purely about how the editor looks lives here.
 *
 * Composes two hooks along the seam the two concerns actually split on: the
 * sign-in migration decision (`useSignInMigration`) and the draft/save/
 * share/remix CRUD flows (`usePoemCrud`) — the former only ever calls back
 * into the latter, so callers of this hook see one unchanged public shape.
 */
export function usePoemPersistence({
  initialPoemId,
  initialSource,
}: UsePoemPersistenceOptions): UsePoemPersistenceResult {
  const { session } = useSession();

  const { migrateFromDraft, forgetSavedPoem, ...crud } = usePoemCrud({
    session,
    initialPoemId,
    initialSource,
  });

  useSignInMigration({
    session,
    skipMigration: Boolean(initialPoemId) || initialSource !== undefined,
    onSignIn: migrateFromDraft,
    onSignOut: forgetSavedPoem,
  });

  return {
    session,
    ...crud,
  };
}
