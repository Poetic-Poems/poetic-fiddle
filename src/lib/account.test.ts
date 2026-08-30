import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountDeleteError,
  AccountExportError,
  deleteAccount,
  exportAccountData,
} from "./account";
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

describe("exportAccountData", () => {
  it("throws without calling the route when there's no active session", async () => {
    withSession(null);

    await expect(exportAccountData()).rejects.toBeInstanceOf(
      AccountExportError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls the export route with the session's access token", async () => {
    withSession("the-access-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Blob(["archive bytes"]), { status: 200 }),
    );

    await exportAccountData();

    expect(fetch).toHaveBeenCalledWith("/api/account/export", {
      headers: { Authorization: "Bearer the-access-token" },
    });
  });

  it("resolves to the archive blob and the filename the route chose", async () => {
    withSession("the-access-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Blob(["archive bytes"]), {
        status: 200,
        headers: {
          "Content-Disposition":
            'attachment; filename="poetic-fiddle-export-2026.tar.gz"',
        },
      }),
    );

    const result = await exportAccountData();

    expect(result.filename).toBe("poetic-fiddle-export-2026.tar.gz");
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it("falls back to a default filename when the route omits Content-Disposition", async () => {
    withSession("the-access-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Blob(["archive bytes"]), { status: 200 }),
    );

    const result = await exportAccountData();

    expect(result.filename).toBe("poetic-fiddle-export.tar.gz");
  });

  it("throws when the route reports failure, without leaking the raw response as the message", async () => {
    withSession("the-access-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "internal detail" }), {
        status: 500,
      }),
    );

    await expect(exportAccountData()).rejects.toThrow(
      "Couldn't export your data — please try again.",
    );
  });
});
