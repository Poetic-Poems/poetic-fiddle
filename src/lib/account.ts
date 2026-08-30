import { supabase } from "@/lib/supabase-client";

/**
 * A self-service account deletion couldn't be completed. `message` is safe
 * to show a poet as-is; the underlying cause (a missing session, or the
 * route's own error response) is kept as `cause` for diagnosis, matching the
 * typed-error convention in poems-store.ts.
 */
export class AccountDeleteError extends Error {
  constructor(cause: unknown) {
    super("Couldn't delete your account — please try again.");
    this.name = "AccountDeleteError";
    this.cause = cause;
  }
}

/**
 * Deletes the signed-in poet's account (AC92, W13): calls the server-side
 * `DELETE /api/account/delete` route with the current session's access
 * token, which the route verifies against Supabase Auth itself rather than
 * trusting a client-supplied id. Deletion cascades through `profiles` and
 * `poems` server-side (docs/IMPLEMENTATION-PLAN.md §6.2) — this function
 * only initiates it and does not itself touch those tables.
 *
 * Signing the browser out is deliberately left to the caller: this function
 * only confirms the account is gone, and a caller that wants to redirect on
 * success needs to sequence that after its own `signOut()` call, not before.
 *
 * Resolves to the share ids the deleted account had minted, which the caller
 * must pass to `revalidateSharedPoem` so those permalinks stop serving from
 * cache at once rather than at their next natural expiry — the route explains
 * why it, not this function, is the one that can still see them.
 *
 * @throws {AccountDeleteError} if there's no active session, or the route
 * reports the deletion failed.
 */
export async function deleteAccount(): Promise<string[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new AccountDeleteError(new Error("no active session"));
  }

  const response = await fetch("/api/account/delete", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new AccountDeleteError(body?.error ?? response.statusText);
  }

  // The account is already gone by this point, so a body that doesn't parse
  // or omits `shareIds` costs only the cache invalidation, never the
  // deletion — degrade to "nothing to invalidate" rather than throwing.
  const body = await response.json().catch(() => null);
  const shareIds: unknown = body?.shareIds;
  return Array.isArray(shareIds)
    ? shareIds.filter((id): id is string => typeof id === "string")
    : [];
}

/**
 * A self-service data export couldn't be completed. `message` is safe to
 * show a poet as-is; the underlying cause is kept as `cause` for diagnosis,
 * matching `AccountDeleteError` above.
 */
export class AccountExportError extends Error {
  constructor(cause: unknown) {
    super("Couldn't export your data — please try again.");
    this.name = "AccountExportError";
    this.cause = cause;
  }
}

const DEFAULT_EXPORT_FILENAME = "poetic-fiddle-export.tar.gz";

/** Pulled out of `Content-Disposition: attachment; filename="…"`. */
function exportFilename(contentDisposition: string | null): string {
  const match = contentDisposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? DEFAULT_EXPORT_FILENAME;
}

/**
 * Exports the signed-in poet's own data (AC92, W14): calls the server-side
 * `GET /api/account/export` route with the current session's access token,
 * the same way `deleteAccount` calls its own route. The route verifies the
 * token against Supabase Auth itself and reads only that poet's rows — this
 * function does no filtering of its own, and resolves to the archive as a
 * downloadable blob plus the filename the route chose for it.
 *
 * @throws {AccountExportError} if there's no active session, or the route
 * reports the export failed.
 */
export async function exportAccountData(): Promise<{
  blob: Blob;
  filename: string;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new AccountExportError(new Error("no active session"));
  }

  const response = await fetch("/api/account/export", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new AccountExportError(body?.error ?? response.statusText);
  }

  return {
    blob: await response.blob(),
    filename: exportFilename(response.headers.get("Content-Disposition")),
  };
}
