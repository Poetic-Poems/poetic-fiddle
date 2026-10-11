const DRAFT_STORAGE_KEY = "poetic-fiddle:draft:v1";

interface DegradingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getStorage(): DegradingStorage | null {
  let storage: Storage;
  try {
    if (typeof window === "undefined") return null;
    storage = window.localStorage;
  } catch {
    // Storage can throw (private browsing, disabled cookies/storage) — the
    // caller falls back to an in-memory-only draft (AC98 graceful degradation).
    return null;
  }
  return {
    getItem(key) {
      try {
        return storage.getItem(key);
      } catch {
        // A method can also throw after the accessor above succeeded (e.g.
        // zero-quota / locked-down environments) — degrade the same way.
        return null;
      }
    },
    setItem(key, value) {
      try {
        storage.setItem(key, value);
      } catch {
        // Quota exceeded or storage unavailable — the draft simply isn't persisted.
      }
    },
    removeItem(key) {
      try {
        storage.removeItem(key);
      } catch {
        // Storage unavailable — clearing becomes a no-op.
      }
    },
  };
}

export function loadDraft(): string | null {
  return getStorage()?.getItem(DRAFT_STORAGE_KEY) ?? null;
}

export function saveDraft(source: string): void {
  getStorage()?.setItem(DRAFT_STORAGE_KEY, source);
}

/**
 * Clears the stored anonymous draft. M4's sign-in handler calls `loadDraft()`
 * to adopt the draft into the newly authenticated session, then this once
 * the draft has been saved to the account (AC9's migration hook).
 */
export function clearDraft(): void {
  getStorage()?.removeItem(DRAFT_STORAGE_KEY);
}
