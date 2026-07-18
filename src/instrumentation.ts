import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation hook. `register()` runs once per server/edge
 * runtime at startup and loads the matching Sentry init config; the runtime
 * split keeps the Node and Edge SDKs out of each other's bundles. See
 * docs/OBSERVABILITY-PLAN.md.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * The catch-all that records any *un*-handled server error with its route
 * context — the single hook that, on its own, would have captured issue #52's
 * true trigger. The explicit `captureException` calls in the read/render
 * paths cover the failures the app deliberately swallows before they ever
 * reach here.
 */
export const onRequestError = Sentry.captureRequestError;
