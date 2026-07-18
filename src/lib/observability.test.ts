import { afterEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import {
  reportSwallowedError,
  scrubEvent,
  sentryInitOptions,
} from "./observability";

// @sentry/nextjs is stubbed globally in vitest.setup.ts (vi.fn()s), so the
// assertions below spy on that inert stub rather than the real SDK — which
// can't be initialised or namespace-spied in ESM under test anyway.
type EventArg = Parameters<typeof scrubEvent>[0];

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.SENTRY_DSN;
});

describe("scrubEvent", () => {
  it("drops request cookies, headers, and body (the auth session lives there)", () => {
    const scrubbed = scrubEvent({
      request: {
        url: "https://poeticfiddle.com/share/abc",
        cookies: { "sb-access-token": "secret" },
        headers: { authorization: "Bearer secret" },
        data: { some: "body" },
      },
    } as unknown as EventArg);

    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.headers).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    // The non-sensitive parts are left intact for triage.
    expect(scrubbed.request?.url).toBe("https://poeticfiddle.com/share/abc");
  });

  it("truncates a long message and long exception values (poem text can't ride out)", () => {
    const poem = "x".repeat(5000);
    const scrubbed = scrubEvent({
      message: poem,
      exception: { values: [{ type: "Error", value: poem }] },
    } as unknown as EventArg);

    expect(scrubbed.message?.length).toBeLessThan(poem.length);
    expect(scrubbed.message).toMatch(/… \(truncated\)$/);
    expect(scrubbed.exception?.values?.[0]?.value).toMatch(/… \(truncated\)$/);
  });

  it("leaves a short message untouched and tolerates a bare event", () => {
    expect(scrubEvent({ message: "boom" } as unknown as EventArg).message).toBe(
      "boom",
    );
    expect(() => scrubEvent({} as unknown as EventArg)).not.toThrow();
  });
});

describe("sentryInitOptions", () => {
  it("collects errors + logs only, never PII, and reads the DSN at call time", () => {
    process.env.SENTRY_DSN = "https://key@example.ingest.sentry.io/1";
    const options = sentryInitOptions();

    expect(options.dsn).toBe("https://key@example.ingest.sentry.io/1");
    expect(options.sendDefaultPii).toBe(false);
    expect(options.enableLogs).toBe(true);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.beforeSend).toBe(scrubEvent);
  });

  it("leaves the DSN undefined when unset, so the SDK initialises disabled", () => {
    expect(sentryInitOptions().dsn).toBeUndefined();
  });
});

describe("reportSwallowedError", () => {
  it("records both an error event and a structured log line, with opaque tags", () => {
    const error = new Error("RPC failed");

    reportSwallowedError(error, "share page: read failed", { share_id: "abc" });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { share_id: "abc" },
    });
    expect(Sentry.logger.error).toHaveBeenCalledWith(
      "share page: read failed",
      {
        share_id: "abc",
      },
    );
  });

  it("omits the tags argument to captureException when no tags are given", () => {
    reportSwallowedError(new Error("boom"), "share page: render failed");

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      undefined,
    );
    expect(Sentry.logger.error).toHaveBeenCalledWith(
      "share page: render failed",
      undefined,
    );
  });
});
