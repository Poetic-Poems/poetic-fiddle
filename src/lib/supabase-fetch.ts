/** How long a single Supabase request may run before it is aborted. */
export const SUPABASE_TIMEOUT_MS = 12_000;

/**
 * Wraps `fetch` so a stalled Supabase request is aborted after `timeoutMs`
 * instead of hanging until the hosting platform's own function timeout fires.
 *
 * postgrest-js turns a rejected fetch into a resolved `{ data: null, error }`
 * (it only rejects when `.throwOnError()` is used, which nothing here does),
 * so the existing `if (error || !data) throw new XError(error)` checks in
 * poems-store.ts already surface an abort as the usual typed error.
 *
 * The bound is per attempt, not per call. postgrest-js never retries a
 * non-idempotent write (insert/update/delete) on a fetch error — see
 * RETRYABLE_METHODS in @supabase/postgrest-js — so every write in
 * poems-store.ts does fail within a single `timeoutMs` window. An idempotent
 * read is retried up to DEFAULT_MAX_RETRIES times with exponential backoff,
 * because `AbortSignal.timeout` rejects with a `TimeoutError` and postgrest-js
 * skips its retry loop only for an `AbortError`; a hung read is therefore
 * still bounded, but over several attempts rather than one.
 */
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
