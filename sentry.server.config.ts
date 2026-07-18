// Sentry initialisation for the Node.js server runtime. Loaded by
// src/instrumentation.ts's register() when NEXT_RUNTIME === "nodejs".
// Server-side only — there is deliberately no instrumentation-client.ts, so
// no client bundle change, no CSP change, and the share page stays JS-free
// (AC84). See docs/OBSERVABILITY-PLAN.md.
import * as Sentry from "@sentry/nextjs";
import { sentryInitOptions } from "@/lib/observability";

Sentry.init(sentryInitOptions());
