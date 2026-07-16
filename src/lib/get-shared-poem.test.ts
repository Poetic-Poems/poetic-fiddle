import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSharedPoem } from "./get-shared-poem";
import { EXAMPLE_POEM } from "@/lib/example-poem";

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

/** A stand-in for the RPC query builder (get_shared_poem), and the client
 * that carries it — this module takes its client explicitly rather than
 * importing the browser singleton (see get-shared-poem.ts's header comment),
 * so tests build a minimal fake here instead of mocking supabase-client.
 */
function fakeClient(result: QueryResult) {
  const rpc = vi.fn(() => ({
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  }));
  return { rpc } as unknown as SupabaseClient;
}

describe("getSharedPoem", () => {
  it("reads a shared poem through the get_shared_poem RPC", async () => {
    const client = fakeClient({
      data: {
        title: "A Title",
        source_text: EXAMPLE_POEM,
        allow_remix: false,
        updated_at: "2026-07-16T00:00:00Z",
      },
      error: null,
    });

    const poem = await getSharedPoem("abc123", client);

    expect(client.rpc).toHaveBeenCalledWith("get_shared_poem", {
      p_share_id: "abc123",
    });
    expect(poem).toEqual({
      title: "A Title",
      source: EXAMPLE_POEM,
      allowRemix: false,
      updatedAt: "2026-07-16T00:00:00Z",
    });
  });

  it("returns null for an id that doesn't exist or names a draft (AC87)", async () => {
    const client = fakeClient({ data: null, error: null });

    expect(await getSharedPoem("no-such-id", client)).toBeNull();
  });

  it("returns null rather than throwing on an RPC error", async () => {
    const client = fakeClient({
      data: null,
      error: { message: "network error" },
    });

    expect(await getSharedPoem("abc123", client)).toBeNull();
  });
});
