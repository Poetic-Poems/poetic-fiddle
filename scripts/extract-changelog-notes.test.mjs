import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractChangelogSection } from "./extract-changelog-notes.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

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
