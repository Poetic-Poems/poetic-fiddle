import { beforeEach, describe, expect, it, vi } from "vitest";
import { PoemSaveError, savePoem } from "./poems-store";
import { supabase } from "@/lib/supabase-client";
import { EXAMPLE_POEM } from "@/lib/example-poem";

vi.mock("@/lib/supabase-client", () => ({
  supabase: { from: vi.fn() },
}));

interface QueryResult {
  data: { id: string; title: string; updated_at: string } | null;
  error: { message: string } | null;
}

/** A stand-in for the PostgREST query builder, which chains until `single()`. */
function mockQuery(result: QueryResult) {
  const query = {
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(result)),
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
