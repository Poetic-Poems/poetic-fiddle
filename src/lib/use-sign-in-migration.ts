"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";

export interface UseSignInMigrationOptions {
  session: Session | null;
  /**
   * Opening a specific poem or a remix skips the draft migration and the
   * sign-in forget below: this render also fires the first time a
   * *returning* signed-in poet's session resolves after a reload, which is
   * exactly the case that must NOT forget the poem being (re)loaded. A remix
   * skips it for the mirror-image reason — the poem to keep is the one the
   * URL names, and `usePoemPersistence`'s own effect has already made the
   * remix the stored draft, so nothing is stranded either way.
   */
  skipMigration: boolean;
  /** Adopts a leftover anonymous draft as this session's poem (AC9). */
  onSignIn: () => void;
  /** A saved poem belongs to the account that saved it, so this forgets it. */
  onSignOut: () => void;
}

/**
 * AC9: on first sign-in, the anonymous localStorage draft (if any) becomes
 * this session's poem instead of being silently left behind. Adjusted during
 * render (React's "resetting state when a prop changes" pattern) rather than
 * in an effect, guarded per-user so a later token refresh (a new session
 * object for the same user) doesn't re-run it.
 *
 * Signing out does the mirror-image forget, so the editor doesn't hold a row
 * identity no session can write to.
 */
export function useSignInMigration({
  session,
  skipMigration,
  onSignIn,
  onSignOut,
}: UseSignInMigrationOptions): void {
  const [migratedUserId, setMigratedUserId] = useState<string | null>(null);

  if (session && session.user.id !== migratedUserId) {
    setMigratedUserId(session.user.id);
    if (!skipMigration) onSignIn();
  }

  if (!session && migratedUserId !== null) {
    setMigratedUserId(null);
    onSignOut();
  }
}
