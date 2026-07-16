import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PoemListError,
  PoemLoadError,
  PoemSaveError,
  PoemShareError,
  PoemUnshareError,
  listPoems,
  loadPoem,
  savePoem,
  sharePoem,
  unsharePoem,
} from "./poems-store";
import { supabase } from "@/lib/supabase-client";
import { EXAMPLE_POEM } from "@/lib/example-poem";

vi.mock("@/lib/supabase-client", () => ({
  supabase: { from: vi.fn() },
}));

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

/** A stand-in for the PostgREST query builder, which chains until it resolves. */
function mockQuery(result: QueryResult) {
  const query = {
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    returns: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  vi.mocked(supabase.from).mockReturnValue(
    query as unknown as ReturnType<typeof supabase.from>,
  );
  return query;
}

const ROW = {
  id: "poem-1",
  title: "A Title",
  updated_at: "2026-07-16T00:00:00Z",
  share_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("savePoem", () => {
  it("inserts a poem owned by the signed-in poet on a first save", async () => {
    const query = mockQuery({ data: ROW, error: null });

    const saved = await savePoem({
      id: null,
      ownerId: "user-1",
      source: EXAMPLE_POEM,
    });

    expect(query.insert).toHaveBeenCalledWith({
      owner_id: "user-1",
      title: "Hello, poet — Welcome to Poetic Fiddle",
      source_text: EXAMPLE_POEM,
    });
    expect(query.update).not.toHaveBeenCalled();
    expect(saved).toEqual({
      id: "poem-1",
      title: "A Title",
      updatedAt: "2026-07-16T00:00:00Z",
      shareId: null,
    });
  });

  it("updates the same row on later saves, leaving status and share_id alone", async () => {
    const query = mockQuery({ data: ROW, error: null });

    await savePoem({ id: "poem-1", ownerId: "user-1", source: EXAMPLE_POEM });

    expect(query.update).toHaveBeenCalledWith({
      title: "Hello, poet — Welcome to Poetic Fiddle",
      source_text: EXAMPLE_POEM,
    });
    expect(query.eq).toHaveBeenCalledWith("id", "poem-1");
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("saves source that doesn't parse, with an empty title", async () => {
    const query = mockQuery({ data: { ...ROW, title: "" }, error: null });

    await savePoem({ id: null, ownerId: "user-1", source: "half a thought" });

    expect(query.insert).toHaveBeenCalledWith({
      owner_id: "user-1",
      title: "",
      source_text: "half a thought",
    });
  });

  it("throws a readable error, keeping the cause, when the save fails", async () => {
    mockQuery({
      data: null,
      error: { message: "violates row-level security" },
    });

    const save = savePoem({
      id: null,
      ownerId: "user-1",
      source: EXAMPLE_POEM,
    });

    await expect(save).rejects.toBeInstanceOf(PoemSaveError);
    await expect(save).rejects.toThrow(/Couldn't save your poem/);
    await expect(save).rejects.toMatchObject({
      cause: { message: "violates row-level security" },
    });
  });
});

describe("listPoems", () => {
  it("lists all the owner's poems regardless of status, most recently updated first", async () => {
    const rows = [
      {
        id: "poem-2",
        title: "Newer",
        updated_at: "2026-07-17T00:00:00Z",
        share_id: "abc123",
      },
      {
        id: "poem-1",
        title: "Older",
        updated_at: "2026-07-16T00:00:00Z",
        share_id: null,
      },
    ];
    const query = mockQuery({ data: rows, error: null });

    const poems = await listPoems("user-1");

    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(query.eq).not.toHaveBeenCalledWith("status", "draft");
    expect(query.order).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
    expect(poems).toEqual([
      {
        id: "poem-2",
        title: "Newer",
        updatedAt: "2026-07-17T00:00:00Z",
        shareId: "abc123",
      },
      {
        id: "poem-1",
        title: "Older",
        updatedAt: "2026-07-16T00:00:00Z",
        shareId: null,
      },
    ]);
  });

  it("returns an empty list rather than null when there are no poems", async () => {
    mockQuery({ data: null, error: null });

    expect(await listPoems("user-1")).toEqual([]);
  });

  it("throws a readable error, keeping the cause, when the list fails", async () => {
    mockQuery({ data: null, error: { message: "network error" } });

    const list = listPoems("user-1");

    await expect(list).rejects.toBeInstanceOf(PoemListError);
    await expect(list).rejects.toThrow(/Couldn't load your poems/);
    await expect(list).rejects.toMatchObject({
      cause: { message: "network error" },
    });
  });
});

describe("loadPoem", () => {
  it("loads a poem's source by id", async () => {
    const query = mockQuery({
      data: { id: "poem-1", source_text: EXAMPLE_POEM, share_id: null },
      error: null,
    });

    const poem = await loadPoem("poem-1");

    expect(query.eq).toHaveBeenCalledWith("id", "poem-1");
    expect(poem).toEqual({
      id: "poem-1",
      source: EXAMPLE_POEM,
      shareId: null,
    });
  });

  it("carries an already-minted share id", async () => {
    mockQuery({
      data: { id: "poem-1", source_text: EXAMPLE_POEM, share_id: "abc123" },
      error: null,
    });

    const poem = await loadPoem("poem-1");

    expect(poem.shareId).toBe("abc123");
  });

  it("throws when the poem doesn't exist or isn't the caller's (AC87)", async () => {
    mockQuery({
      data: null,
      error: {
        message: "JSON object requested, multiple (or no) rows returned",
      },
    });

    const load = loadPoem("someone-elses-poem");

    await expect(load).rejects.toBeInstanceOf(PoemLoadError);
    await expect(load).rejects.toThrow(/couldn't be found/);
  });
});

describe("sharePoem", () => {
  it("moves a poem out of draft and returns its minted share id (AC17, AC29)", async () => {
    const query = mockQuery({ data: { share_id: "abc123" }, error: null });

    const shareId = await sharePoem("poem-1");

    expect(query.update).toHaveBeenCalledWith({ status: "unlisted" });
    expect(query.eq).toHaveBeenCalledWith("id", "poem-1");
    expect(shareId).toBe("abc123");
  });

  it("throws when the row doesn't come back with a share id", async () => {
    mockQuery({ data: null, error: { message: "no rows" } });

    const share = sharePoem("poem-1");

    await expect(share).rejects.toBeInstanceOf(PoemShareError);
    await expect(share).rejects.toThrow(/Couldn't create a share link/);
  });
});

describe("unsharePoem", () => {
  it("moves a shared poem back to draft, leaving its share_id in place", async () => {
    const query = mockQuery({ data: { id: "poem-1" }, error: null });

    await unsharePoem("poem-1");

    expect(query.update).toHaveBeenCalledWith({ status: "draft" });
    expect(query.eq).toHaveBeenCalledWith("id", "poem-1");
  });

  it("throws when the row doesn't come back", async () => {
    mockQuery({ data: null, error: { message: "no rows" } });

    const unshare = unsharePoem("poem-1");

    await expect(unshare).rejects.toBeInstanceOf(PoemUnshareError);
    await expect(unshare).rejects.toThrow(/Couldn't remove the share link/);
  });
});
