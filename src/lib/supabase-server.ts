import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — see .env.example.",
  );
}

/**
 * A server-side client for SSR routes that read through an anon-safe RPC
 * (currently just the share page's `get_shared_poem` — see poems-store.ts)
 * and need no signed-in session of their own. Auth persistence is off: there
 * is no browser `localStorage` on the server to persist to, and this client
 * never signs a user in or out.
 */
export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
