import { vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

export function makeSession(email = "poet@example.com"): Session {
  return { user: { id: "user-1", email } } as Session;
}

export function resetEditorTestState() {
  vi.clearAllMocks();
  window.localStorage.clear();
}
