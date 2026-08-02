import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { reportSwallowedError } from "@/lib/observability";

/**
 * Self-service account deletion (AC92, W13). The only route in this codebase
 * that uses the service-role key (`getSupabaseAdmin()`), so it's the only
 * place that can bypass RLS — everything below exists to make sure that
 * power is only ever pointed at the caller's own account.
 *
 * The caller proves who they are with their own Supabase access token, sent
 * as a bearer token rather than trusted from a request body: `auth.getUser()`
 * verifies the token's signature and expiry against Supabase Auth itself and
 * returns the user it actually belongs to, so there is no path from a
 * client-supplied id to someone else's account.
 *
 * `auth.admin.deleteUser()` removes the `auth.users` row outright (no soft
 * delete), which cascades through `profiles` and `poems` via the `on delete
 * cascade` foreign keys already in the schema (docs/IMPLEMENTATION-PLAN.md
 * §6.2) — the database does the propagation, not application code. Deleting
 * the row also revokes every refresh token tied to it, so the caller's
 * session is invalid the moment this returns even before the browser calls
 * `signOut()`.
 *
 * What the database cascade cannot reach is the share pages' cached renders:
 * `getCachedSharedPoem` holds each one for up to its 300s fallback expiry, so
 * a poem whose row is gone would keep serving from cache instead of 404ing
 * (AC92 asks for "immediately"). The share ids are therefore read *before*
 * the delete — afterwards there is no row left to read them from — and
 * returned to the caller, which invalidates each one's cache tag through the
 * same `revalidateSharedPoem` Server Action that per-poem deletion already
 * uses (`PoemsDashboard.tsx`). Collecting them is best-effort: a failure here
 * leaves stale share pages until their natural expiry, which must not turn an
 * otherwise-fine account deletion into an error.
 */
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: userData, error: userError } =
    await admin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const shareIds = await sharedPoemIds(admin, userData.user.id);

  const { error: deleteError } = await admin.auth.admin.deleteUser(
    userData.user.id,
  );
  if (deleteError) {
    reportSwallowedError(deleteError, "account deletion failed", {
      user_id: userData.user.id,
    });
    return NextResponse.json(
      { error: "Couldn't delete your account — please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, shareIds });
}

/**
 * Every share id belonging to one account. Scoped to `owner_id` explicitly:
 * this client bypasses RLS, so the filter that keeps one poet's query off
 * another poet's rows is the one written here. Resolves to an empty list on
 * failure rather than throwing — see the note on `DELETE` above.
 */
async function sharedPoemIds(
  admin: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("poems")
    .select("share_id")
    .eq("owner_id", userId)
    .not("share_id", "is", null);

  if (error) {
    reportSwallowedError(
      error,
      "account deletion: couldn't list share ids to invalidate",
      { user_id: userId },
    );
    return [];
  }

  return (data ?? [])
    .map((row) => row.share_id)
    .filter((shareId): shareId is string => typeof shareId === "string");
}
