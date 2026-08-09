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
