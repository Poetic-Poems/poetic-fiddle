import { describe, expect, it } from "vitest";
import { checkChangelogRename } from "./check-changelog-rename.mjs";

describe("checkChangelogRename", () => {
  it("passes when the version is unchanged", () => {
    const changelog = [
      "# Changelog",
      "",
      "## [Unreleased]",
      "",
      "- x",
      "",
    ].join("\n");

    const result = checkChangelogRename("0.1.0", "0.1.0", changelog);

    expect(result.pass).toBe(true);
  });

  it("passes when the version bumped and [Unreleased] was renamed with a fresh section opened above it", () => {
    const changelog = [
      "# Changelog",
      "",
      "## [Unreleased]",
      "",
      "## [0.2.0]",
      "",
      "- shipped things",
      "",
    ].join("\n");

    const result = checkChangelogRename("0.1.0", "0.2.0", changelog);

    expect(result.pass).toBe(true);
  });

  it("fails when the version bumped but no [<newVersion>] heading exists", () => {
    const changelog = [
      "# Changelog",
      "",
      "## [Unreleased]",
      "",
      "- x",
      "",
    ].join("\n");

    const result = checkChangelogRename("0.1.0", "0.2.0", changelog);

    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/no "## \[0\.2\.0\]" heading/);
  });

  it("fails when the [<newVersion>] heading exists but no fresh [Unreleased] section is above it", () => {
    const changelog = [
      "# Changelog",
      "",
      "## [0.2.0]",
      "",
      "- shipped things",
      "",
    ].join("\n");

    const result = checkChangelogRename("0.1.0", "0.2.0", changelog);

    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/no fresh "## \[Unreleased\]" heading/);
  });

  it("fails when [Unreleased] exists below the [<newVersion>] heading rather than above it", () => {
    const changelog = [
      "# Changelog",
      "",
      "## [0.2.0]",
      "",
      "- shipped things",
      "",
      "## [Unreleased]",
      "",
    ].join("\n");

    const result = checkChangelogRename("0.1.0", "0.2.0", changelog);

    expect(result.pass).toBe(false);
  });
});
