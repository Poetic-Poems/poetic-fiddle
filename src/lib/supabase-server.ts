import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | undefined;

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
  });
  return cached;
}
