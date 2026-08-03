import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  buildExportArchive,
  exportPoetData,
  findUserIdByEmail,
  looksLikeUserId,
  poemFileName,
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
    Promise.resolve(
      listUsersPages[call++] ?? { data: { users: [] }, error: null },
    ),
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
    expect(looksLikeUserId("11111111-1111-1111-1111-111111111111")).toBe(true);
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

    await expect(findUserIdByEmail(admin, "poet@example.com")).resolves.toBe(
      "user-1",
    );
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
        {
          data: { users: [{ id: "user-9", email: "poet@example.com" }] },
          error: null,
        },
      ],
    });

    await expect(findUserIdByEmail(admin, "poet@example.com")).resolves.toBe(
      "user-9",
    );
    expect(admin.auth.admin.listUsers).toHaveBeenCalledTimes(2);
  });

  it("throws once every page is exhausted with no match", async () => {
    const admin = fakeAdmin({
      listUsersPages: [{ data: { users: [] }, error: null }],
    });

    await expect(
      findUserIdByEmail(admin, "nobody@example.com"),
    ).rejects.toThrow(/No account found/);
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
        {
          data: { users: [{ id: "user-1", email: "poet@example.com" }] },
          error: null,
        },
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

    const result = await exportPoetData(
      admin,
      "11111111-1111-1111-1111-111111111111",
    );

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
      getUserByIdResult: {
        data: { user: null },
        error: { message: "not found" },
      },
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

describe("poemFileName", () => {
  it("slugs the title into an ordered ascii filename", () => {
    expect(poemFileName({ title: "The Autumn Wind!" }, 0)).toBe(
      "poems/001-the-autumn-wind.poem",
    );
  });

  it("falls back to the ordinal alone when the title has nothing sluggable", () => {
    expect(poemFileName({ title: "" }, 1)).toBe("poems/002.poem");
    expect(poemFileName({ title: "★☆" }, 2)).toBe("poems/003.poem");
  });

  it("keeps identically-titled poems distinct via the ordinal", () => {
    const a = poemFileName({ title: "Untitled" }, 0);
    const b = poemFileName({ title: "Untitled" }, 1);
    expect(a).not.toBe(b);
  });
});

// Walks the decompressed tar: reads each 512-byte ustar header, checks its
// magic and checksum, and collects {name, body} until the zero-block marker.
function listTarEntries(tarBuffer) {
  const entries = [];
  let offset = 0;
  while (offset < tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    expect(header.toString("utf8", 257, 262)).toBe("ustar");
    const stored = parseInt(header.toString("utf8", 148, 156), 8);
    const blanked = Buffer.from(header);
    blanked.fill(0x20, 148, 156);
    let sum = 0;
    for (const byte of blanked) sum += byte;
    expect(sum).toBe(stored);
    const name = header.toString("utf8", 0, 100).replace(/\0.*$/, "");
    const size = parseInt(header.toString("utf8", 124, 136), 8);
    const body = tarBuffer
      .subarray(offset + 512, offset + 512 + size)
      .toString("utf8");
    entries.push({ name, body });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

describe("buildExportArchive", () => {
  const payload = {
    exported_at: "2026-08-03T00:00:00.000Z",
    account: { id: "user-1", email: "poet@example.com" },
    profile: { id: "user-1" },
    poems: [
      {
        id: "poem-1",
        title: "The Autumn Wind",
        source_text: "# The Autumn Wind\n\nLeaves fall.\nSo do I.\n",
      },
      { id: "poem-2", title: "", source_text: "untitled lines\n" },
    ],
  };

  it("contains export.json with the whole payload, plus each poem verbatim", () => {
    const entries = listTarEntries(gunzipSync(buildExportArchive(payload)));

    expect(entries.map((e) => e.name)).toEqual([
      "export.json",
      "poems/001-the-autumn-wind.poem",
      "poems/002.poem",
    ]);
    expect(JSON.parse(entries[0].body)).toEqual(payload);
    expect(entries[1].body).toBe(
      "# The Autumn Wind\n\nLeaves fall.\nSo do I.\n",
    );
    expect(entries[2].body).toBe("untitled lines\n");
  });

  it("survives a poet with no poems", () => {
    const entries = listTarEntries(
      gunzipSync(buildExportArchive({ ...payload, poems: [] })),
    );
    expect(entries.map((e) => e.name)).toEqual(["export.json"]);
  });
});
