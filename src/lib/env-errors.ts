/**
 * Thrown by src/lib/supabase-client.ts when the Supabase env vars are unset.
 * Kept in its own side-effect-free module so src/app/error.tsx can match on
 * it without importing supabase-client.ts — that module throws on the same
 * condition at evaluation time, which would crash the error boundary itself.
 */
export const MISSING_SUPABASE_ENV_MESSAGE =
  "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — see .env.example.";
