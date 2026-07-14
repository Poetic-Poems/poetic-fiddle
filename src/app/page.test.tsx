import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";
import { loadDraft, saveDraft } from "@/lib/draft-storage";

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase-client", () => ({
  supabase: { auth: authMock },
}));

describe("Home", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("renders the editor heading and a syntax reference link", async () => {
    render(<Home />);
    expect(
      await screen.findByRole("heading", { name: /write your poem/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /syntax reference/i }),
    ).toBeInTheDocument();
  });

  it("shows no sign-in prompt while editing (AC7)", async () => {
    render(<Home />);
    await screen.findByRole("link", { name: /syntax reference/i });
    expect(screen.queryByText(/sign in to/i)).not.toBeInTheDocument();
  });

  it("restores a stored anonymous draft on load (AC8)", async () => {
    saveDraft("not a valid poem at all");
    render(<Home />);
    expect(
      await screen.findByText(/couldn't parse the poem yet/i),
    ).toBeInTheDocument();
  });

  it("prompts to sign in only when Save or Share is attempted (AC10)", async () => {
    render(<Home />);
    await screen.findByRole("link", { name: /syntax reference/i });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/^sign in to save$/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByText(/^sign in to save$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(await screen.findByText(/^sign in to share$/i)).toBeInTheDocument();
  });

  it("adopts the anonymous draft on first sign-in and clears it from localStorage (AC9)", async () => {
    saveDraft("={title}=My Draft\n\n{Verse 1}\nHello, poet.\n");
    render(<Home />);
    await screen.findByRole("link", { name: /syntax reference/i });

    const onAuthStateChange = authMock.onAuthStateChange.mock.calls[0][0];
    act(() => {
      onAuthStateChange("SIGNED_IN", { user: { email: "poet@example.com" } });
    });

    expect(await screen.findByText("poet@example.com")).toBeInTheDocument();
    expect(loadDraft()).toBeNull();
  });

  it("no longer prompts to sign in once signed in (AC9)", async () => {
    render(<Home />);
    await screen.findByRole("link", { name: /syntax reference/i });

    const onAuthStateChange = authMock.onAuthStateChange.mock.calls[0][0];
    act(() => {
      onAuthStateChange("SIGNED_IN", { user: { email: "poet@example.com" } });
    });
    await screen.findByText("poet@example.com");

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.queryByText(/^sign in to save$/i)).not.toBeInTheDocument();
  });
});
