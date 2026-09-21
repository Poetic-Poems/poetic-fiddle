import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { probeBackendHealth } from "./backend-health";

describe("probeBackendHealth", () => {
  const realFetch = global.fetch;
  const env = process.env;

  beforeEach(() => {
    process.env = {
      ...env,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };
  });

  afterEach(() => {
    global.fetch = realFetch;
    process.env = env;
  });

  it("resolves 'unavailable' without calling fetch when the URL env var is unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    global.fetch = vi.fn();

    expect(await probeBackendHealth()).toBe("unavailable");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("resolves 'unavailable' without calling fetch when the anon key env var is unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    global.fetch = vi.fn();

    expect(await probeBackendHealth()).toBe("unavailable");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("resolves 'available' for a healthy response, carrying the anon key", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    ) as unknown as typeof fetch;

    expect(await probeBackendHealth()).toBe("available");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/health",
      expect.objectContaining({
        headers: { apikey: "anon-key" },
      }),
    );
  });

  it("resolves 'unavailable' for a non-2xx response", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 500 })),
    ) as unknown as typeof fetch;

    expect(await probeBackendHealth()).toBe("unavailable");
  });

  it("resolves 'unavailable' rather than throwing when fetch rejects (a dead host)", async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new TypeError("fetch failed")),
    ) as unknown as typeof fetch;

    expect(await probeBackendHealth()).toBe("unavailable");
  });

  it("bounds the request with an AbortSignal, per createTimeoutFetch (see supabase-fetch.test.ts for its own timeout behaviour)", async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = vi.fn((_input, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return Promise.resolve(new Response(null, { status: 200 }));
    }) as unknown as typeof fetch;

    await probeBackendHealth();

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(false);
  });
});
