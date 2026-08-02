import { describe, expect, it, vi } from "vitest";
import {
  exportPoetData,
  findUserIdByEmail,
  looksLikeUserId,
  resolveUserId,
} from "./export-poet-data.mjs";

function fakeAdmin({
  listUsersPages = [],
  getUserByIdResult,
  profileResult = { data: null, error: null },
  poemsResult = { data: [], error: null },
} = {}) {
  let call = 0;
  const listUsers = vi.fn(() =>
    Promise.resolve(listUsersPages[call++] ?? { data: { users: [] }, error: null }),
  );
  const getUserById = vi.fn(() => Promise.resolve(getUserByIdResult));
  // Chainable PostgREST-style builder: from().select().eq() resolves for
  // profiles' .maybeSingle(), and .order() resolves for poems.
  const profileQuery = {
    select: vi.fn(() => profileQuery),
    eq: vi.fn(() => profileQuery),
    maybeSingle: vi.fn(() => Promise.resolve(profileResult)),
  };
  const poemsQuery = {
    select: vi.fn(() => poemsQuery),
    eq: vi.fn(() => poemsQuery),
    order: vi.fn(() => Promise.resolve(poemsResult)),
  };
  const from = vi.fn((table) =>
    table === "profiles" ? profileQuery : poemsQuery,
  );
  return {
    auth: { admin: { listUsers, getUserById } },
    from,
    profileQuery,
    poemsQuery,
  };
}

describe("looksLikeUserId", () => {
  it("recognises a UUID", () => {
    expect(looksLikeUserId("11111111-1111-1111-1111-111111111111")).toBe(
      true,
    );
  });

  it("rejects an email", () => {
    expect(looksLikeUserId("poet@example.com")).toBe(false);
  });
});

describe("findUserIdByEmail", () => {
  it("matches case-insensitively on the first page", async () => {
    const admin = fakeAdmin({
      listUsersPages: [
        {
          data: {
            users: [
              { id: "user-1", email: "Poet@Example.com" },
              { id: "user-2", email: "other@example.com" },
            ],
          },
          error: null,
        },
      ],
    });

    await expect(
      findUserIdByEmail(admin, "poet@example.com"),
    ).resolves.toBe("user-1");
  });

  it("pages until it finds a match", async () => {
    const fullPage = {
      data: {
        users: Array.from({ length: 200 }, (_, i) => ({
          id: `filler-${i}`,
          email: `filler${i}@example.com`,
        })),
      },
      error: null,
    };
    const admin = fakeAdmin({
      listUsersPages: [
        fullPage,
        { data: { users: [{ id: "user-9", email: "poet@example.com" }] }, error: null },
      ],
    });

    await expect(
      findUserIdByEmail(admin, "poet@example.com"),
    ).resolves.toBe("user-9");
    expect(admin.auth.admin.listUsers).toHaveBeenCalledTimes(2);
  });

  it("throws once every page is exhausted with no match", async () => {
    const admin = fakeAdmin({
      listUsersPages: [{ data: { users: [] }, error: null }],
    });

    await expect(findUserIdByEmail(admin, "nobody@example.com")).rejects.toThrow(
      /No account found/,
    );
  });

  it("surfaces a listUsers error rather than silently finding nothing", async () => {
    const admin = fakeAdmin({
      listUsersPages: [
        { data: { users: [] }, error: { message: "service unavailable" } },
      ],
    });

    await expect(findUserIdByEmail(admin, "poet@example.com")).rejects.toThrow(
      /Couldn't list users/,
    );
  });
});

describe("resolveUserId", () => {
  it("passes a UUID through without listing users", async () => {
    const admin = fakeAdmin();
    await expect(
      resolveUserId(admin, "11111111-1111-1111-1111-111111111111"),
    ).resolves.toBe("11111111-1111-1111-1111-111111111111");
    expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
  });

  it("resolves an email via findUserIdByEmail", async () => {
    const admin = fakeAdmin({
      listUsersPages: [
        { data: { users: [{ id: "user-1", email: "poet@example.com" }] }, error: null },
      ],
    });
    await expect(resolveUserId(admin, "poet@example.com")).resolves.toBe(
      "user-1",
    );
  });
});

describe("exportPoetData", () => {
  it("collects the account, profile, and every poem row, scoped to owner_id", async () => {
    const admin = fakeAdmin({
      getUserByIdResult: {
        data: { user: { id: "user-1", email: "poet@example.com" } },
        error: null,
      },
      profileResult: {
        data: { id: "user-1", remix_default: true },
        error: null,
      },
      poemsResult: {
        data: [{ id: "poem-1", title: "Draft", status: "draft" }],
        error: null,
      },
    });

    const result = await exportPoetData(admin, "11111111-1111-1111-1111-111111111111");

    expect(admin.from).toHaveBeenCalledWith("profiles");
    expect(admin.profileQuery.eq).toHaveBeenCalledWith(
      "id",
      "11111111-1111-1111-1111-111111111111",
    );
    expect(admin.from).toHaveBeenCalledWith("poems");
    expect(admin.poemsQuery.eq).toHaveBeenCalledWith(
      "owner_id",
      "11111111-1111-1111-1111-111111111111",
    );
    expect(result.account).toEqual({ id: "user-1", email: "poet@example.com" });
    expect(result.profile).toEqual({ id: "user-1", remix_default: true });
    expect(result.poems).toEqual([
      { id: "poem-1", title: "Draft", status: "draft" },
    ]);
    expect(typeof result.exported_at).toBe("string");
  });

  it("throws when no account exists for the id", async () => {
    const admin = fakeAdmin({
      getUserByIdResult: { data: { user: null }, error: { message: "not found" } },
    });

    await expect(
      exportPoetData(admin, "11111111-1111-1111-1111-111111111111"),
    ).rejects.toThrow(/No account found/);
  });

  it("surfaces a poems query error", async () => {
    const admin = fakeAdmin({
      getUserByIdResult: {
        data: { user: { id: "user-1", email: "poet@example.com" } },
        error: null,
      },
      poemsResult: { data: null, error: { message: "select failed" } },
    });

    await expect(
      exportPoetData(admin, "11111111-1111-1111-1111-111111111111"),
    ).rejects.toThrow(/Couldn't read poems/);
  });
});
