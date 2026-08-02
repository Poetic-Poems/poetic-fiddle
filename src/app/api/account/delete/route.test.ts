import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { DELETE } from "./route";
import { getSupabaseAdmin } from "@/lib/supabase-server";

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function request(headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/account/delete", {
    method: "DELETE",
    headers,
  });
}

function fakeAdmin({
  getUserResult,
  deleteUserResult,
  poemsResult,
}: {
  getUserResult: { data: { user: { id: string } | null }; error: unknown };
  deleteUserResult?: { error: unknown };
  poemsResult?: { data: { share_id: string | null }[] | null; error: unknown };
}) {
  const deleteUser = vi.fn(() =>
    Promise.resolve(deleteUserResult ?? { error: null }),
  );
  // The share-id lookup is a PostgREST builder chain, so each link returns
  // the same recorder and the terminal `.not()` resolves it.
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    not: vi.fn(() => Promise.resolve(poemsResult ?? { data: [], error: null })),
  };
  return {
    auth: {
      getUser: vi.fn(() => Promise.resolve(getUserResult)),
      admin: { deleteUser },
    },
    from: vi.fn(() => query),
    query,
  };
}

describe("DELETE /api/account/delete", () => {
  it("rejects a request with no Authorization header", async () => {
    const response = await DELETE(request());

    expect(response.status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects a request whose bearer token doesn't verify (expired, forged, or absent session)", async () => {
    const admin = fakeAdmin({
      getUserResult: { data: { user: null }, error: { message: "invalid" } },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      admin as unknown as ReturnType<typeof getSupabaseAdmin>,
    );

    const response = await DELETE(
      request({ Authorization: "Bearer not-a-real-token" }),
    );

    expect(response.status).toBe(401);
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes only the account the verified token belongs to — never a client-supplied id", async () => {
    const admin = fakeAdmin({
      getUserResult: { data: { user: { id: "user-123" } }, error: null },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      admin as unknown as ReturnType<typeof getSupabaseAdmin>,
    );

    const response = await DELETE(
      request({ Authorization: "Bearer a-real-token" }),
    );

    expect(admin.auth.getUser).toHaveBeenCalledWith("a-real-token");
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("user-123");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, shareIds: [] });
  });

  it("returns the account's share ids, read before the delete and scoped to its own poems", async () => {
    const admin = fakeAdmin({
      getUserResult: { data: { user: { id: "user-123" } }, error: null },
      poemsResult: {
        data: [{ share_id: "share-a" }, { share_id: "share-b" }],
        error: null,
      },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      admin as unknown as ReturnType<typeof getSupabaseAdmin>,
    );

    const response = await DELETE(
      request({ Authorization: "Bearer a-real-token" }),
    );

    expect(admin.from).toHaveBeenCalledWith("poems");
    // This client bypasses RLS, so the owner filter is the only thing keeping
    // one poet's lookup off another poet's rows.
    expect(admin.query.eq).toHaveBeenCalledWith("owner_id", "user-123");
    expect(admin.query.not).toHaveBeenCalledWith("share_id", "is", null);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      shareIds: ["share-a", "share-b"],
    });
  });

  it("still deletes the account when the share-id lookup fails", async () => {
    const cause = { message: "select failed" };
    const admin = fakeAdmin({
      getUserResult: { data: { user: { id: "user-123" } }, error: null },
      poemsResult: { data: null, error: cause },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      admin as unknown as ReturnType<typeof getSupabaseAdmin>,
    );

    const response = await DELETE(
      request({ Authorization: "Bearer a-real-token" }),
    );

    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("user-123");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, shareIds: [] });
    expect(Sentry.captureException).toHaveBeenCalledWith(cause, {
      tags: { user_id: "user-123" },
    });
  });

  it("reports a failed deletion to Sentry and returns a safe error, without leaking the cause", async () => {
    const cause = { message: "service unavailable" };
    const admin = fakeAdmin({
      getUserResult: { data: { user: { id: "user-123" } }, error: null },
      deleteUserResult: { error: cause },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      admin as unknown as ReturnType<typeof getSupabaseAdmin>,
    );

    const response = await DELETE(
      request({ Authorization: "Bearer a-real-token" }),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).not.toContain("service unavailable");
    expect(Sentry.captureException).toHaveBeenCalledWith(cause, {
      tags: { user_id: "user-123" },
    });
  });
});
