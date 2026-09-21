import { unstable_cache } from "next/cache";
import { getSharedPoem, type SharedPoem } from "@/lib/get-shared-poem";
import { getSupabaseServer } from "@/lib/supabase-server";
import { probeBackendHealth } from "@/lib/backend-health";
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

/** The share/remix pages' own view of a read: found, a genuine miss, or the
 * backend being unreachable — issue #422's distinction, so a share link
 * doesn't look permanently dead just because the project is down right now. */
export type SharedPoemResult =
  | { kind: "found"; poem: SharedPoem }
  | { kind: "not-found" }
  | { kind: "unavailable" };

/**
 * The share page's read path, cached: an unchanged permalink is served from
 * cache rather than hitting the database on every request (AC82), and the
 * cache is invalidated on the owner's next save via `revalidateSharedPoem`
 * (AC19) rather than by a time-based expiry alone. `revalidate` is a
 * fallback safety net, not the primary invalidation mechanism.
 *
 * Checks backend reachability *before* attempting the RPC (issue #422's
 * pitfall note: postgrest-js retries an idempotent read on a timeout, so
 * letting the RPC itself fail is not a safe substitute for gating ahead of
 * it) — a `{ kind: "unavailable" }` result skips the RPC, and is never
 * cached, so the very next request notices a recovered backend. A `{ kind:
 * "not-found" }` result covers everything else that resolves to "no poem to
 * show" — a genuine miss, a draft (AC87), or an unexpected read/cache
 * failure — since none of those distinguish themselves from "no such poem"
 * to an unauthenticated viewer with no session to retry with (AC17, AC87).
 */
export async function getCachedSharedPoem(
  shareId: string,
): Promise<SharedPoemResult> {
  const backendStatus = await probeBackendHealth();
  if (backendStatus === "unavailable") return { kind: "unavailable" };

  try {
    const poem = await unstable_cache(
      () => getSharedPoem(shareId, getSupabaseServer()),
      ["shared-poem", shareId],
      { tags: [sharedPoemCacheTag(shareId)], revalidate: 300 },
    )();
    return poem ? { kind: "found", poem } : { kind: "not-found" };
  } catch (error) {
    // Record the failure before degrading — this catch is what turned issue
    // #52's 500 into a silent 404, so its trigger must not stay invisible.
    reportSwallowedError(error, "share page: cached read failed", {
      share_id: shareId,
    });
    return { kind: "not-found" };
  }
}
