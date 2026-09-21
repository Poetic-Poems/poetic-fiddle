import { createTimeoutFetch } from "@/lib/supabase-fetch";

/** How long the health probe waits before treating the backend as down. */
export const BACKEND_HEALTH_TIMEOUT_MS = 3_000;

export type BackendStatus = "checking" | "available" | "unavailable";

/**
 * Shown wherever a poet is told sign-in/saving is unavailable (Editor.tsx's
 * banner, PoemsDashboard.tsx, error.tsx's production missing-env branch) —
 * one string kept in sync in one place rather than restated per caller.
 */
export const BACKEND_UNAVAILABLE_MESSAGE =
  "Sign-in and saving aren't available right now. Your poem stays right here in this browser.";

const healthFetch = createTimeoutFetch(BACKEND_HEALTH_TIMEOUT_MS);

/**
 * Probes whether the configured Supabase project is reachable right now, via
 * a single call to its own health endpoint (issue #422: the dead host this
 * exists to detect fails in ~15ms, but a bounded timeout also covers a
 * project that merely hangs). Never throws — an unset env var, a network
 * failure and a non-2xx response all resolve "unavailable", the same as a
 * genuinely down project, since none of them means "poet can sign in".
 *
 * Isomorphic and side-effect-free (no module-scope caching): callers that
 * want the result memoised for a page's lifetime go through
 * use-backend-health.ts's client hook instead. The share/remix pages call
 * this directly, once per request, since Next's own data cache already
 * bounds how often the surrounding read runs.
 */
export async function probeBackendHealth(): Promise<
  "available" | "unavailable"
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return "unavailable";

  try {
    const response = await healthFetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseAnonKey },
    });
    return response.ok ? "available" : "unavailable";
  } catch {
    return "unavailable";
  }
}
