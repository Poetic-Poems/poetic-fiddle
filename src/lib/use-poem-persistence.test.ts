import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { usePoemPersistence } from "./use-poem-persistence";
import { EXAMPLE_POEM } from "@/lib/example-poem";
import { loadDraft } from "@/lib/draft-storage";
import {
  loadPoem,
  savePoem,
  sharePoem,
  unsharePoem,
  updateAllowRemix,
} from "@/lib/poems-store";
import { revalidateSharedPoem } from "@/lib/revalidate-share";
import { useSession } from "@/lib/use-session";

vi.mock("@/lib/poems-store", () => ({
  loadPoem: vi.fn(),
  savePoem: vi.fn(),
  sharePoem: vi.fn(),
  unsharePoem: vi.fn(),
  updateAllowRemix: vi.fn(),
}));

vi.mock("@/lib/revalidate-share", () => ({
  revalidateSharedPoem: vi.fn(),
}));

vi.mock("@/lib/use-session", () => ({
  useSession: vi.fn(),
}));

const SESSION = {
  user: { id: "user-1", email: "poet@example.com" },
} as Session;

function signedOut() {
  vi.mocked(useSession).mockReturnValue(null);
}

function signedIn() {
  vi.mocked(useSession).mockReturnValue(SESSION);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.mocked(revalidateSharedPoem).mockResolvedValue(undefined);
  signedOut();
});

// Safety net: a test that calls vi.useFakeTimers() and then throws before
// reaching its own vi.useRealTimers() would otherwise leak fake timers into
// every test that runs after it.
afterEach(() => {
  vi.useRealTimers();
});

describe("usePoemPersistence — initial source", () => {
  it("starts from the example poem when there's no draft or initial source", () => {
    const { result } = renderHook(() => usePoemPersistence({}));
    expect(result.current.source).toBe(EXAMPLE_POEM);
    expect(result.current.rendered.error).toBeNull();
  });

  it("starts from a stored anonymous draft when one exists", () => {
    window.localStorage.setItem("poetic-fiddle:draft:v1", "A stashed draft.");
    const { result } = renderHook(() => usePoemPersistence({}));
    expect(result.current.source).toBe("A stashed draft.");
  });

  it("starts empty and opening while a specific poem loads", () => {
    vi.mocked(loadPoem).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() =>
      usePoemPersistence({ initialPoemId: "poem-1" }),
    );
    expect(result.current.opening).toBe(true);
    expect(result.current.source).toBe("");
  });

  it("persists an initial remix source as the anonymous draft (AC21)", async () => {
    const remix =
      "={title}=Remix\n\nRemix\nA Poet\n2026-07-17\n\n{Verse}\nHi.\n";
    renderHook(() => usePoemPersistence({ initialSource: remix }));
    await waitFor(() => expect(loadDraft()).toBe(remix));
  });
});

describe("usePoemPersistence — opening a saved poem", () => {
  it("adopts the loaded poem's source, id, share id, and remix override", async () => {
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: "abc123",
      allowRemix: true,
    });
    signedIn();

    const { result } = renderHook(() =>
      usePoemPersistence({ initialPoemId: "poem-1" }),
    );

    await waitFor(() => expect(result.current.opening).toBe(false));
    expect(result.current.source).toBe(
      "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
    );
    expect(result.current.shareUrl).toContain("/share/abc123");
    expect(result.current.allowRemix).toBe(true);
    expect(result.current.saveStatus).toBe("Saved");
  });

  it("surfaces a load failure as openError", async () => {
    vi.mocked(loadPoem).mockRejectedValue(
      new Error("That poem couldn't be found."),
    );

    const { result } = renderHook(() =>
      usePoemPersistence({ initialPoemId: "not-mine" }),
    );

    await waitFor(() =>
      expect(result.current.openError).toBe("That poem couldn't be found."),
    );
    expect(result.current.opening).toBe(false);
  });
});

