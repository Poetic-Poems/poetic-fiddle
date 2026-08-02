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
 * @throws {AccountDeleteError} if there's no active session, or the route
 * reports the deletion failed.
 */
export async function deleteAccount(): Promise<void> {
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
}
