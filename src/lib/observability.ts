import * as Sentry from "@sentry/nextjs";

/**
 * Sentry glue for the server-side observability layer
 * (docs/OBSERVABILITY-PLAN.md). This module is imported by the runtime config
 * files (`sentry.server.config.ts`, `sentry.edge.config.ts`) and by the
 * server code paths that deliberately swallow failures to stay graceful for a
 * viewer (AC93/AC94) — turning those silent degradations into durable,
 * queryable records without changing the graceful behaviour itself.
 *
 * It imports no browser Supabase client and touches no client bundle: the
 * share page stays JS-free (AC84), and everything here runs server/edge-side
 * only. When `SENTRY_DSN` is unset — local dev, CI, `npm run build` — the SDK
 * initialises disabled and every call below is a no-op, so the app builds and
 * runs green with no Sentry account (the same "works without the env var"
 * contract get-shared-poem.ts documents for the Supabase vars).
 */

/** A message longer than this is truncated before it can leave the app. */
const MAX_STRING_LENGTH = 1024;

type ScrubbableEvent = Parameters<
  NonNullable<Sentry.NodeOptions["beforeSend"]>
>[0];

/** Cap a user-influenced string so a whole poem can't ride out in a payload. */
function truncate(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}… (truncated)`
    : value;
}

/**
 * `beforeSend` scrub — data minimisation in code, not just policy prose
 * (AC91). Drops request cookies and headers (which can carry the Supabase
 * auth session), and truncates the event message and each exception value so
 * a render error that echoes poem source back in its message can't smuggle
 * the poem out. Poem source is never attached to an event deliberately; this
 * is the belt-and-braces against it arriving by accident. `sendDefaultPii`
 * stays `false`, so no request body or user IP is collected in the first
 * place.
 */
export function scrubEvent(event: ScrubbableEvent): ScrubbableEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
  }

  if (typeof event.message === "string") {
    event.message = truncate(event.message);
  }

  for (const value of event.exception?.values ?? []) {
    if (typeof value.value === "string") {
      value.value = truncate(value.value);
    }
  }

  return event;
}

/**
 * The init options shared by the Node (server) and Edge runtime configs.
 * Read as a function so `SENTRY_DSN` is resolved at init time, not at module
 * load. Errors and structured logs only — no performance tracing
 * (`tracesSampleRate: 0`), which keeps the collection surface to "what the
 * server was doing when it failed" and the free-tier quota untouched by
 * per-request spans.
 */
export function sentryInitOptions(): Sentry.NodeOptions {
  return {
    dsn: process.env.SENTRY_DSN,
    // Never attach request bodies, IPs, or user identifiers automatically.
    sendDefaultPii: false,
    // Goal 3: structured server logs, GA and 5 GB/month free.
    enableLogs: true,
    // Errors + logs are the product here; no span sampling.
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  };
}

/**
 * Records a server-side failure that the app otherwise swallows to keep a
 * viewer's experience graceful — as both a grouped, stack-traced Sentry
 * *error event* (for triage) and a structured *log line* (for search, goal
 * 3). The caller still degrades exactly as before; this only makes the
 * failure visible.
 *
 * `tags` should be opaque identifiers (a `share_id`, a poem `id`) — never
 * poem content. A no-op when `SENTRY_DSN` is unset.
 */
export function reportSwallowedError(
  error: unknown,
  message: string,
  tags?: Record<string, string>,
): void {
  Sentry.captureException(error, tags ? { tags } : undefined);
  Sentry.logger.error(message, tags);
}
