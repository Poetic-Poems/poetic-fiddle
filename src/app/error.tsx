"use client";

import { MISSING_SUPABASE_ENV_MESSAGE } from "@/lib/env-errors";
import { BACKEND_UNAVAILABLE_MESSAGE } from "@/lib/backend-health";

/**
 * The editor loads via `next/dynamic(..., { ssr: false })`, so
 * src/lib/supabase-client.ts's module-evaluation throw only happens in the
 * browser — without this boundary it surfaces solely in the console, and
 * `npm run dev` looks like it's working (HTTP 200, blank editor pane).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (error.message === MISSING_SUPABASE_ENV_MESSAGE) {
    // A production visitor never gets to fix this themselves — the
    // ".env.local" instructions below are for whoever is developing the app.
    // Clearing the Vercel env vars (issue #422) must degrade to the same
    // "unavailable right now" wording every other surface uses, not to
    // setup instructions aimed at a developer.
    if (process.env.NODE_ENV === "production") {
      return (
        <main className="flex flex-1 flex-col items-start gap-3 px-6 py-6">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            Sign-in and saving aren&rsquo;t available right now
          </h1>
          <p role="status" className="text-sm text-foreground/70">
            {BACKEND_UNAVAILABLE_MESSAGE}
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
          >
            Try again
          </button>
        </main>
      );
    }

    return (
      <main className="flex flex-1 flex-col items-start gap-3 px-6 py-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          Supabase isn&rsquo;t configured
        </h1>
        <p className="text-sm text-foreground/70">
          Copy <code>.env.example</code> to <code>.env.local</code> and fill in
          your Supabase project URL and anon key, then restart the dev server.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-start gap-3 px-6 py-6">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-sm text-foreground/70">
        Please reload the page. If the problem continues, try again later.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
      >
        Try again
      </button>
    </main>
  );
}
