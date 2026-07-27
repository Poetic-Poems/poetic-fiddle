#!/usr/bin/env node
// Extract the CHANGELOG.md section for a release, for use as the GitHub
// release body in .github/workflows/release.yml (`gh release create
// --notes-file`). Looks for a "## [<version>]" heading first, falling back
// to "## [Unreleased]" — the section a version-bump PR is expected to
// rename to the version being released, but may not yet have.
//
// Usage: node scripts/extract-changelog-notes.mjs <version> [changelog-path]
// <version> is the bare semver being released (e.g. "0.1.0", no "v" prefix).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function extractChangelogSection(content, version) {
  const lines = content.split("\n");
  const headings = [];
  lines.forEach((line, index) => {
    const match = line.match(/^## \[([^\]]+)\]/);
    if (match) headings.push({ label: match[1], index });
  });

  const sectionFor = (label) => {
    const heading = headings.find((h) => h.label === label);
    if (!heading) return null;
    const nextIndex =
      headings.find((h) => h.index > heading.index)?.index ?? lines.length;
    return lines
      .slice(heading.index + 1, nextIndex)
      .join("\n")
      .trim();
  };

  const section = sectionFor(version) ?? sectionFor("Unreleased");
  if (section === null) return null;
  return section || "_No notable changes recorded for this release._";
}

function main() {
  const [, , version, changelogPath = "CHANGELOG.md"] = process.argv;
  if (!version) {
    console.error(
      "Usage: extract-changelog-notes.mjs <version> [changelog-path]",
    );
    process.exit(1);
  }

  const content = readFileSync(changelogPath, "utf8");
  const section = extractChangelogSection(content, version);
  if (section === null) {
    console.error(
      `No "[${version}]" or "[Unreleased]" section found in ${changelogPath}.`,
    );
    process.exit(1);
  }

  console.log(section);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
