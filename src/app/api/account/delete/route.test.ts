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
}: {
  getUserResult: { data: { user: { id: string } | null }; error: unknown };
  deleteUserResult?: { error: unknown };
}) {
  const deleteUser = vi.fn(() =>
    Promise.resolve(deleteUserResult ?? { error: null }),
  );
  return {
    auth: {
      getUser: vi.fn(() => Promise.resolve(getUserResult)),
      admin: { deleteUser },
    },
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
    await expect(response.json()).resolves.toEqual({ ok: true });
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