describe("usePoemPersistence — sign-in draft migration (AC9)", () => {
  it("adopts a leftover anonymous draft as the poem on first sign-in, then clears it", async () => {
    window.localStorage.setItem("poetic-fiddle:draft:v1", "A stashed draft.");
    const { result, rerender } = renderHook(
      ({ session }) => {
        vi.mocked(useSession).mockReturnValue(session);
        return usePoemPersistence({});
      },
      { initialProps: { session: null as Session | null } },
    );
    expect(result.current.source).toBe("A stashed draft.");

    rerender({ session: SESSION });

    await waitFor(() => expect(loadDraft()).toBeNull());
    expect(result.current.source).toBe("A stashed draft.");
  });

  it("forgets the previously saved poem identity when a different account signs in", async () => {
    // No `initialPoemId` here deliberately — the forget-on-account-switch guard
    // is intentionally skipped while a specific poem is (re)loading (see the
    // hook's own comment), so this scenario is exercised on the anonymous path.
    vi.mocked(savePoem).mockResolvedValue({
      id: "poem-1",
      title: "A Title",
      updatedAt: "2026-07-17T00:00:00Z",
      shareId: "abc123",
    });
    const { result, rerender } = renderHook(
      ({ session }) => {
        vi.mocked(useSession).mockReturnValue(session);
        return usePoemPersistence({});
      },
      { initialProps: { session: SESSION } },
    );
    await act(async () => result.current.handleSave());
    expect(result.current.saveStatus).toBe("Saved");

    const otherAccount = {
      user: { id: "user-2", email: "other@example.com" },
    } as Session;
    rerender({ session: otherAccount });

    await waitFor(() =>
      expect(result.current.saveStatus).toBe("Unsaved changes"),
    );
    // The source itself is untouched — only the saved-row identity is forgotten,
    // so the next Save inserts a poem of the new account's own.
    expect(result.current.source).toBe(EXAMPLE_POEM);
  });

  it("forgets the saved poem identity on sign-out", async () => {
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: "abc123",
      allowRemix: true,
    });
    const { result, rerender } = renderHook(
      ({ session }) => {
        vi.mocked(useSession).mockReturnValue(session);
        return usePoemPersistence({ initialPoemId: "poem-1" });
      },
      { initialProps: { session: SESSION as Session | null } },
    );
    await waitFor(() => expect(result.current.saveStatus).toBe("Saved"));

    rerender({ session: null });

    await waitFor(() => expect(result.current.shareUrl).toBeNull());
    expect(result.current.saveStatus).toBe("");
  });
});

describe("usePoemPersistence — editing", () => {
  it("updates source immediately, debouncing the draft persistence", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePoemPersistence({}));

    act(() => result.current.handleChange("New words."));

    // Reflected in state right away...
    expect(result.current.source).toBe("New words.");
    // ...but not yet written to storage — that write is debounced alongside
    // the render, not synchronous on every keystroke.
    expect(loadDraft()).not.toBe("New words.");

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(loadDraft()).toBe("New words.");
    vi.useRealTimers();
  });

  it("flushes a pending debounced draft on unmount", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => usePoemPersistence({}));

    act(() => result.current.handleChange("Unsaved edit."));
    expect(loadDraft()).not.toBe("Unsaved edit.");

    unmount();

    expect(loadDraft()).toBe("Unsaved edit.");
    vi.useRealTimers();
  });

  it("debounces the re-render and keeps the last good preview across a parse error", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePoemPersistence({}));
    const goodHtml = result.current.rendered.html;

    act(() => result.current.handleChange("not a valid poem at all"));
    // Not re-rendered yet — still showing the last good preview.
    expect(result.current.rendered.html).toBe(goodHtml);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.rendered.error).not.toBeNull();
    expect(result.current.rendered.html).toBe(goodHtml);
    vi.useRealTimers();
  });
});

