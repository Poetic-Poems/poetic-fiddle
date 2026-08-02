import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
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

  return NextResponse.json({ ok: true });
}
