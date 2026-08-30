import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseForToken } from "@/lib/supabase-server";
import { reportSwallowedError } from "@/lib/observability";
import {
  buildExportArchive,
  type ExportPayload,
  type ExportedPoem,
} from "@/lib/export-archive";

// PostgREST projects can cap rows per request ("Max rows" in the Supabase
// dashboard); paging unconditionally in a loop until a short page comes back
// makes this export complete regardless of that setting, present or not.
const POEMS_PAGE_SIZE = 1000;

async function fetchAllPoems(client: SupabaseClient) {
  const poems: ExportedPoem[] = [];
  for (let page = 0; ; page++) {
    const start = page * POEMS_PAGE_SIZE;
    const end = start + POEMS_PAGE_SIZE - 1;
    const { data, error } = await client
      .from("poems")
      .select(
        "id, title, source_text, status, share_id, allow_remix, created_at, updated_at",
      )
      .order("created_at", { ascending: true })
      .range(start, end);
    if (error) {
      return { data: null, error };
    }
    poems.push(...((data as ExportedPoem[] | null) ?? []));
    if (!data || data.length < POEMS_PAGE_SIZE) break;
  }
  return { data: poems, error: null };
}

/**
 * Self-service data export (AC92, W14), completing the pair `DELETE
 * /api/account/delete` (W13) started. Authentication mirrors that route
 * exactly — the caller proves who they are with their own Supabase access
 * token, sent as a bearer token and verified against Supabase Auth itself —
 * but the query side deliberately does not: this route never touches
 * `getSupabaseAdmin()`'s service-role key. Instead it builds a client that
 * carries the caller's own token (`getSupabaseForToken`), so row-level
 * security — not a hand-written `.eq("owner_id", …)` filter — is what
 * confines every read to the caller's own `poems` and `profiles` rows. That
 * keeps the service-role key's deployed surface exactly where
 * `docs/IMPLEMENTATION-PLAN.md` §6.2 point 4 says it is: one route, W13's.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const client = getSupabaseForToken(accessToken);

  const { data: userData, error: userError } =
    await client.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const [profileResult, poemsResult] = await Promise.all([
    client
      .from("profiles")
      .select("remix_default, created_at, updated_at")
      .eq("id", userData.user.id)
      .maybeSingle(),
    fetchAllPoems(client),
  ]);

  if (profileResult.error || poemsResult.error) {
    reportSwallowedError(
      profileResult.error ?? poemsResult.error,
      "data export failed",
      { user_id: userData.user.id },
    );
    return NextResponse.json(
      { error: "Couldn't export your data — please try again." },
      { status: 500 },
    );
  }

  const payload: ExportPayload = {
    exported_at: new Date().toISOString(),
    account: {
      id: userData.user.id,
      email: userData.user.email ?? null,
      created_at: userData.user.created_at,
    },
    profile: profileResult.data ?? null,
    poems: poemsResult.data ?? [],
  };

  const archive = buildExportArchive(payload);
  const stamp = payload.exported_at.replace(/[:.]/g, "-");

  return new NextResponse(new Uint8Array(archive), {
    status: 200,
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="poetic-fiddle-export-${stamp}.tar.gz"`,
      "Content-Length": String(archive.byteLength),
    },
  });
}
