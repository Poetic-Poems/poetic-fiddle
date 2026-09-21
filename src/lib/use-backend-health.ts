"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { probeBackendHealth, type BackendStatus } from "@/lib/backend-health";

// Module-scope, not component state: every caller on the page (Editor and
// PoemsDashboard can both mount across a navigation) shares the one probe
// and its result, memoised for the page's lifetime (AC1) rather than each
// re-running it. `resetBackendHealthForTest` below is the only way this
// resets short of a full page load.
let status: BackendStatus = "checking";
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function runProbe(): Promise<void> {
  return probeBackendHealth().then((result) => {
    status = result;
    notify();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): BackendStatus {
  return status;
}

function getServerSnapshot(): BackendStatus {
  return "checking";
}

export interface BackendHealth {
  status: BackendStatus;
  /** Forces a fresh probe — the banner's "Try again" control. */
  retry: () => void;
}

export function useBackendHealth(): BackendHealth {
  const currentStatus = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const retry = useCallback(() => {
    if (inFlight) return;
    status = "checking";
    notify();
    inFlight = runProbe().finally(() => {
      inFlight = null;
    });
  }, []);

  // Kicks off the one-time probe on first mount anywhere — every later
  // mount (a navigation back to the editor, say) sees the memoised result
  // and this is a no-op.
  useEffect(() => {
    if (status === "checking" && !inFlight) retry();
  }, [retry]);

  return { status: currentStatus, retry };
}

/** Test-only: clears the module-scope memoisation between test cases. */
export function resetBackendHealthForTest(): void {
  status = "checking";
  inFlight = null;
}
