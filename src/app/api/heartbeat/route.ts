import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { reportSwallowedError } from "@/lib/observability";

// Never cache or statically render this route: it exists to produce a fresh
// database write on every invocation (docs/IMPLEMENTATION-PLAN.md §6.5).
export const dynamic = "force-dynamic";

/**
 * Vercel's daily keep-alive cron (§6.5, W16), insurance against the Supabase
 * free tier's 7-day-inactivity pause. `vercel.json` schedules the request;
 * Vercel authenticates it by replaying `CRON_SECRET` as a bearer token, which
 * this route must reject anything not carrying — otherwise the endpoint
 * would let an outsider trigger an arbitrary, if trivial, database write.
 *
 * The write itself goes through `bump_heartbeat()`
 * (supabase/migrations/20260926225141_heartbeat.sql), a security-definer RPC
 * that is the only path to the single-row `heartbeat` table — RLS on that
 * table has no policies at all, so nothing else, anon key included, can
 * reach it directly. The anon-keyed `getSupabaseServer()` client is enough:
 * no signed-in session, and no service-role key, is needed for a call this
 * narrow.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !hasValidSecret(request, secret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await getSupabaseServer().rpc("bump_heartbeat");
  if (error) {
    reportSwallowedError(error, "keep-alive heartbeat failed");
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Constant-time comparison against the configured secret, so a mistimed
 * response can't leak how many leading bytes of a guessed token were right.
 * `timingSafeEqual` throws on a length mismatch rather than returning false,
 * so the lengths are checked first — itself safe to do in variable time,
 * since a token's length is not the secret.
 */
function hasValidSecret(request: NextRequest, secret: string): boolean {
  const provided = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!provided) return false;

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
