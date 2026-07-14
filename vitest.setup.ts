import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest.config.ts doesn't set `test.globals`, so Testing Library's
// auto-cleanup (which looks for a global `afterEach`) never registers —
// wire it up explicitly so each test starts from an empty document.
afterEach(() => {
  cleanup();
});

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
