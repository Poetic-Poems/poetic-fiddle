import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest.config.ts doesn't set `test.globals`, so Testing Library's
// auto-cleanup (which looks for a global `afterEach`) never registers —
// wire it up explicitly so each test starts from an empty document.
afterEach(() => {
  cleanup();
});

// The server-side observability layer (src/lib/observability.ts) imports
// @sentry/nextjs, which transitively pulls the real SDK (@sentry/node,
// OpenTelemetry) — heavy enough that loading it across the parallel run
// starves unrelated async assertions of their timeout. Unit tests neither
// want to initialise Sentry nor to exercise its wire behaviour, so stub it
// globally: fast to import, inert, and spy-able. observability.test.ts
// asserts against these same vi.fn()s.
vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureRequestError: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// jsdom reflects <dialog>'s `open` attribute but implements neither
// showModal() nor close(); components using <dialog> need a stub to mount.
if (typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

// Node's own experimental global `localStorage` (added in Node 26, inert
// unless --localstorage-file is passed) already exists on globalThis before
// this file runs, so Vitest's jsdom environment setup — which only proxies a
// jsdom window property onto the global if that key isn't already present —
// skips it, leaving window.localStorage undefined. Detect it via its
// property descriptor rather than reading the value, since reading it is
// what trips Node's "--localstorage-file was not provided" warning. Give it
// a working, spec-shaped in-memory Storage so tests can use it regardless of
// Node version.
if (Object.getOwnPropertyDescriptor(window, "localStorage")?.get) {
  class MemoryStorage implements Storage {
    #store = new Map<string, string>();

    get length() {
      return this.#store.size;
    }

    clear() {
      this.#store.clear();
    }

    getItem(key: string) {
      return this.#store.has(key) ? this.#store.get(key)! : null;
    }

    key(index: number) {
      return Array.from(this.#store.keys())[index] ?? null;
    }

    removeItem(key: string) {
      this.#store.delete(key);
    }

    setItem(key: string, value: string) {
      this.#store.set(key, String(value));
    }
  }

  Object.defineProperty(window, "localStorage", {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}

// jsdom does not implement matchMedia; components that read
// prefers-color-scheme need a stub to mount in tests.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
