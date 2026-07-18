import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import Editor from "./Editor";
import { loadPoem, savePoem, updateAllowRemix } from "@/lib/poems-store";
import { useSession } from "@/lib/use-session";

vi.mock("@/lib/poems-store", () => ({
  loadPoem: vi.fn(),
  savePoem: vi.fn(),
  updateAllowRemix: vi.fn(),
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
});

describe("Editor per-poem remix override (AC114)", () => {
  it("has no remix control for a signed-out visitor", () => {
    vi.mocked(useSession).mockReturnValue(null);
    render(<Editor poeticCss="" />);

    expect(
      screen.queryByLabelText(/remixing this poem/i),
    ).not.toBeInTheDocument();
  });

  it("defaults an unsaved poem's remix control to inherit the poet's default", () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    render(<Editor poeticCss="" />);

    const select = screen.getByLabelText(/remixing this poem/i);
    expect(select).toHaveValue("default");
  });

  it("shows an already-set per-poem override when opening a saved poem", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: null,
      allowRemix: true,
    });
    render(<Editor poeticCss="" initialPoemId="poem-1" />);

    await screen.findByText("Hello.");
    expect(screen.getByLabelText(/remixing this poem/i)).toHaveValue("allow");
  });

  it("saves an override on an already-saved poem without saving again", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: null,
      allowRemix: null,
    });
    vi.mocked(updateAllowRemix).mockResolvedValue(false);
    render(<Editor poeticCss="" initialPoemId="poem-1" />);

    await screen.findByText("Hello.");
    const select = screen.getByLabelText(/remixing this poem/i);
    fireEvent.change(select, { target: { value: "deny" } });

    await waitFor(() =>
      expect(updateAllowRemix).toHaveBeenCalledWith("poem-1", false),
    );
    expect(savePoem).not.toHaveBeenCalled();
    await waitFor(() => expect(select).toHaveValue("deny"));
  });

  it("saves the poem first when setting an override before the first save", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(savePoem).mockResolvedValue({
      id: "new-poem",
      title: "A Title",
      updatedAt: "2026-07-17T00:00:00Z",
      shareId: null,
    });
    vi.mocked(updateAllowRemix).mockResolvedValue(true);
    render(<Editor poeticCss="" />);

    const select = screen.getByLabelText(/remixing this poem/i);
    fireEvent.change(select, { target: { value: "allow" } });

    await waitFor(() =>
      expect(savePoem).toHaveBeenCalledWith(
        expect.objectContaining({ id: null, ownerId: "user-1" }),
      ),
    );
    await waitFor(() =>
      expect(updateAllowRemix).toHaveBeenCalledWith("new-poem", true),
    );
  });

  it("surfaces a failed override save without losing the current setting", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: null,
      allowRemix: null,
    });
    vi.mocked(updateAllowRemix).mockRejectedValue(
      new Error("Couldn't update remixing for this poem — please try again."),
    );
    render(<Editor poeticCss="" initialPoemId="poem-1" />);

    await screen.findByText("Hello.");
    const select = screen.getByLabelText(/remixing this poem/i);
    fireEvent.change(select, { target: { value: "allow" } });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Couldn't update remixing for this poem — please try again.",
      ),
    );
    expect(select).toHaveValue("default");
  });
});
