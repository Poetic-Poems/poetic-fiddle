import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "./draft-storage";

describe("draft-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("degrades to no draft, without throwing, when localStorage itself is unreachable (AC98)", () => {
    // Private browsing / disabled storage can make the `localStorage`
    // accessor itself throw, rather than any individual method.
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    try {
      expect(loadDraft()).toBeNull();
      expect(() => saveDraft("a draft")).not.toThrow();
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });

  it("doesn't throw when persisting a draft fails (e.g. quota exceeded) (AC98)", () => {
    const setItem = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded.", "QuotaExceededError");
      });
    try {
      expect(() => saveDraft("a draft")).not.toThrow();
    } finally {
      setItem.mockRestore();
    }
  });

  it("returns null when no draft has been saved", () => {
    expect(loadDraft()).toBeNull();
  });

  it("round-trips a saved draft", () => {
    saveDraft("={title}=A Poem\n\n{Verse 1}\nSome words.\n");
    expect(loadDraft()).toBe("={title}=A Poem\n\n{Verse 1}\nSome words.\n");
  });

  it("overwrites a previously saved draft", () => {
    saveDraft("first draft");
    saveDraft("second draft");
    expect(loadDraft()).toBe("second draft");
  });

  it("removes the draft on clear", () => {
    saveDraft("a draft");
    clearDraft();
    expect(loadDraft()).toBeNull();
  });
});
