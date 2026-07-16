import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";
import { derivePoemTitle } from "@/lib/poem-title";

/** A poem row as the editor and dashboard need it. */
export interface SavedPoem {
  id: string;
  title: string;
  updatedAt: string;
  /** Null until the poet has shared this poem (Share mints one — M6). */
  shareId: string | null;
}

/**
 * A save that didn't land. `message` is safe to show a poet as-is; the
 * underlying Supabase/network error is kept as `cause` for diagnosis, since it
 * can carry detail (row identifiers, policy names) that no reader needs.
 */
export class PoemSaveError extends Error {
  constructor(cause: unknown) {
    super(
      "Couldn't save your poem — your work is still here. Please try again.",
    );
    this.name = "PoemSaveError";
    this.cause = cause;
  }
}

/**
 * A poem couldn't be listed. `message` is safe to show a poet as-is; the
 * underlying Supabase/network error is kept as `cause` for diagnosis.
 */
export class PoemListError extends Error {
  constructor(cause: unknown) {
    super("Couldn't load your poems — please try again.");
    this.name = "PoemListError";
    this.cause = cause;
  }
}

/**
 * A specific poem couldn't be opened — it doesn't exist, or it belongs to
 * someone else. RLS makes the two indistinguishable from here (AC87), which
 * is the point: a poem that isn't the caller's reads back as absent, not as
 * a permission error that would confirm it exists.
 */
export class PoemLoadError extends Error {
  constructor(cause: unknown) {
    super(
      "That poem couldn't be found — it may have been deleted, or belongs to someone else.",
    );
    this.name = "PoemLoadError";
    this.cause = cause;
  }
}

/**
 * A share couldn't be created or confirmed. `message` is safe to show a poet
 * as-is; the underlying Supabase/network error is kept as `cause`.
 */
export class PoemShareError extends Error {
  constructor(cause: unknown) {
    super(
      "Couldn't create a share link — your poem is still saved. Please try again.",
    );
    this.name = "PoemShareError";
    this.cause = cause;
  }
}

const SAVED_POEM_COLUMNS = "id, title, updated_at, share_id";

interface PoemRow {
  id: string;
  title: string;
  updated_at: string;
  share_id: string | null;
}

/**
 * Saves the editor's source to the poet's account: a first save inserts, and
 * every later one updates the same row (AC13).
 *
 * The client sends only `title` and `source_text` — `status` defaults to
 * `draft`, `share_id` is minted by the database when a poem first leaves
 * `draft`, and `updated_at` is stamped by a trigger, so none of them are ours
 * to set (docs/IMPLEMENTATION-PLAN.md §6.2). Ownership is likewise enforced by
 * RLS rather than by this filter: `owner_id` on insert must match
 * `auth.uid()`, and the update reaches no row that isn't the caller's.
 *
 * @throws {PoemSaveError} if the row doesn't come back saved (AC94, AC95).
 */
export async function savePoem({
  id,
  ownerId,
  source,
}: {
  id: string | null;
  ownerId: string;
  source: string;
}): Promise<SavedPoem> {
  const title = derivePoemTitle(source);

  const write =
    id === null
      ? supabase
          .from("poems")
          .insert({ owner_id: ownerId, title, source_text: source })
      : supabase
          .from("poems")
          .update({ title, source_text: source })
          .eq("id", id);

  const { data, error } = await write
    .select(SAVED_POEM_COLUMNS)
    .single<PoemRow>();

  // `single()` errors when an update matches no row, so a poem deleted (or
  // never owned) by this account surfaces as a failure rather than a silent
  // no-op the poet would read as a successful save.
  if (error || !data) throw new PoemSaveError(error);

  return {
    id: data.id,
    title: data.title,
    updatedAt: data.updated_at,
    shareId: data.share_id,
  };
}

/**
 * Lists the signed-in poet's saved poems, most recently updated first, for
 * the "My poems" dashboard (AC15, AC22) — every status, not just `draft`:
 * once a poem is shared (M6) it moves to `unlisted` but must stay reachable
 * here, or its owner would have no way back to it to keep editing (AC19).
 * RLS already scopes every row to its owner; the explicit `owner_id` filter
 * here matches the style of `savePoem` rather than relying on it alone.
 *
 * @throws {PoemListError} if the list can't be fetched.
 */
export async function listPoems(ownerId: string): Promise<SavedPoem[]> {
  const { data, error } = await supabase
    .from("poems")
    .select(SAVED_POEM_COLUMNS)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .returns<PoemRow[]>();

  if (error) throw new PoemListError(error);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    shareId: row.share_id,
  }));
}

/** A saved poem's full source, as the editor needs it to resume editing. */
export interface LoadedPoem {
  id: string;
  source: string;
  shareId: string | null;
}

/**
 * Loads a saved poem's source for the editor, so opening it from the
 * dashboard (or reloading its URL) restores the poem with its id preserved
 * (AC15) instead of the reload losing which row is being edited. Also
 * carries `shareId`, so the editor can show an already-minted share link
 * instead of hiding it until Share is clicked again.
 *
 * @throws {PoemLoadError} if the poem doesn't exist or isn't the caller's.
 */
export async function loadPoem(id: string): Promise<LoadedPoem> {
  const { data, error } = await supabase
    .from("poems")
    .select("id, source_text, share_id")
    .eq("id", id)
    .single<{ id: string; source_text: string; share_id: string | null }>();

  if (error || !data) throw new PoemLoadError(error);

  return { id: data.id, source: data.source_text, shareId: data.share_id };
}

/**
 * Shares a saved poem: moves it out of `draft` so the database trigger mints
 * (or, on a poem already shared, keeps) its opaque `share_id` (AC17, AC29,
 * AC90; docs/IMPLEMENTATION-PLAN.md §6.2). Idempotent — sharing an
 * already-`unlisted` poem again is a no-op update that returns the same id,
 * so re-clicking Share never silently invalidates or replaces the link.
 *
 * @throws {PoemShareError} if the row doesn't come back with a share id.
 */
export async function sharePoem(id: string): Promise<string> {
  const { data, error } = await supabase
    .from("poems")
    .update({ status: "unlisted" })
    .eq("id", id)
    .select("share_id")
    .single<{ share_id: string | null }>();

  if (error || !data?.share_id) throw new PoemShareError(error);

  return data.share_id;
}

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
 *
 * Takes an explicit client (defaulting to the browser singleton) so the SSR
 * share page (M6) can pass its own server-side client instead — the RPC is
 * anon-safe either way (docs/IMPLEMENTATION-PLAN.md §6.2 point 4).
 */
export async function getSharedPoem(
  shareId: string,
  client: SupabaseClient = supabase,
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
