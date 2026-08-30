import { describe, expect, it, vi, afterEach } from "vitest";
import { gunzipSync } from "node:zlib";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { GET } from "./route";
import { getSupabaseForToken } from "@/lib/supabase-server";

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseForToken: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function request(headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/account/export", {
    headers,
  });
}

// Walks the decompressed tar for export.json's own body, the same way
// src/lib/export-archive.test.ts's listTarEntries does — enough to pull out
// the JSON payload without depending on export.json being first or the
// archive containing nothing else.
function readExportJson(tarBuffer: Buffer) {
  const header = tarBuffer.subarray(0, 512);
  const size = parseInt(header.toString("utf8", 124, 136), 8);
  return JSON.parse(tarBuffer.subarray(512, 512 + size).toString("utf8"));
}

function fakeClient({
  getUserResult,
  profileResult,
  poemsResult,
  poems,
}: {
  getUserResult: {
    data: { user: { id: string; email?: string; created_at?: string } | null };
    error: unknown;
  };
  profileResult?: { data: unknown; error: unknown };
  // A single-page result, returned regardless of the requested range —
  // covers the error-path tests, where pagination never gets far enough to
  // matter.
  poemsResult?: { data: unknown[] | null; error: unknown };
  // The full row set to page through, sliced per `.range(start, end)` call —
  // covers the many-rows pagination test.
  poems?: unknown[];
}) {
  const profileQuery = {
    select: vi.fn(() => profileQuery),
    eq: vi.fn(() => profileQuery),
    maybeSingle: vi.fn(() =>
      Promise.resolve(profileResult ?? { data: null, error: null }),
    ),
  };
  const poemsQuery = {
    select: vi.fn(() => poemsQuery),
    order: vi.fn(() => poemsQuery),
    range: vi.fn((start: number, end: number) => {
      if (poemsResult) return Promise.resolve(poemsResult);
      return Promise.resolve({
        data: (poems ?? []).slice(start, end + 1),
        error: null,
      });
    }),
  };
  return {
    auth: { getUser: vi.fn(() => Promise.resolve(getUserResult)) },
    from: vi.fn((table: string) =>
      table === "profiles" ? profileQuery : poemsQuery,
    ),
    profileQuery,
    poemsQuery,
  };
}

describe("GET /api/account/export", () => {
  it("rejects a request with no Authorization header", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(getSupabaseForToken).not.toHaveBeenCalled();
  });

  it("rejects a request whose bearer token doesn't verify", async () => {
    const client = fakeClient({
      getUserResult: { data: { user: null }, error: { message: "invalid" } },
    });
    vi.mocked(getSupabaseForToken).mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseForToken>,
    );

    const response = await GET(
      request({ Authorization: "Bearer not-a-real-token" }),
    );

    expect(response.status).toBe(401);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("builds a client scoped to the verified token, not a client-supplied id", async () => {
    const client = fakeClient({
      getUserResult: { data: { user: { id: "user-123" } }, error: null },
    });
    vi.mocked(getSupabaseForToken).mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseForToken>,
    );

    await GET(request({ Authorization: "Bearer a-real-token" }));

    expect(getSupabaseForToken).toHaveBeenCalledWith("a-real-token");
    expect(client.auth.getUser).toHaveBeenCalledWith("a-real-token");
    expect(client.profileQuery.eq).toHaveBeenCalledWith("id", "user-123");
  });

  it("streams back a gzipped tar containing export.json and each poem", async () => {
    const client = fakeClient({
      getUserResult: {
        data: {
          user: {
            id: "user-123",
            email: "poet@example.com",
            created_at: "2026-01-01T00:00:00.000Z",
          },
        },
        error: null,
      },
      profileResult: {
        data: {
          remix_default: true,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
        },
        error: null,
      },
      poemsResult: {
        data: [
          {
            id: "poem-1",
            title: "The Autumn Wind",
            source_text: "Leaves fall.\n",
            status: "draft",
            share_id: null,
            allow_remix: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        error: null,
      },
    });
    vi.mocked(getSupabaseForToken).mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseForToken>,
    );

    const response = await GET(
      request({ Authorization: "Bearer a-real-token" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/gzip");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="poetic-fiddle-export-.+\.tar\.gz"$/,
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    const decompressed = gunzipSync(bytes).toString("utf8");
    expect(decompressed).toContain('"email": "poet@example.com"');
    expect(decompressed).toContain("Leaves fall.");
  });

  it("pages through every poem when there are more rows than one page", async () => {
    // Mirrors the route's own POEMS_PAGE_SIZE (1000): one row past a full
    // page proves the loop doesn't stop at the first `.range()` call.
    const PAGE_SIZE = 1000;
    const poems = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({
      id: `poem-${i}`,
      title: `Poem ${i}`,
      source_text: `line ${i}\n`,
      status: "draft",
      share_id: null,
      allow_remix: null,
      created_at: `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}.000Z`,
      updated_at: "2026-01-01T00:00:00.000Z",
    }));
    const client = fakeClient({
      getUserResult: {
        data: { user: { id: "user-123", email: "poet@example.com" } },
        error: null,
      },
      poems,
    });
    vi.mocked(getSupabaseForToken).mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseForToken>,
    );

    const response = await GET(
      request({ Authorization: "Bearer a-real-token" }),
    );

    expect(response.status).toBe(200);
    const tarBuffer = gunzipSync(Buffer.from(await response.arrayBuffer()));
    const exportJson = readExportJson(tarBuffer);
    expect(exportJson.poems).toHaveLength(PAGE_SIZE + 1);
    expect(exportJson.poems.map((p: { id: string }) => p.id)).toEqual(
      poems.map((p) => p.id),
    );
    expect(client.poemsQuery.range).toHaveBeenCalledWith(0, PAGE_SIZE - 1);
    expect(client.poemsQuery.range).toHaveBeenCalledWith(
      PAGE_SIZE,
      PAGE_SIZE * 2 - 1,
    );
  });

  it("reports failure and does not leak the cause when the profile query errors", async () => {
    const cause = { message: "select failed" };
    const client = fakeClient({
      getUserResult: { data: { user: { id: "user-123" } }, error: null },
      profileResult: { data: null, error: cause },
    });
    vi.mocked(getSupabaseForToken).mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseForToken>,
    );

    const response = await GET(
      request({ Authorization: "Bearer a-real-token" }),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).not.toContain("select failed");
    expect(Sentry.captureException).toHaveBeenCalledWith(cause, {
      tags: { user_id: "user-123" },
    });
  });

  it("reports failure when the poems query errors", async () => {
    const cause = { message: "select failed" };
    const client = fakeClient({
      getUserResult: { data: { user: { id: "user-123" } }, error: null },
      poemsResult: { data: null, error: cause },
    });
    vi.mocked(getSupabaseForToken).mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseForToken>,
    );

    const response = await GET(
      request({ Authorization: "Bearer a-real-token" }),
    );

    expect(response.status).toBe(500);
    expect(Sentry.captureException).toHaveBeenCalledWith(cause, {
      tags: { user_id: "user-123" },
    });
  });
});
