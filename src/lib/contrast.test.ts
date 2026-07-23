import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blendOver, contrastRatio } from "./contrast";

// WCAG 2.x AA thresholds (SC 1.4.3 / 1.4.11).
const AA_NORMAL_TEXT = 4.5;
const AA_UI_COMPONENT = 3;

describe("contrastRatio", () => {
  it("is 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("is 1:1 for identical colours", () => {
    expect(contrastRatio("#534ab7", "#534ab7")).toBeCloseTo(1, 5);
  });

  it("is symmetric in its arguments", () => {
    expect(contrastRatio("#1b1730", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#1b1730"),
      10,
    );
  });
});

describe("blendOver", () => {
  it("returns the background unchanged at alpha 0", () => {
    expect(blendOver("#000000", 0, "#ffffff")).toBe("#ffffff");
  });

  it("returns the foreground unchanged at alpha 1", () => {
    expect(blendOver("#1b1730", 1, "#ffffff")).toBe("#1b1730");
  });
});

/**
 * Extracts every literal hex value assigned to `--<varName>` in globals.css,
 * in source order (the light `:root` block first, then the dark
 * `@media (prefers-color-scheme: dark)` override second) — so this test
 * tracks the file's actual tokens instead of a hand-copied snapshot that
 * could silently drift from it.
 */
function extractCssVarHexValues(css: string, varName: string): string[] {
  const matches = [
    ...css.matchAll(new RegExp(`--${varName}:\\s*(#[0-9a-fA-F]{6})`, "g")),
  ];
  return matches.map((m) => m[1]);
}

const globalsCss = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

const [backgroundLight, backgroundDark] = extractCssVarHexValues(
  globalsCss,
  "background",
);
const [foregroundLight, foregroundDark] = extractCssVarHexValues(
  globalsCss,
  "foreground",
);
const [brandPrimary] = extractCssVarHexValues(globalsCss, "brand-primary");
const [brandAccent] = extractCssVarHexValues(globalsCss, "brand-accent");
// --link only has a literal hex override in the dark scheme; in light mode
// it resolves to --brand-primary (see globals.css).
const [linkDark] = extractCssVarHexValues(globalsCss, "link");
const linkLight = brandPrimary;

describe("globals.css token pairings meet WCAG AA", () => {
  it("found exactly the light + dark values this test expects", () => {
    // Guards against the extraction silently matching zero/one value if
    // globals.css's structure ever changes shape.
    expect(backgroundLight).toBeDefined();
    expect(backgroundDark).toBeDefined();
    expect(foregroundLight).toBeDefined();
    expect(foregroundDark).toBeDefined();
    expect(brandPrimary).toBeDefined();
    expect(brandAccent).toBeDefined();
    expect(linkDark).toBeDefined();
  });

  const normalTextPairs: Array<[string, string, string]> = [
    ["body text on background — light", foregroundLight, backgroundLight],
    ["body text on background — dark", foregroundDark, backgroundDark],
    ["link text on background — light", linkLight, backgroundLight],
    ["link text on background — dark", linkDark, backgroundDark],
    ["white button text on primary button background", "#ffffff", brandPrimary],
  ];

  it.each(normalTextPairs)("%s (>= 4.5:1)", (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  const uiComponentPairs: Array<[string, string, string]> = [
    ["focus ring on background — light", brandPrimary, backgroundLight],
    ["focus ring on background — dark", brandAccent, backgroundDark],
  ];

  it.each(uiComponentPairs)("%s (>= 3:1)", (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_UI_COMPONENT);
  });

  const translucentTextPairs: Array<[string, string, number, string]> = [
    [
      "muted text/70 on background — light",
      foregroundLight,
      0.7,
      backgroundLight,
    ],
    ["muted text/70 on background — dark", foregroundDark, 0.7, backgroundDark],
    [
      "muted text/60 on background — light",
      foregroundLight,
      0.6,
      backgroundLight,
    ],
    ["muted text/60 on background — dark", foregroundDark, 0.6, backgroundDark],
  ];

  it.each(translucentTextPairs)("%s (>= 4.5:1)", (_label, fg, alpha, bg) => {
    const blended = blendOver(fg, alpha, bg);
    expect(contrastRatio(blended, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

describe("status-text colour pairings meet WCAG AA (>= 4.5:1)", () => {
  // Tailwind palette values (not globals.css tokens) used for error/warning
  // status text — src/components/Editor.tsx, PoemsDashboard.tsx,
  // SignInPrompt.tsx, src/app/share/[share_id]/page.tsx.
  const statusTextPairs: Array<[string, string, string]> = [
    ["text-red-700 on white (light error text)", "#b91c1c", "#ffffff"],
    ["text-red-400 on dark background (dark error text)", "#f87171", "#17132a"],
    [
      "text-red-600 on white (SignInPrompt light error text)",
      "#dc2626",
      "#ffffff",
    ],
    [
      "text-amber-700 on white (Editor parse-error status, light)",
      "#b45309",
      "#ffffff",
    ],
    [
      "text-amber-400 on dark background (Editor parse-error status, dark)",
      "#fbbf24",
      "#17132a",
    ],
  ];

  it.each(statusTextPairs)("%s", (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
