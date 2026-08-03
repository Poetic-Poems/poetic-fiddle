#!/usr/bin/env node
// Fails a pull request that bumps package.json's version without renaming
// CHANGELOG.md's "## [Unreleased]" heading to "## [<newVersion>]", opening a
// fresh, empty "## [Unreleased]" above it, and carrying at least one line of
// content into the renamed section — the convention
// scripts/extract-changelog-notes.mjs's "## [<version>]" preference assumes.
// Passes untouched when the version is unchanged, since there is then
// nothing to rename.
//
// Usage: node scripts/check-changelog-rename.mjs <base-version> <head-version> <changelog-path>

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function checkChangelogRename(
  baseVersion,
  headVersion,
  changelogContent,
) {
  if (baseVersion === headVersion) {
    return { pass: true, message: "package.json's version is unchanged." };
  }

  const lines = changelogContent.split("\n");
  const headingIndex = (label) =>
    lines.findIndex((line) => line.match(/^## \[([^\]]+)\]/)?.[1] === label);

  const versionIndex = headingIndex(headVersion);
  if (versionIndex === -1) {
    return {
      pass: false,
      message:
        `package.json's version changed from ${baseVersion} to ${headVersion}, ` +
        `but CHANGELOG.md has no "## [${headVersion}]" heading. Rename ` +
        `"## [Unreleased]" to "## [${headVersion}]".`,
    };
  }

  const unreleasedIndex = headingIndex("Unreleased");
  if (unreleasedIndex === -1 || unreleasedIndex > versionIndex) {
    return {
      pass: false,
      message:
        `CHANGELOG.md has a "## [${headVersion}]" heading, but no fresh ` +
        `"## [Unreleased]" heading above it. Open a new, empty ` +
        `"## [Unreleased]" section above "## [${headVersion}]".`,
    };
  }

  const nextHeadingOffset = lines
    .slice(versionIndex + 1)
    .findIndex((line) => line.match(/^## \[/));
  const nextHeadingIndex =
    nextHeadingOffset === -1
      ? lines.length
      : versionIndex + 1 + nextHeadingOffset;
  const sectionIsEmpty = lines
    .slice(versionIndex + 1, nextHeadingIndex)
    .every((line) => line.trim() === "");
  if (sectionIsEmpty) {
    return {
      pass: false,
      message:
        `CHANGELOG.md's "## [${headVersion}]" section has no content. Move ` +
        `the release's entries into it from "## [Unreleased]" before renaming.`,
    };
  }

  return {
    pass: true,
    message: `CHANGELOG.md renamed "## [Unreleased]" to "## [${headVersion}]".`,
  };
}

function main() {
  const [, , baseVersion, headVersion, changelogPath = "CHANGELOG.md"] =
    process.argv;
  if (!baseVersion || !headVersion) {
    console.error(
      "Usage: check-changelog-rename.mjs <base-version> <head-version> [changelog-path]",
    );
    process.exit(1);
  }

  const changelogContent = readFileSync(changelogPath, "utf8");
  const result = checkChangelogRename(
    baseVersion,
    headVersion,
    changelogContent,
  );
  console.log(result.message);
  if (!result.pass) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
