/**
 * Bounds every Supabase request to `timeoutMs`, so a stalled request fails
 * with a `TimeoutError` instead of hanging indefinitely (only bounded, in
 * practice, by the hosting platform's own function timeout). postgrest-js
 * never retries a non-idempotent write (insert/update) on a fetch error —
 * see RETRYABLE_METHODS in @supabase/postgrest-js — so this alone is enough
 * to keep every write in poems-store.ts within a bounded window; postgrest-js
 * also turns a rejected fetch into a resolved `{ data: null, error }` (unless
 * `.throwOnError()` is used, which nothing here does), so the existing
 * `if (error || !data) throw new XError(error)` checks already surface it as
 * the usual typed error.
 */
export const SUPABASE_TIMEOUT_MS = 12_000;

export function createTimeoutFetch(
  timeoutMs: number = SUPABASE_TIMEOUT_MS,
): typeof fetch {
  return (input, init) => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;
    return fetch(input, { ...init, signal });
  };
}
