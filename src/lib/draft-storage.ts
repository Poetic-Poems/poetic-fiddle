const DRAFT_STORAGE_KEY = "poetic-fiddle:draft:v1";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Storage can throw (private browsing, disabled cookies/storage) — the
    // caller falls back to an in-memory-only draft (AC98 graceful degradation).
    return null;
  }
}

export function loadDraft(): string | null {
  return getStorage()?.getItem(DRAFT_STORAGE_KEY) ?? null;
}

export function saveDraft(source: string): void {
  try {
    getStorage()?.setItem(DRAFT_STORAGE_KEY, source);
  } catch {
    // Quota exceeded or storage unavailable — the draft simply isn't persisted.
  }
}

/**
 * Clears the stored anonymous draft. M4's sign-in handler calls `loadDraft()`
 * to adopt the draft into the newly authenticated session, then this once
 * the draft has been saved to the account (AC9's migration hook).
 */
export function clearDraft(): void {
  getStorage()?.removeItem(DRAFT_STORAGE_KEY);
}
