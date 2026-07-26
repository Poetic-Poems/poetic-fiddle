import { afterEach, describe, expect, it, vi } from "vitest";
import { SUPABASE_TIMEOUT_MS, createTimeoutFetch } from "./supabase-fetch";

describe("createTimeoutFetch", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("suggests a 10-15s bound", () => {
    expect(SUPABASE_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(SUPABASE_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
  });

  it("passes fetch a signal that is not yet aborted", async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_input, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return Promise.resolve(new Response());
    }) as unknown as typeof fetch;

    await createTimeoutFetch(5_000)("https://example.com");

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(false);
  });

  it("aborts a request that outlives the timeout window", async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_input, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      // Simulate a hung request: never resolves on its own.
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;

    void createTimeoutFetch(10)("https://example.com");

    await vi.waitFor(() => expect(capturedSignal?.aborted).toBe(true));
    expect((capturedSignal?.reason as DOMException)?.name).toBe("TimeoutError");
  });

  it("also aborts when the caller's own signal aborts, independent of the timeout", async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_input, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;

    const controller = new AbortController();
    void createTimeoutFetch(60_000)("https://example.com", {
      signal: controller.signal,
    });
    controller.abort();

    await vi.waitFor(() => expect(capturedSignal?.aborted).toBe(true));
  });
});