describe("usePoemPersistence — save (AC10, AC13, AC14, AC94, AC95)", () => {
  it("prompts sign-in instead of saving when signed out", async () => {
    const { result } = renderHook(() => usePoemPersistence({}));

    await act(async () => result.current.handleSave());

    expect(savePoem).not.toHaveBeenCalled();
    expect(result.current.signInPromptAction).toBe("save");
  });

  it("saves and reports the poem saved", async () => {
    signedIn();
    vi.mocked(savePoem).mockResolvedValue({
      id: "poem-1",
      title: "A Title",
      updatedAt: "2026-07-16T00:00:00Z",
      shareId: null,
    });
    const { result } = renderHook(() => usePoemPersistence({}));
    expect(result.current.saveStatus).toBe("Unsaved changes");

    await act(async () => result.current.handleSave());

    expect(savePoem).toHaveBeenCalledWith(
      expect.objectContaining({ id: null, ownerId: "user-1" }),
    );
    expect(result.current.saveStatus).toBe("Saved");
  });

  it("surfaces a failed save without losing the poem", async () => {
    signedIn();
    vi.mocked(savePoem).mockRejectedValue(new Error("Couldn't save your poem"));
    const { result } = renderHook(() => usePoemPersistence({}));

    await act(async () => result.current.handleSave());

    expect(result.current.saveError).toBe("Couldn't save your poem");
    expect(result.current.saveStatus).toBe("Unsaved changes");
  });
});

describe("usePoemPersistence — share/unshare (AC17)", () => {
  it("prompts sign-in instead of sharing when signed out", async () => {
    const { result } = renderHook(() => usePoemPersistence({}));

    await act(async () => result.current.handleShare());

    expect(sharePoem).not.toHaveBeenCalled();
    expect(result.current.signInPromptAction).toBe("share");
  });

  it("saves an unsaved poem before minting a share link", async () => {
    signedIn();
    vi.mocked(savePoem).mockResolvedValue({
      id: "poem-1",
      title: "A Title",
      updatedAt: "2026-07-17T00:00:00Z",
      shareId: null,
    });
    vi.mocked(sharePoem).mockResolvedValue("abc123");
    const { result } = renderHook(() => usePoemPersistence({}));

    await act(async () => result.current.handleShare());

    expect(savePoem).toHaveBeenCalledWith(
      expect.objectContaining({ id: null, ownerId: "user-1" }),
    );
    expect(sharePoem).toHaveBeenCalledWith("poem-1");
    expect(result.current.shareUrl).toContain("/share/abc123");
    expect(revalidateSharedPoem).toHaveBeenCalledWith("abc123");
  });

  it("re-shares an unchanged, already-saved poem without saving again", async () => {
    signedIn();
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: null,
      allowRemix: null,
    });
    vi.mocked(sharePoem).mockResolvedValue("abc123");
    const { result } = renderHook(() =>
      usePoemPersistence({ initialPoemId: "poem-1" }),
    );
    await waitFor(() => expect(result.current.opening).toBe(false));

    await act(async () => result.current.handleShare());

    expect(sharePoem).toHaveBeenCalledWith("poem-1");
    expect(savePoem).not.toHaveBeenCalled();
  });

  it("unshares a poem and invalidates its cached render", async () => {
    signedIn();
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: "abc123",
      allowRemix: null,
    });
    vi.mocked(unsharePoem).mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePoemPersistence({ initialPoemId: "poem-1" }),
    );
    await waitFor(() => expect(result.current.shareUrl).toContain("abc123"));

    await act(async () => result.current.handleUnshare());

    expect(unsharePoem).toHaveBeenCalledWith("poem-1");
    expect(revalidateSharedPoem).toHaveBeenCalledWith("abc123");
    expect(result.current.shareUrl).toBeNull();
  });

  it("surfaces a failed share without losing the poem", async () => {
    signedIn();
    vi.mocked(savePoem).mockResolvedValue({
      id: "poem-1",
      title: "A Title",
      updatedAt: "2026-07-17T00:00:00Z",
      shareId: null,
    });
    vi.mocked(sharePoem).mockRejectedValue(
      new Error("Couldn't create a share link"),
    );
    const { result } = renderHook(() => usePoemPersistence({}));

    await act(async () => result.current.handleShare());

    expect(result.current.shareError).toBe("Couldn't create a share link");
  });
});

