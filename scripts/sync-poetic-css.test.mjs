import { describe, expect, it, vi } from "vitest";
import { syncPoeticCss } from "./sync-poetic-css.mjs";

describe("syncPoeticCss", () => {
  it("throws an error when require.resolve fails to find poetic/browser/poetic.css", () => {
    const cause = new Error("Cannot find module 'poetic/browser/poetic.css'");
    const requireResolve = vi.fn(() => {
      throw cause;
    });

    const packageJson = JSON.stringify({
      dependencies: {
        poetic: "6.4.0",
      },
    });

    const readFile = vi.fn((path, encoding) => {
      if (path.includes("package.json")) {
        return packageJson;
      }
      return "/* css content */";
    });

    const writeFile = vi.fn();

    expect(() => {
      syncPoeticCss(requireResolve, readFile, writeFile, "/fake/scripts", "/fake/package.json");
    }).toThrow(
      /Could not resolve poetic\/browser\/poetic.css from the pinned poetic dependency \(6.4.0\)/
    );

    expect(requireResolve).toHaveBeenCalledWith("poetic/browser/poetic.css");
  });

  it("succeeds when require.resolve finds the CSS file", () => {
    const requireResolve = vi.fn(() => "/node_modules/poetic/browser/poetic.css");

    const cssContent = "body { color: red; }";
    const packageJson = JSON.stringify({
      dependencies: {
        poetic: "6.4.0",
      },
    });

    const readFile = vi.fn((filePath, encoding) => {
      if (filePath.includes("package.json")) {
        return packageJson;
      }
      if (filePath.includes("/node_modules/poetic/browser/poetic.css")) {
        return cssContent;
      }
      return "";
    });

    const writeFile = vi.fn();

    syncPoeticCss(requireResolve, readFile, writeFile, "/fake/scripts", "/fake/package.json");

    expect(requireResolve).toHaveBeenCalledWith("poetic/browser/poetic.css");
    expect(readFile).toHaveBeenCalledWith("/node_modules/poetic/browser/poetic.css", "utf8");
    expect(writeFile).toHaveBeenCalled();

    const writeCall = writeFile.mock.calls[0];
    expect(writeCall[0]).toMatch(/poetic-css\.generated\.ts$/);
    expect(writeCall[1]).toContain("export const poeticCss");
    expect(writeCall[1]).toContain("body { color: red; }");
  });

  it("includes the pinned version in the error message", () => {
    const cause = new Error("Module not found");
    const requireResolve = vi.fn(() => {
      throw cause;
    });

    const packageJson = JSON.stringify({
      dependencies: {
        poetic: "7.0.0",
      },
    });

    const readFile = vi.fn(() => packageJson);
    const writeFile = vi.fn();

    expect(() => {
      syncPoeticCss(requireResolve, readFile, writeFile, "/fake/scripts", "/fake/package.json");
    }).toThrow(/7.0.0/);
  });
});
