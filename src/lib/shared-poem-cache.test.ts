import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCachedSharedPoem, sharedPoemCacheTag } from "./shared-poem-cache";
import { getSharedPoem } from "@/lib/get-shared-poem";
import { getSupabaseServer } from "@/lib/supabase-server";
import { probeBackendHealth } from "@/lib/backend-health";

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

vi.mock("@/lib/backend-health", () => ({
  probeBackendHealth: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(probeBackendHealth).mockResolvedValue("available");
});

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

    const result = await getCachedSharedPoem("abc123");

    expect(getSupabaseServer).toHaveBeenCalled();
    expect(getSharedPoem).toHaveBeenCalledWith("abc123", "the-server-client");
    expect(result).toEqual({
      kind: "found",
      poem: expect.objectContaining({ title: "A Title" }),
    });
  });

  it("resolves to not-found instead of throwing when the read path fails (issue #52)", async () => {
    vi.mocked(getSharedPoem).mockRejectedValue(new Error("boom"));

    await expect(getCachedSharedPoem("abc123")).resolves.toEqual({
      kind: "not-found",
    });
  });

  it("resolves to not-found for a genuine miss", async () => {
    vi.mocked(getSharedPoem).mockResolvedValue(null);

    await expect(getCachedSharedPoem("abc123")).resolves.toEqual({
      kind: "not-found",
    });
  });

  it("resolves to unavailable, without attempting the read, when the backend is down (issue #422)", async () => {
    vi.mocked(probeBackendHealth).mockResolvedValue("unavailable");

    await expect(getCachedSharedPoem("abc123")).resolves.toEqual({
      kind: "unavailable",
    });
    expect(getSharedPoem).not.toHaveBeenCalled();
  });
});
