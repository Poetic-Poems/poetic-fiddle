"use server";

import { updateTag } from "next/cache";
import { sharedPoemCacheTag } from "@/lib/shared-poem-cache";

/**
 * Invalidates a share page's cached render. Called from the editor
 * (a client component) right after a save that touches an already-shared
 * poem, so the permalink reflects the current source rather than a stale
 * cached render until the next natural expiry (AC19, AC82). `updateTag`
 * (not `revalidateTag`) because this always runs inside a Server Action and
 * wants the invalidation to apply immediately, with no profile/deprecation
 * warning to reason about.
 */
export async function revalidateSharedPoem(shareId: string): Promise<void> {
  updateTag(sharedPoemCacheTag(shareId));
}
