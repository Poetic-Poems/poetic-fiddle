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

/**
 * A share couldn't be revoked. `message` is safe to show a poet as-is; the
 * underlying Supabase/network error is kept as `cause`.
 */
export class PoemUnshareError extends Error {
  constructor(cause: unknown) {
    super(
      "Couldn't remove the share link — your poem is still saved. Please try again.",
    );
    this.name = "PoemUnshareError";
    this.cause = cause;
  }
}

/**
 * A poet's global remix default (`profiles.remix_default`) couldn't be read.
 * `message` is safe to show a poet as-is; the underlying Supabase/network
 * error is kept as `cause`.
 */
export class RemixDefaultLoadError extends Error {
  constructor(cause: unknown) {
    super("Couldn't load your remix setting — please try again.");
    this.name = "RemixDefaultLoadError";
    this.cause = cause;
  }
}

/**
 * A poet's global remix default couldn't be saved. `message` is safe to show
 * a poet as-is; the underlying Supabase/network error is kept as `cause`.
 */
export class RemixDefaultSaveError extends Error {
  constructor(cause: unknown) {
    super("Couldn't save your remix setting — please try again.");
    this.name = "RemixDefaultSaveError";
    this.cause = cause;
  }
}

/**
 * A poem's per-poem remix override (`poems.allow_remix`) couldn't be saved.
 * `message` is safe to show a poet as-is; the underlying Supabase/network
 * error is kept as `cause`.
 */
export class PoemRemixOverrideError extends Error {
  constructor(cause: unknown) {
    super("Couldn't update remixing for this poem — please try again.");
    this.name = "PoemRemixOverrideError";
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
  /** Null means "inherit the poet's remix_default" (AC114). */
  allowRemix: boolean | null;
}

/**
 * Loads a saved poem's source for the editor, so opening it from the
 * dashboard (or reloading its URL) restores the poem with its id preserved
 * (AC15) instead of the reload losing which row is being edited. Also
 * carries `shareId`, so the editor can show an already-minted share link
 * instead of hiding it until Share is clicked again, and `allowRemix`, so it
 * can show the poem's current remix override (AC114).
 *
 * @throws {PoemLoadError} if the poem doesn't exist or isn't the caller's.
 */
export async function loadPoem(id: string): Promise<LoadedPoem> {
  const { data, error } = await supabase
    .from("poems")
    .select("id, source_text, share_id, allow_remix")
    .eq("id", id)
    .single<{
      id: string;
      source_text: string;
      share_id: string | null;
      allow_remix: boolean | null;
    }>();

  if (error || !data) throw new PoemLoadError(error);

  return {
    id: data.id,
    source: data.source_text,
    shareId: data.share_id,
    allowRemix: data.allow_remix,
  };
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

/**
 * Unshares a saved poem: moves it back to `draft`, so `get_shared_poem`
 * stops serving its permalink (it only selects `unlisted`/`published` rows).
 * The poem's `share_id` is left on the row rather than cleared — it's
 * permanent and never repointed (docs/IMPLEMENTATION-PLAN.md §6.2), so
 * re-sharing the same poem later reveals the same link rather than minting
 * a new one.
 *
 * @throws {PoemUnshareError} if the update doesn't come back with a row.
 */
export async function unsharePoem(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("poems")
    .update({ status: "draft" })
    .eq("id", id)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new PoemUnshareError(error);
}

/**
 * Reads a poet's global remix default (`profiles.remix_default`), off by
 * default, for the dashboard's remix-settings control (AC114). RLS scopes
 * the read to the caller's own profile row.
 *
 * @throws {RemixDefaultLoadError} if the profile row can't be read.
 */
export async function getRemixDefault(ownerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("remix_default")
    .eq("id", ownerId)
    .single<{ remix_default: boolean }>();

  if (error || !data) throw new RemixDefaultLoadError(error);

  return data.remix_default;
}

/**
 * Sets a poet's global remix default (AC114). RLS scopes the update to the
 * caller's own profile row.
 *
 * @throws {RemixDefaultSaveError} if the update doesn't come back with a row.
 */
export async function updateRemixDefault(
  ownerId: string,
  remixDefault: boolean,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ remix_default: remixDefault })
    .eq("id", ownerId)
    .select("remix_default")
    .single<{ remix_default: boolean }>();

  if (error || !data) throw new RemixDefaultSaveError(error);

  return data.remix_default;
}

/**
 * Sets a poem's per-poem remix override (AC114): `true`/`false` overrides
 * the poet's global default, `null` clears the override back to "inherit
 * remix_default". RLS scopes the update to the caller's own poem.
 *
 * @throws {PoemRemixOverrideError} if the update doesn't come back with a row.
 */
export async function updateAllowRemix(
  id: string,
  allowRemix: boolean | null,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("poems")
    .update({ allow_remix: allowRemix })
    .eq("id", id)
    .select("allow_remix")
    .single<{ allow_remix: boolean | null }>();

  if (error || !data) throw new PoemRemixOverrideError(error);

  return data.allow_remix;
}
