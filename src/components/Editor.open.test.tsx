import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import Editor from "./Editor";
import { loadPoem, savePoem } from "@/lib/poems-store";
import { useSession } from "@/lib/use-session";

vi.mock("@/lib/poems-store", () => ({
  loadPoem: vi.fn(),
  savePoem: vi.fn(),
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

describe("Editor opening a saved poem", () => {
  it("restores the poem's source and keeps its id across a reload (AC15)", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source:
        "={title}=Ode to a Fiddle\n\nOde to a Fiddle\nA Poet\n2026-07-16\n\n{Verse 1}\nHello.\n",
    });

    render(<Editor poeticCss="" initialPoemId="poem-1" />);

    expect(screen.getByRole("status")).toHaveTextContent("Opening your poem…");
    expect(await screen.findByText("Hello.")).toBeInTheDocument();
    expect(loadPoem).toHaveBeenCalledWith("poem-1");

    // Reflects as saved, not as a fresh unsaved poem, and later saves update
    // the same row rather than inserting a new one — the id round-tripped.
    expect(
      screen.getByRole("status", { name: "Save status" }),
    ).toHaveTextContent("Saved");

    vi.mocked(savePoem).mockResolvedValue({
      id: "poem-1",
      title: "Ode to a Fiddle",
      updatedAt: "2026-07-17T00:00:00Z",
    });
    screen.getByRole("button", { name: "Save" }).click();
    await waitFor(() =>
      expect(savePoem).toHaveBeenCalledWith(
        expect.objectContaining({ id: "poem-1" }),
      ),
    );
  });

  it("shows a way back to the dashboard when the poem can't be opened (RLS/not found)", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(loadPoem).mockRejectedValue(
      new Error(
        "That poem couldn't be found — it may have been deleted, or belongs to someone else.",
      ),
    );

    render(<Editor poeticCss="" initialPoemId="not-mine" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't be found/i,
    );
    const backLink = screen.getByRole("link", { name: /back to my poems/i });
    expect(backLink).toHaveAttribute("href", "/poems");
  });
});
