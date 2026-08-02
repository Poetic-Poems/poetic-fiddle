import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDeleteError, deleteAccount } from "./account";
import { supabase } from "@/lib/supabase-client";

vi.mock("@/lib/supabase-client", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

function withSession(accessToken: string | null) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: {
      session: accessToken ? ({ access_token: accessToken } as never) : null,
    },
    error: null,
  } as never);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("deleteAccount", () => {
  it("throws without calling the route when there's no active session", async () => {
    withSession(null);

    await expect(deleteAccount()).rejects.toBeInstanceOf(AccountDeleteError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls the delete route with the session's access token", async () => {
    withSession("the-access-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await deleteAccount();

    expect(fetch).toHaveBeenCalledWith("/api/account/delete", {
      method: "DELETE",
      headers: { Authorization: "Bearer the-access-token" },
    });
  });

  it("returns the share ids the route reports, for the caller to invalidate", async () => {
    withSession("the-access-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, shareIds: ["a", "b"] }), {
        status: 200,
      }),
    );

    await expect(deleteAccount()).resolves.toEqual(["a", "b"]);
  });

  it("resolves to no share ids — rather than throwing — when the success body doesn't parse", async () => {
    withSession("the-access-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response("not json", { status: 200 }),
    );

    await expect(deleteAccount()).resolves.toEqual([]);
  });

  it("throws when the route reports failure, without leaking the raw response as the message", async () => {
    withSession("the-access-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "internal detail" }), {
        status: 500,
      }),
    );

    await expect(deleteAccount()).rejects.toThrow(
      "Couldn't delete your account — please try again.",
    );
  });
});
