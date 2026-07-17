import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SharePage, { generateMetadata } from "./page";
import { getCachedSharedPoem } from "@/lib/shared-poem-cache";
import { renderSharedPoemHtml } from "@/lib/render-share";

vi.mock("@/lib/shared-poem-cache", () => ({
  getCachedSharedPoem: vi.fn(),
}));

vi.mock("@/lib/render-share", () => ({
  renderSharedPoemHtml: vi.fn(),
}));

vi.mock("@/components/SharedPoemView", () => ({
  SharedPoemView: ({ title }: { title: string }) => (
    <div data-testid="shared-poem-view">{title}</div>
  ),
}));

const POEM = {
  title: "A Shared Poem",
  source: "irrelevant — renderSharedPoemHtml is mocked",
  allowRemix: false,
  updatedAt: "2026-07-17T00:00:00Z",
};

describe("SharePage", () => {
  it("renders the poem via SharedPoemView when found (AC17, AC18)", async () => {
    vi.mocked(getCachedSharedPoem).mockResolvedValue(POEM);
    vi.mocked(renderSharedPoemHtml).mockReturnValue({
      html: "<p>Hi</p>",
      error: false,
    });

    const element = await SharePage({
      params: Promise.resolve({ share_id: "abc123" }),
    });
    render(element);

    expect(screen.getByTestId("shared-poem-view")).toHaveTextContent(
      "A Shared Poem",
    );
  });

  it("calls notFound() for a share id that doesn't resolve (AC87)", async () => {
    vi.mocked(getCachedSharedPoem).mockResolvedValue(null);

    await expect(
      SharePage({ params: Promise.resolve({ share_id: "no-such-id" }) }),
    ).rejects.toThrow();
  });

  it("offers no Remix action by default (AC113)", async () => {
    vi.mocked(getCachedSharedPoem).mockResolvedValue(POEM);
    vi.mocked(renderSharedPoemHtml).mockReturnValue({
      html: "<p>Hi</p>",
      error: false,
    });

    render(
      await SharePage({ params: Promise.resolve({ share_id: "abc123" }) }),
    );

    expect(
      screen.queryByRole("link", { name: "Remix" }),
    ).not.toBeInTheDocument();
  });

  it("offers Remix when the owner has enabled it (AC20, AC113)", async () => {
    vi.mocked(getCachedSharedPoem).mockResolvedValue({
      ...POEM,
      allowRemix: true,
    });
    vi.mocked(renderSharedPoemHtml).mockReturnValue({
      html: "<p>Hi</p>",
      error: false,
    });

    render(
      await SharePage({ params: Promise.resolve({ share_id: "abc123" }) }),
    );

    // A plain link, so Remix is reachable with no client-side JS (AC84).
    expect(screen.getByRole("link", { name: "Remix" })).toHaveAttribute(
      "href",
      "/remix/abc123",
    );
  });

  it("shows a friendly message instead of crashing when the poem can't be rendered", async () => {
    vi.mocked(getCachedSharedPoem).mockResolvedValue(POEM);
    vi.mocked(renderSharedPoemHtml).mockReturnValue({ html: "", error: true });

    const element = await SharePage({
      params: Promise.resolve({ share_id: "abc123" }),
    });
    render(element);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /couldn.t be displayed/i,
    );
  });
});

describe("generateMetadata", () => {
  it("uses the poem's title for <title> and Open Graph (AC18)", async () => {
    vi.mocked(getCachedSharedPoem).mockResolvedValue(POEM);

    const metadata = await generateMetadata({
      params: Promise.resolve({ share_id: "abc123" }),
    });

    expect(metadata.title).toBe("A Shared Poem");
    expect(metadata.openGraph?.title).toBe("A Shared Poem");
  });

  it("falls back to a generic title when the poem isn't found", async () => {
    vi.mocked(getCachedSharedPoem).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ share_id: "no-such-id" }),
    });

    expect(metadata.title).toBe("Poem not found");
  });
});
