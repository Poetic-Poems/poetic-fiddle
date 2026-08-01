import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { useSession } from "./use-session";

const getSession = vi.fn();
const onAuthStateChange = vi.fn();
const unsubscribe = vi.fn();

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChange(...args),
    },
  },
}));

function fakeSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "user-1" } as Session["user"],
    ...overrides,
  } as Session;
}

beforeEach(() => {
  getSession.mockReset();
  onAuthStateChange.mockReset();
  unsubscribe.mockReset();
  getSession.mockResolvedValue({ data: { session: null } });
  onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe } },
  });
});

describe("useSession", () => {
  it("starts with a null session and loading=true while getSession is still pending", () => {
    getSession.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSession());
    expect(result.current.session).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("adopts the session getSession resolves with, and clears loading", async () => {
    const session = fakeSession();
    getSession.mockResolvedValue({ data: { session } });

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.session).toEqual(session));
    expect(result.current.loading).toBe(false);
  });

  it("updates the session when the auth-state-change listener fires", async () => {
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(onAuthStateChange).toHaveBeenCalledTimes(1));

    const session = fakeSession({ access_token: "new-token" });
    const onChange = onAuthStateChange.mock.calls[0][0];
    act(() => {
      onChange("SIGNED_IN", session);
    });

    expect(result.current.session).toEqual(session);
  });

  it("clears the session when the listener reports a sign-out", async () => {
    const session = fakeSession();
    getSession.mockResolvedValue({ data: { session } });
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.session).toEqual(session));

    const onChange = onAuthStateChange.mock.calls[0][0];
    act(() => {
      onChange("SIGNED_OUT", null);
    });

    expect(result.current.session).toBeNull();
  });

  it("unsubscribes from the auth listener on unmount", async () => {
    const { unmount } = renderHook(() => useSession());
    await waitFor(() => expect(onAuthStateChange).toHaveBeenCalledTimes(1));

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
