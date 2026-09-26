import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getSupabaseServer } from "@/lib/supabase-server";

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  reportSwallowedError: vi.fn(),
}));

const SECRET = "test-cron-secret";

function request(headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/heartbeat", { headers });
}

function fakeSupabase(rpcResult: { error: unknown }) {
  return { rpc: vi.fn(() => Promise.resolve(rpcResult)) };
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.clearAllMocks();
});

describe("GET /api/heartbeat", () => {
  it("rejects a request with no Authorization header", async () => {
    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("rejects a request whose bearer token doesn't match CRON_SECRET", async () => {
    const response = await GET(
      request({ Authorization: "Bearer not-the-secret" }),
    );

    expect(response.status).toBe(403);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("rejects a well-formed but wrong-length bearer token", async () => {
    const response = await GET(
      request({ Authorization: `Bearer ${SECRET}-extra` }),
    );

    expect(response.status).toBe(403);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("rejects every request when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(request({ Authorization: `Bearer ${SECRET}` }));

    expect(response.status).toBe(403);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("bumps the heartbeat and returns 200 for a valid secret", async () => {
    const client = fakeSupabase({ error: null });
    vi.mocked(getSupabaseServer).mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseServer>,
    );

    const response = await GET(request({ Authorization: `Bearer ${SECRET}` }));

    expect(client.rpc).toHaveBeenCalledWith("bump_heartbeat");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 500 and reports the error when the RPC fails", async () => {
    const client = fakeSupabase({ error: { message: "db unreachable" } });
    vi.mocked(getSupabaseServer).mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseServer>,
    );

    const response = await GET(request({ Authorization: `Bearer ${SECRET}` }));

    expect(response.status).toBe(500);
  });
});
