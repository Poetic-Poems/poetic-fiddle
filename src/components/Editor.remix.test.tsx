import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import Editor from "./Editor";
import { savePoem } from "@/lib/poems-store";
import { loadDraft } from "@/lib/draft-storage";
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
  user: { id: "user-1", email: "remixer@example.com" },
} as Session;

const REMIX_SOURCE =
  "={title}=Ode to a Fiddle\n\nOde to a Fiddle\nA Poet\n2026-07-17\n\n{Verse 1}\nBorrowed line.\n";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("Editor opening a remix", () => {
  it("holds an anonymous remix as the localStorage draft (AC21)", async () => {
    vi.mocked(useSession).mockReturnValue(null);

    render(<Editor poeticCss="" initialSource={REMIX_SOURCE} />);

    expect(await screen.findByText("Borrowed line.")).toBeInTheDocument();
    // Persisted like any other anonymous draft, so a reload — or signing in
    // later — doesn't lose the remix (AC7–AC10).
    await waitFor(() => expect(loadDraft()).toBe(REMIX_SOURCE));
  });

  it("saves a remix as a new poem of the signed-in poet's own (AC20)", async () => {
    vi.mocked(useSession).mockReturnValue(SESSION);
    vi.mocked(savePoem).mockResolvedValue({
      id: "new-poem",
      title: "Ode to a Fiddle",
      updatedAt: "2026-07-17T00:00:00Z",
      shareId: null,
    });

    render(<Editor poeticCss="" initialSource={REMIX_SOURCE} />);

    screen.getByRole("button", { name: "Save" }).click();

    // `id: null` is what makes the copy independent: an insert owned by the
    // remixer, not an update of the poem they remixed (which RLS would refuse
    // anyway).
    await waitFor(() =>
      expect(savePoem).toHaveBeenCalledWith({
        id: null,
        ownerId: "user-1",
        source: REMIX_SOURCE,
      }),
    );
  });

  it("keeps the remix when a leftover draft exists and the poet signs in", async () => {
    window.localStorage.setItem("poetic-fiddle:draft:v1", "A stale draft.");
    vi.mocked(useSession).mockReturnValue(SESSION);

    render(<Editor poeticCss="" initialSource={REMIX_SOURCE} />);

    // The URL names the poem to open, so the sign-in draft migration must not
    // reach back and overwrite it with what was in storage beforehand.
    expect(await screen.findByText("Borrowed line.")).toBeInTheDocument();
    expect(screen.queryByText("A stale draft.")).not.toBeInTheDocument();
  });
});
