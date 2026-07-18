// Sentry initialisation for the Edge runtime. Loaded by
// src/instrumentation.ts's register() when NEXT_RUNTIME === "edge". Shares the
// same options as the Node config; the edge runtime is a distinct SDK entry
// point, so it needs its own init call. See docs/OBSERVABILITY-PLAN.md.
import * as Sentry from "@sentry/nextjs";
import { sentryInitOptions } from "@/lib/observability";

Sentry.init(sentryInitOptions());