describe("usePoemPersistence — copy share link (#67)", () => {
  it("shows temporary feedback after a successful copy, then resets", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    signedIn();
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: "abc123",
      allowRemix: null,
    });
    const { result } = renderHook(() =>
      usePoemPersistence({ initialPoemId: "poem-1" }),
    );
    await waitFor(() => expect(result.current.shareUrl).toContain("abc123"));

    await act(async () => result.current.handleCopyShareLink());
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("/share/abc123"),
    );
    expect(result.current.linkCopied).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.linkCopied).toBe(false);

    vi.useRealTimers();
  });

  it("surfaces a failed copy without losing the share link", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValue(new Error("Couldn't access the clipboard"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    signedIn();
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: "abc123",
      allowRemix: null,
    });
    const { result } = renderHook(() =>
      usePoemPersistence({ initialPoemId: "poem-1" }),
    );
    await waitFor(() => expect(result.current.shareUrl).toContain("abc123"));

    await act(async () => result.current.handleCopyShareLink());

    expect(result.current.shareError).toBe("Couldn't access the clipboard");
    expect(result.current.shareUrl).toContain("abc123");
  });
});

describe("usePoemPersistence — per-poem remix override (AC114)", () => {
  it("prompts sign-in when changing the override while signed out", async () => {
    const { result } = renderHook(() => usePoemPersistence({}));

    await act(async () => result.current.handleAllowRemixChange(true));

    expect(updateAllowRemix).not.toHaveBeenCalled();
    expect(result.current.signInPromptAction).toBe("save");
  });

  it("saves an override on an already-saved poem without saving again", async () => {
    signedIn();
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: null,
      allowRemix: null,
    });
    vi.mocked(updateAllowRemix).mockResolvedValue(false);
    const { result } = renderHook(() =>
      usePoemPersistence({ initialPoemId: "poem-1" }),
    );
    await waitFor(() => expect(result.current.opening).toBe(false));

    await act(async () => result.current.handleAllowRemixChange(false));

    expect(updateAllowRemix).toHaveBeenCalledWith("poem-1", false);
    expect(savePoem).not.toHaveBeenCalled();
    expect(result.current.allowRemix).toBe(false);
  });

  it("saves the poem first when setting an override before the first save", async () => {
    signedIn();
    vi.mocked(savePoem).mockResolvedValue({
      id: "new-poem",
      title: "A Title",
      updatedAt: "2026-07-17T00:00:00Z",
      shareId: null,
    });
    vi.mocked(updateAllowRemix).mockResolvedValue(true);
    const { result } = renderHook(() => usePoemPersistence({}));

    await act(async () => result.current.handleAllowRemixChange(true));

    expect(savePoem).toHaveBeenCalledWith(
      expect.objectContaining({ id: null, ownerId: "user-1" }),
    );
    expect(updateAllowRemix).toHaveBeenCalledWith("new-poem", true);
    expect(result.current.allowRemix).toBe(true);
  });

  it("surfaces a failed override save without losing the current setting", async () => {
    signedIn();
    vi.mocked(loadPoem).mockResolvedValue({
      id: "poem-1",
      source: "A Title\nA Poet\n2026-07-17\n\n{Verse}\nHello.\n",
      shareId: null,
      allowRemix: null,
    });
    vi.mocked(updateAllowRemix).mockRejectedValue(
      new Error("Couldn't update remixing for this poem — please try again."),
    );
    const { result } = renderHook(() =>
      usePoemPersistence({ initialPoemId: "poem-1" }),
    );
    await waitFor(() => expect(result.current.opening).toBe(false));

    await act(async () => result.current.handleAllowRemixChange(true));

    expect(result.current.allowRemixError).toBe(
      "Couldn't update remixing for this poem — please try again.",
    );
    expect(result.current.allowRemix).toBeNull();
  });
});

describe("usePoemPersistence — sign-in prompt dismissal", () => {
  it("clears the sign-in prompt action", async () => {
    const { result } = renderHook(() => usePoemPersistence({}));
    await act(async () => result.current.handleSave());
    expect(result.current.signInPromptAction).toBe("save");

    act(() => result.current.dismissSignInPrompt());

    expect(result.current.signInPromptAction).toBeNull();
  });
});
