import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Unmocked, unlike route.test.ts/shared-poem-cache.test.ts, which both stub
// this module entirely — this file exercises the real getters, including the
// fail-closed guard that is otherwise only asserted by reading the code (see
// TECH-DEBT.md TD-PPpfid-26080902).
const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

let savedEnv: Record<(typeof ENV_KEYS)[number], string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as typeof savedEnv;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.resetModules();
});

describe("getSupabaseServer", () => {
  it("throws when NEXT_PUBLIC_SUPABASE_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    vi.resetModules();
    const { getSupabaseServer } = await import("./supabase-server");

    expect(() => getSupabaseServer()).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is unset", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    vi.resetModules();
    const { getSupabaseServer } = await import("./supabase-server");

    expect(() => getSupabaseServer()).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("constructs a client when both vars are set", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    vi.resetModules();
    const { getSupabaseServer } = await import("./supabase-server");

    expect(getSupabaseServer()).toBeTruthy();
  });
});

describe("getSupabaseAdmin", () => {
  it("throws when NEXT_PUBLIC_SUPABASE_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    vi.resetModules();
    const { getSupabaseAdmin } = await import("./supabase-server");

    expect(() => getSupabaseAdmin()).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is unset — the sole RLS-bypass client fails closed", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();
    const { getSupabaseAdmin } = await import("./supabase-server");

    expect(() => getSupabaseAdmin()).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("constructs a client when both vars are set", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    vi.resetModules();
    const { getSupabaseAdmin } = await import("./supabase-server");

    expect(getSupabaseAdmin()).toBeTruthy();
  });
});

describe("getSupabaseForToken", () => {
  it("throws when NEXT_PUBLIC_SUPABASE_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    vi.resetModules();
    const { getSupabaseForToken } = await import("./supabase-server");

    expect(() => getSupabaseForToken("a-token")).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is unset", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    vi.resetModules();
    const { getSupabaseForToken } = await import("./supabase-server");

    expect(() => getSupabaseForToken("a-token")).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("constructs a fresh client per call, never a cached one", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    vi.resetModules();
    const { getSupabaseForToken } = await import("./supabase-server");

    const first = getSupabaseForToken("token-a");
    const second = getSupabaseForToken("token-b");

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  // The whole export route's scoping rests on this one header reaching
  // PostgREST: without it every query would run as the anon role, and with
  // the wrong one it would run as somebody else. Asserted against the
  // outgoing request rather than the client's internals, so a supabase-js
  // upgrade that moves where the header is held still has to keep sending it.
  it("sends the caller's own token as the Authorization header on each query", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    vi.resetModules();
    const { getSupabaseForToken } = await import("./supabase-server");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    try {
      await getSupabaseForToken("caller-token").from("poems").select("id");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers);
      expect(headers.get("Authorization")).toBe("Bearer caller-token");
      expect(headers.get("apikey")).toBe("test-anon-key");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
