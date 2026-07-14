import { beforeEach, describe, expect, it } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "./draft-storage";

describe("draft-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
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
