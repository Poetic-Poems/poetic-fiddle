import { unstable_cache } from "next/cache";
import { getSharedPoem, type SharedPoem } from "@/lib/get-shared-poem";
import { getSupabaseServer } from "@/lib/supabase-server";

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
 */
export function getCachedSharedPoem(
  shareId: string,
): Promise<SharedPoem | null> {
  return unstable_cache(
    () => getSharedPoem(shareId, getSupabaseServer()),
    ["shared-poem", shareId],
    { tags: [sharedPoemCacheTag(shareId)], revalidate: 300 },
  )();
}
