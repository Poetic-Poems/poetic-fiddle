import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { PoemsDashboard } from "./PoemsDashboard";
import { listPoems } from "@/lib/poems-store";
import { useSession } from "@/lib/use-session";

vi.mock("@/lib/poems-store", () => ({
  listPoems: vi.fn(),
}));

vi.mock("@/lib/use-session", () => ({
  useSession: vi.fn(),
}));

const SESSION = {
  user: { id: "user-1", email: "poet@example.com" },
} as Session;

describe("PoemsDashboard", () => {
  it("asks a signed-out visitor to sign in, without listing anything", () => {
    vi.mocked(useSession).mockReturnValue(null);

    render(<PoemsDashboard />);

    expect(
      screen.getByText(/sign in to see your saved poems/i),
    ).toBeInTheDocument();
    expect(listPoems).not.toHaveBeenCalled();
  });

  it("shows an empty state that links back to the editor (AC22)", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(listPoems).mockResolvedValue([]);

    render(<PoemsDashboard />);

    expect(
      await screen.findByText(/haven.t saved a poem yet/i),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /start writing/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("lists saved poems, each linking to its own editor URL (AC15, AC22)", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(listPoems).mockResolvedValue([
      {
        id: "poem-1",
        title: "Ode to a Fiddle",
        updatedAt: "2026-07-16T00:00:00Z",
      },
      { id: "poem-2", title: "", updatedAt: "2026-07-15T00:00:00Z" },
    ]);

    render(<PoemsDashboard />);

    const odeLink = await screen.findByRole("link", {
      name: /ode to a fiddle/i,
    });
    expect(odeLink).toHaveAttribute("href", "/poems/poem-1");

    const untitledLink = screen.getByRole("link", { name: /untitled/i });
    expect(untitledLink).toHaveAttribute("href", "/poems/poem-2");
    expect(listPoems).toHaveBeenCalledWith("user-1");
  });

  it("surfaces an error without crashing when the list fails to load", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(listPoems).mockRejectedValue(
      new Error("Couldn't load your poems — please try again."),
    );

    render(<PoemsDashboard />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Couldn't load your poems — please try again.",
      ),
    );
  });
});
