"use server";

import { updateTag } from "next/cache";
import { sharedPoemCacheTag } from "@/lib/shared-poem-cache";
import { reportSwallowedError } from "@/lib/observability";

/**
 * Invalidates a share page's cached render. Called right after a save that
 * touches an already-shared poem, so the permalink reflects the current
 * source rather than a stale cached render until the next natural expiry
 * (AC19, AC82). `updateTag` (not `revalidateTag`) because this always runs
 * inside a Server Action and wants the invalidation to apply immediately,
 * with no profile/deprecation warning to reason about.
 *
 * Every call site treats this as best-effort and swallows any rejection — a
 * failure here leaves a stale cached render for up to the 300s fallback expiry
 * rather than turning a successful save into an error (AC94, AC95). That
 * decision must not make the failure itself invisible, so it's captured here
 * rather than in the client: this function always runs server-side (Server
 * Actions execute on the server even when invoked from a client component),
 * where `reportSwallowedError`'s Sentry capture is actually wired up. Every
 * call site is a client component with no client-side Sentry collection
 * (docs/OBSERVABILITY-PLAN.md O2, D42) — reporting from there would silently
 * do nothing.
 */
export async function revalidateSharedPoem(shareId: string): Promise<void> {
  try {
    updateTag(sharedPoemCacheTag(shareId));
  } catch (error) {
    reportSwallowedError(
      error,
      "revalidate shared poem: cache tag invalidation failed",
      {
        share_id: shareId,
      },
    );
  }
}
