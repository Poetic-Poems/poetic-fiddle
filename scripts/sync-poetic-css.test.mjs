import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { syncPoeticCss } from "./sync-poetic-css.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

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

    const readFile = vi.fn((path) => {
      if (path.includes("package.json")) {
        return packageJson;
      }
      return "/* css content */";
    });

    const writeFile = vi.fn();

    expect(() => {
      syncPoeticCss(
        requireResolve,
        readFile,
        writeFile,
        "/fake/scripts",
        "/fake/package.json",
      );
    }).toThrow(
      /Could not resolve poetic\/browser\/poetic.css from the pinned poetic dependency \(6.4.0\)/,
    );

    expect(requireResolve).toHaveBeenCalledWith("poetic/browser/poetic.css");
  });

  it("succeeds when require.resolve finds the CSS file", () => {
    const requireResolve = vi.fn(
      () => "/node_modules/poetic/browser/poetic.css",
    );

    const cssContent = "body { color: red; }";
    const packageJson = JSON.stringify({
      dependencies: {
        poetic: "6.4.0",
      },
    });

    const readFile = vi.fn((filePath) => {
      if (filePath.includes("package.json")) {
        return packageJson;
      }
      if (filePath.includes("/node_modules/poetic/browser/poetic.css")) {
        return cssContent;
      }
      return "";
    });

    const writeFile = vi.fn();

    syncPoeticCss(
      requireResolve,
      readFile,
      writeFile,
      "/fake/scripts",
      "/fake/package.json",
    );

    expect(requireResolve).toHaveBeenCalledWith("poetic/browser/poetic.css");
    expect(readFile).toHaveBeenCalledWith(
      "/node_modules/poetic/browser/poetic.css",
      "utf8",
    );
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
      syncPoeticCss(
        requireResolve,
        readFile,
        writeFile,
        "/fake/scripts",
        "/fake/package.json",
      );
    }).toThrow(/7.0.0/);
  });
});

describe("CLI", () => {
  it("regenerates poetic-css.generated.ts against the real installed poetic package", () => {
    // main()'s own wiring — resolving the real package and the real output
    // path — isn't exercised by the injected-dependency tests above; this
    // reruns the same postinstall step for real, exactly as `npm install`
    // does, to check it still resolves against whatever `poetic` version is
    // actually installed.
    const out = execFileSync(
      process.execPath,
      [path.join(repoRoot, "scripts/sync-poetic-css.mjs")],
      { encoding: "utf8" },
    );

    expect(out).toMatch(/^Wrote .*poetic-css\.generated\.ts \(\d+ bytes\)/);

    const generated = readFileSync(
      path.join(repoRoot, "src/lib/poetic-css.generated.ts"),
      "utf8",
    );
    expect(generated).toContain("export const poeticCss");
  });
});
