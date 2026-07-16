import { supabase } from "@/lib/supabase-client";
import { derivePoemTitle } from "@/lib/poem-title";

/** A poem row as the editor and dashboard need it. */
export interface SavedPoem {
  id: string;
  title: string;
  updatedAt: string;
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

const SAVED_POEM_COLUMNS = "id, title, updated_at";

interface PoemRow {
  id: string;
  title: string;
  updated_at: string;
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

  return { id: data.id, title: data.title, updatedAt: data.updated_at };
}
