import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createTimeoutFetch } from "@/lib/supabase-fetch";

let cached: SupabaseClient | undefined;
let cachedAdmin: SupabaseClient | undefined;

/**
 * A server-side client for SSR routes that read through an anon-safe RPC
 * (currently just the share page's `get_shared_poem` — see poems-store.ts)
 * and need no signed-in session of their own. Auth persistence is off: there
 * is no browser `localStorage` on the server to persist to, and this client
 * never signs a user in or out.
 *
 * Built lazily, on first call, rather than as a module-level constant: these
 * env vars are supplied at deploy time (Vercel), not during CI's plain
 * `npm run build` (see .env.example), and Next still imports this module
 * while collecting page config for the dynamic `/share/[share_id]` route —
 * a top-level throw on missing env vars would fail that build step even
 * though nothing has actually tried to read from Supabase yet.
 */
export function getSupabaseServer(): SupabaseClient {
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — see .env.example.",
    );
  }

  cached = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createTimeoutFetch() },
  });
  return cached;
}

/**
 * A privileged server-side client for the one operation that genuinely needs
 * it (docs/IMPLEMENTATION-PLAN.md §6.2 point 4): account deletion, via
 * `auth.admin.deleteUser()`, which only the service-role key can call. The
 * service-role key bypasses RLS entirely, so nothing else in this codebase
 * should use this client — every other server/browser path goes through
 * `getSupabaseServer()` or `supabase-client.ts`'s anon-keyed client instead.
 *
 * Built lazily, on first call, for the same reason as `getSupabaseServer()`:
 * `SUPABASE_SERVICE_ROLE_KEY` is supplied at deploy time (Vercel), not during
 * CI's plain `npm run build`, and a top-level throw on a missing env var
 * would fail that build step even though nothing has tried to use it yet.
 */
/**
 * A request-scoped, RLS-enforcing client for a route acting on behalf of a
 * signed-in poet using their own access token — never the service-role key.
 * Passing the token straight to `auth.getUser(accessToken)` verifies its
 * signature and expiry against Supabase Auth itself, and attaching it as
 * this client's own `Authorization` header means every subsequent query
 * runs as `authenticated` with that token, so RLS — not application code —
 * is what confines each read to the caller's own rows (`poems_select_own`,
 * `profiles_select_own`, `supabase/migrations/20260716104021_poems_and_profiles.sql`).
 *
 * Built fresh per call, unlike the two clients above: the token varies per
 * request, so nothing here is safe to cache across calls.
 */
export function getSupabaseForToken(accessToken: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — see .env.example.",
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      fetch: createTimeoutFetch(),
    },
  });
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — see .env.example.",
    );
  }

  cachedAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createTimeoutFetch() },
  });
  return cachedAdmin;
}
