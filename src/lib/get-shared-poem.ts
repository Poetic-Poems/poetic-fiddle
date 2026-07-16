import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deliberately its own module, not part of poems-store.ts: poems-store.ts
 * imports the browser Supabase client (supabase-client.ts) at the top of the
 * file, which throws if its env vars aren't set — fine when the only
 * importers are client components, but the SSR share page (M6) reaches this
 * function from the server, and Next still imports a route's whole module
 * graph while collecting page config even for a dynamic route. A module-level
 * throw reached transitively that way fails the build itself, before any
 * request happens (Vercel supplies these env vars at deploy time, not during
 * `npm run build` in CI — see .env.example). Keeping this function in a module
 * with no import of the browser client sidesteps that entirely.
 */

/** A shared poem's public-facing content, as the share page needs it. */
export interface SharedPoem {
  title: string;
  source: string;
  allowRemix: boolean;
  updatedAt: string;
}

/**
 * Reads a poem through its opaque share id, via the `get_shared_poem`
 * security-definer RPC — the only read path a viewer who isn't the poem's
 * owner has (docs/IMPLEMENTATION-PLAN.md §6.2). Returns `null` for an id
 * that doesn't exist, or that names a `draft` (AC87): the two are
 * indistinguishable here by design, so a share page can 404 either way
 * without confirming which poem ids exist.
 */
export async function getSharedPoem(
  shareId: string,
  client: SupabaseClient,
): Promise<SharedPoem | null> {
  const { data, error } = await client
    .rpc("get_shared_poem", { p_share_id: shareId })
    .maybeSingle<{
      title: string;
      source_text: string;
      allow_remix: boolean;
      updated_at: string;
    }>();

  if (error || !data) return null;

  return {
    title: data.title,
    source: data.source_text,
    allowRemix: data.allow_remix,
    updatedAt: data.updated_at,
  };
}
