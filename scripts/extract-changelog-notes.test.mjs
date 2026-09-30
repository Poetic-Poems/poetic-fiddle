import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractChangelogSection } from "./extract-changelog-notes.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const scriptPath = path.join(repoRoot, "scripts/extract-changelog-notes.mjs");

describe("extractChangelogSection", () => {
  it("finds a heading matching the version being released", () => {
    const changelog = [
      "# Changelog",
      "",
      "## [Unreleased]",
      "",
      "- something not yet released",
      "",
      "## [1.2.0]",
      "",
      "### Added",
      "",
      "- widgets",
      "",
      "## [1.1.0]",
      "",
      "- gadgets",
      "",
    ].join("\n");

    expect(extractChangelogSection(changelog, "1.2.0")).toBe(
      "### Added\n\n- widgets",
    );
  });

  it("falls back to [Unreleased] when no matching version heading exists", () => {
    const changelog = [
      "# Changelog",
      "",
      "## [Unreleased]",
      "",
      "- something not yet released",
      "",
    ].join("\n");

    expect(extractChangelogSection(changelog, "0.1.0")).toBe(
      "- something not yet released",
    );
  });

  it("returns a placeholder for an empty [Unreleased] section", () => {
    const changelog = ["# Changelog", "", "## [Unreleased]", "", ""].join("\n");

    expect(extractChangelogSection(changelog, "0.1.0")).toBe(
      "_No notable changes recorded for this release._",
    );
  });

  it("returns null when neither the version nor [Unreleased] is present", () => {
    const changelog = ["# Changelog", "", "## [1.0.0]", "", "- x", ""].join(
      "\n",
    );

    expect(extractChangelogSection(changelog, "2.0.0")).toBeNull();
  });

  it("extracts the current repo CHANGELOG.md's [Unreleased] section without error", () => {
    const changelog = readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8");

    const section = extractChangelogSection(changelog, "0.1.0");

    expect(section).not.toBeNull();
    expect(section.length).toBeGreaterThan(0);
  });
});

describe("CLI", () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "extract-changelog-notes-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("prints the requested version's section to stdout", () => {
    const changelogPath = path.join(dir, "CHANGELOG.md");
    writeFileSync(
      changelogPath,
      ["# Changelog", "", "## [1.2.0]", "", "- widgets", ""].join("\n"),
    );

    const out = execFileSync(
      process.execPath,
      [scriptPath, "1.2.0", changelogPath],
      { encoding: "utf8" },
    );

    expect(out.trim()).toBe("- widgets");
  });

  it("exits non-zero with a usage message when no version is given", () => {
    expect(() =>
      execFileSync(process.execPath, [scriptPath], { encoding: "utf8" }),
    ).toThrow(/Usage: extract-changelog-notes\.mjs/);
  });

  it("exits non-zero naming the changelog when neither the version nor [Unreleased] is found", () => {
    const changelogPath = path.join(dir, "CHANGELOG.md");
    writeFileSync(
      changelogPath,
      ["# Changelog", "", "## [1.0.0]", "", "- x", ""].join("\n"),
    );

    let error;
    try {
      execFileSync(process.execPath, [scriptPath, "2.0.0", changelogPath], {
        encoding: "utf8",
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.stderr).toContain(changelogPath);
  });
});
