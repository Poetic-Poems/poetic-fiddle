import { afterEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { updateTag } from "next/cache";
import { revalidateSharedPoem } from "./revalidate-share";
import { sharedPoemCacheTag } from "@/lib/shared-poem-cache";

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("revalidateSharedPoem", () => {
  it("invalidates the share's cache tag", async () => {
    await revalidateSharedPoem("abc123");

    expect(updateTag).toHaveBeenCalledWith(sharedPoemCacheTag("abc123"));
  });

  it("reports a failed invalidation to Sentry instead of throwing (this call is best-effort from Editor.tsx)", async () => {
    const error = new Error("tag store unavailable");
    vi.mocked(updateTag).mockImplementationOnce(() => {
      throw error;
    });

    await expect(revalidateSharedPoem("abc123")).resolves.toBeUndefined();

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { share_id: "abc123" },
    });
    expect(Sentry.logger.error).toHaveBeenCalledWith(
      "revalidate shared poem: cache tag invalidation failed",
      { share_id: "abc123" },
    );
  });
});
