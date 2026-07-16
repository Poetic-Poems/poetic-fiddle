import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import Editor from "./Editor";
import { savePoem } from "@/lib/poems-store";
import { useSession } from "@/lib/use-session";

vi.mock("@/lib/poems-store", () => ({
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

function signedIn() {
  vi.mocked(useSession).mockReturnValue(SESSION);
}

function signedOut() {
  vi.mocked(useSession).mockReturnValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("Editor save", () => {
  it("prompts an anonymous poet to sign in instead of saving (AC10)", async () => {
    signedOut();
    render(<Editor poeticCss="" />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(savePoem).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // No save indicator while signed out — the draft autosaves regardless.
    expect(
      screen.getByRole("status", { name: "Save status" }),
    ).toHaveTextContent("");
  });

  it("saves the poem and reports it saved (AC13, AC14)", async () => {
    signedIn();
    vi.mocked(savePoem).mockResolvedValue({
      id: "poem-1",
      title: "A Title",
      updatedAt: "2026-07-16T00:00:00Z",
      shareId: null,
    });
    render(<Editor poeticCss="" />);

    expect(
      screen.getByRole("status", { name: "Save status" }),
    ).toHaveTextContent("Unsaved changes");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Save status" }),
      ).toHaveTextContent("Saved"),
    );
    expect(savePoem).toHaveBeenCalledWith(
      expect.objectContaining({ id: null, ownerId: "user-1" }),
    );
  });

  it("surfaces a failed save without losing the poem (AC94, AC95)", async () => {
    signedIn();
    vi.mocked(savePoem).mockRejectedValue(new Error("Couldn't save your poem"));
    render(<Editor poeticCss="" />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Couldn't save your poem",
      ),
    );
    // Still unsaved, and the source is untouched.
    expect(
      screen.getByRole("status", { name: "Save status" }),
    ).toHaveTextContent("Unsaved changes");
  });
});
