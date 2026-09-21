import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { probeBackendHealth } from "./backend-health";
import { resetBackendHealthForTest, useBackendHealth } from "./use-backend-health";

vi.mock("./backend-health", async () => {
  const actual =
    await vi.importActual<typeof import("./backend-health")>(
      "./backend-health",
    );
  return { ...actual, probeBackendHealth: vi.fn() };
});

beforeEach(() => {
  resetBackendHealthForTest();
  vi.mocked(probeBackendHealth).mockReset();
});

describe("useBackendHealth", () => {
  it("starts 'checking' and settles to the probe's result", async () => {
    vi.mocked(probeBackendHealth).mockResolvedValue("available");

    const { result } = renderHook(() => useBackendHealth());
    expect(result.current.status).toBe("checking");

    await waitFor(() => expect(result.current.status).toBe("available"));
  });

  it("settles to 'unavailable' when the probe resolves that way", async () => {
    vi.mocked(probeBackendHealth).mockResolvedValue("unavailable");

    const { result } = renderHook(() => useBackendHealth());

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });

  it("memoises the result across separate hook mounts, probing only once", async () => {
    vi.mocked(probeBackendHealth).mockResolvedValue("available");

    const first = renderHook(() => useBackendHealth());
    await waitFor(() => expect(first.result.current.status).toBe("available"));

    const second = renderHook(() => useBackendHealth());
    expect(second.result.current.status).toBe("available");
    expect(probeBackendHealth).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight probe across concurrent mounts", async () => {
    let resolveProbe!: (status: "available" | "unavailable") => void;
    vi.mocked(probeBackendHealth).mockReturnValue(
      new Promise((resolve) => {
        resolveProbe = resolve;
      }),
    );

    const a = renderHook(() => useBackendHealth());
    const b = renderHook(() => useBackendHealth());
    expect(a.result.current.status).toBe("checking");
    expect(b.result.current.status).toBe("checking");

    act(() => resolveProbe("available"));
    await waitFor(() => expect(a.result.current.status).toBe("available"));
    expect(b.result.current.status).toBe("available");
    expect(probeBackendHealth).toHaveBeenCalledTimes(1);
  });

  it("re-probes on retry(), going through 'checking' again", async () => {
    vi.mocked(probeBackendHealth).mockResolvedValue("unavailable");
    const { result } = renderHook(() => useBackendHealth());
    await waitFor(() => expect(result.current.status).toBe("unavailable"));

    let resolveRetry!: (status: "available" | "unavailable") => void;
    vi.mocked(probeBackendHealth).mockReturnValue(
      new Promise((resolve) => {
        resolveRetry = resolve;
      }),
    );

    act(() => result.current.retry());
    expect(result.current.status).toBe("checking");

    act(() => resolveRetry("available"));
    await waitFor(() => expect(result.current.status).toBe("available"));
    expect(probeBackendHealth).toHaveBeenCalledTimes(2);
  });
});
