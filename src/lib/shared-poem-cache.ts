import { unstable_cache } from "next/cache";
import { getSharedPoem, type SharedPoem } from "@/lib/get-shared-poem";
import { getSupabaseServer } from "@/lib/supabase-server";
import { reportSwallowedError } from "@/lib/observability";

/**
 * The Next Data Cache tag for a single shared poem — shared between the
 * cached reader below and `revalidateSharedPoem` (src/lib/revalidate-share.ts),
 * so a re-save can invalidate exactly the page(s) it affects rather than the
 * whole cache (docs/IMPLEMENTATION-PLAN.md §6.2 point 6, AC19, AC82).
 */
export function sharedPoemCacheTag(shareId: string): string {
  return `shared-poem:${shareId}`;
}

/**
 * The share page's read path, cached: an unchanged permalink is served from
 * cache rather than hitting the database on every request (AC82), and the
 * cache is invalidated on the owner's next save via `revalidateSharedPoem`
 * (AC19) rather than by a time-based expiry alone. `revalidate` is a
 * fallback safety net, not the primary invalidation mechanism.
 *
 * Resolves to `null` — indistinguishable from "no such poem" — on any
 * unexpected failure (a missing env var, a transient Supabase outage, a
 * cache-layer error), not just a normal RPC miss. Both callers (the share
 * and remix pages) already treat `null` as "show the not-found state", so a
 * viewer who isn't signed in gets that same friendly page instead of an
 * unhandled 500 (AC17, AC87) — an unauthenticated GET has no session to
 * retry with, so surfacing the raw error here would only replace one bad
 * response with a different one.
 */
export async function getCachedSharedPoem(
  shareId: string,
): Promise<SharedPoem | null> {
  try {
    return await unstable_cache(
      () => getSharedPoem(shareId, getSupabaseServer()),
      ["shared-poem", shareId],
      { tags: [sharedPoemCacheTag(shareId)], revalidate: 300 },
    )();
  } catch (error) {
    // Record the failure before degrading — this catch is what turned issue
    // #52's 500 into a silent 404, so its trigger must not stay invisible.
    reportSwallowedError(error, "share page: cached read failed", {
      share_id: shareId,
    });
    return null;
  }
}
