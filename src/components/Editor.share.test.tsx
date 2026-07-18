import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import Editor from "./Editor";
import { loadPoem, savePoem, sharePoem, unsharePoem } from "@/lib/poems-store";
import { revalidateSharedPoem } from "@/lib/revalidate-share";
import { useSession } from "@/lib/use-session";

vi.mock("@/lib/poems-store", () => ({
  loadPoem: vi.fn(),
  savePoem: vi.fn(),
  sharePoem: vi.fn(),
  unsharePoem: vi.fn(),
}));

vi.mock("@/lib/revalidate-share", () => ({
  revalidateSharedPoem: vi.fn(),
}));

vi.mock("@/lib/use-session", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/supabase-client", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

const SESSION = {
  user: { id: "user-1", email: "poet@example.com" },
} as Session;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.mocked(revalidateSharedPoem).mockResolvedValue(undefined);
});

describe("Editor share", () => {
  it("prompts an anonymous poet to sign in instead of sharing (AC10 pattern)", () => {
    vi.mocked(useSession).mockReturnValue(null);
    render(<Editor poeticCss="" />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(sharePoem).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("saves an unsaved poem first, then shares it, and shows the link (AC17)", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(savePoem).mockResolvedValue({
      id: "poem-1",
      title: "A Title",
      updatedAt: "2026-07-17T00:00:00Z",
      shareId: null,
    });
    vi.mocked(sharePoem).mockResolvedValue("abc123");
    render(<Editor poeticCss="" />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(sharePoem).toHaveBeenCalledWith("poem-1"));
    expect(savePoem).toHaveBeenCalledWith(
      expect.objectContaining({ id: null, ownerId: "user-1" }),
    );
    const link = await screen.findByRole("link", { name: /\/share\/abc123/ });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/share/abc123"),
    );
    expect(revalidateSharedPoem).toHaveBeenCalledWith("abc123");
  });

  it("re-shares an already-saved, unchanged poem without saving again", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: null,
      allowRemix: null,
    });
    vi.mocked(sharePoem).mockResolvedValue("abc123");
    render(<Editor poeticCss="" initialPoemId="poem-1" />);

    await screen.findByText("Hello.");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(sharePoem).toHaveBeenCalledWith("poem-1"));
    expect(savePoem).not.toHaveBeenCalled();
  });

  it("shows an already-minted share link when opening a shared poem", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: "abc123",
      allowRemix: null,
    });
    render(<Editor poeticCss="" initialPoemId="poem-1" />);

    const link = await screen.findByRole("link", { name: /\/share\/abc123/ });
    expect(link).toBeInTheDocument();
  });

  it("surfaces a failed share without losing the poem", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(savePoem).mockResolvedValue({
      id: "poem-1",
      title: "A Title",
      updatedAt: "2026-07-17T00:00:00Z",
      shareId: null,
    });
    vi.mocked(sharePoem).mockRejectedValue(
      new Error("Couldn't create a share link"),
    );
    render(<Editor poeticCss="" />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Couldn't create a share link",
      ),
    );
  });

  it("has no Unshare control until a poem is shared", () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    render(<Editor poeticCss="" />);

    expect(
      screen.queryByRole("button", { name: "Unshare" }),
    ).not.toBeInTheDocument();
  });

  it("unshares a poem, hides the link, and invalidates its cached render", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: "abc123",
      allowRemix: null,
    });
    vi.mocked(unsharePoem).mockResolvedValue(undefined);
    render(<Editor poeticCss="" initialPoemId="poem-1" />);

    await screen.findByRole("link", { name: /\/share\/abc123/ });
    fireEvent.click(screen.getByRole("button", { name: "Unshare" }));

    await waitFor(() => expect(unsharePoem).toHaveBeenCalledWith("poem-1"));
    expect(revalidateSharedPoem).toHaveBeenCalledWith("abc123");
    expect(
      screen.queryByRole("link", { name: /\/share\/abc123/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unshare" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces a failed unshare without losing the share link", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: "abc123",
      allowRemix: null,
    });
    vi.mocked(unsharePoem).mockRejectedValue(
      new Error("Couldn't remove the share link"),
    );
    render(<Editor poeticCss="" initialPoemId="poem-1" />);

    await screen.findByRole("link", { name: /\/share\/abc123/ });
    fireEvent.click(screen.getByRole("button", { name: "Unshare" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Couldn't remove the share link",
      ),
    );
    expect(
      screen.getByRole("link", { name: /\/share\/abc123/ }),
    ).toBeInTheDocument();
  });
});
