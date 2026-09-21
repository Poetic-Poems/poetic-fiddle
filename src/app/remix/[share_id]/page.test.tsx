import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RemixPage from "./page";
import { getCachedSharedPoem } from "@/lib/shared-poem-cache";

vi.mock("@/lib/shared-poem-cache", () => ({
  getCachedSharedPoem: vi.fn(),
}));

vi.mock("@/components/EditorClient", () => ({
  EditorClient: ({ initialSource }: { initialSource?: string }) => (
    <div data-testid="editor">{initialSource}</div>
  ),
}));

const POEM = {
  title: "A Shared Poem",
  source: "={title}=A Shared Poem\n\nA Shared Poem\nA Poet\n2026-07-17\n",
  allowRemix: true,
  updatedAt: "2026-07-17T00:00:00Z",
};

describe("RemixPage", () => {
  it("opens the shared poem's source in the editor as an unowned copy (AC20)", async () => {
    vi.mocked(getCachedSharedPoem).mockResolvedValue({
      kind: "found",
      poem: POEM,
    });

    render(
      await RemixPage({ params: Promise.resolve({ share_id: "abc123" }) }),
    );

    expect(screen.getByTestId("editor")).toHaveTextContent("A Shared Poem");
  });

  it("calls notFound() when the owner hasn't enabled remixing (AC113)", async () => {
    vi.mocked(getCachedSharedPoem).mockResolvedValue({
      kind: "found",
      poem: { ...POEM, allowRemix: false },
    });

    // The route enforces the permission itself: hiding the share page's link
    // is presentation, not protection — a typed/guessed URL must fail too.
    await expect(
      RemixPage({ params: Promise.resolve({ share_id: "abc123" }) }),
    ).rejects.toThrow();
  });

  it("calls notFound() for a share id that doesn't resolve (AC87)", async () => {
    vi.mocked(getCachedSharedPoem).mockResolvedValue({ kind: "not-found" });

    await expect(
      RemixPage({ params: Promise.resolve({ share_id: "no-such-id" }) }),
    ).rejects.toThrow();
  });

  it("shows an unavailable message, not a 404, when the backend is down (issue #422)", async () => {
    vi.mocked(getCachedSharedPoem).mockResolvedValue({ kind: "unavailable" });

    render(
      await RemixPage({ params: Promise.resolve({ share_id: "abc123" }) }),
    );

    expect(
      screen.getByRole("heading", { name: /unavailable right now/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
  });
});
