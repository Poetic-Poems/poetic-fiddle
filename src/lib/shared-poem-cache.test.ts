import { describe, expect, it, vi } from "vitest";
import { getCachedSharedPoem, sharedPoemCacheTag } from "./shared-poem-cache";
import { getSharedPoem } from "@/lib/get-shared-poem";
import { getSupabaseServer } from "@/lib/supabase-server";

// unstable_cache's real implementation needs a Next request context this
// unit test has none of — pass the wrapped function straight through, so
// what's under test is this module's own wiring (the tag, the client, the
// underlying call), not Next's caching machinery.
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      fn(...args),
}));

vi.mock("@/lib/get-shared-poem", () => ({
  getSharedPoem: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServer: vi.fn(() => "the-server-client"),
}));

describe("sharedPoemCacheTag", () => {
  it("is stable and distinct per share id", () => {
    expect(sharedPoemCacheTag("abc123")).toBe(sharedPoemCacheTag("abc123"));
    expect(sharedPoemCacheTag("abc123")).not.toBe(sharedPoemCacheTag("xyz789"));
  });
});

describe("getCachedSharedPoem", () => {
  it("reads through getSharedPoem using the server-side client", async () => {
    vi.mocked(getSharedPoem).mockResolvedValue({
      title: "A Title",
      source: "...",
      allowRemix: false,
      updatedAt: "2026-07-16T00:00:00Z",
    });

    const poem = await getCachedSharedPoem("abc123");

    expect(getSupabaseServer).toHaveBeenCalled();
    expect(getSharedPoem).toHaveBeenCalledWith("abc123", "the-server-client");
    expect(poem?.title).toBe("A Title");
  });
});
