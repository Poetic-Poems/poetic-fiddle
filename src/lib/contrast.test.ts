import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderPoem } from "poetic/browser";
import { blendOver, contrastRatio } from "./contrast";
import { EXAMPLE_POEM } from "./example-poem";
import { poemHighlightStyleDark, poemHighlightStyleLight } from "./poem-syntax";
import { poeticCss } from "./poetic-css.generated";

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

/**
 * The backgrounds the CodeMirror editor actually renders, per Editor.tsx's
 * `theme={prefersDark ? "dark" : "light"}`: `@uiw/react-codemirror`'s
 * built-in light preset paints `#fff`, and its dark preset is
 * `@codemirror/theme-one-dark`, whose background is `#282c34`. Neither is a
 * `globals.css` token, so these are literal, not extracted.
 */
const CODEMIRROR_LIGHT_BG = "#ffffff";
const CODEMIRROR_DARK_BG = "#282c34";

function extractHighlightColors(specs: readonly Record<string, unknown>[]) {
  return specs
    .map((spec) => spec.color)
    .filter((color): color is string => typeof color === "string");
}

describe(".poem syntax-highlight colours meet WCAG AA (>= 4.5:1)", () => {
  const lightColors = extractHighlightColors(poemHighlightStyleLight.specs);
  const darkColors = extractHighlightColors(poemHighlightStyleDark.specs);

  it("found colours to check in both highlight styles", () => {
    expect(lightColors.length).toBeGreaterThan(0);
    expect(darkColors.length).toBeGreaterThan(0);
  });

  it.each(lightColors)(
    "light colour %s on the light editor background",
    (color) => {
      expect(contrastRatio(color, CODEMIRROR_LIGHT_BG)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    },
  );

  it.each(darkColors)(
    "dark colour %s on the dark editor background",
    (color) => {
      expect(contrastRatio(color, CODEMIRROR_DARK_BG)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    },
  );
});

/**
 * poetic.css — the vendored stylesheet PoemPreview and SharedPoemView inject
 * alongside a rendered poem — measured on the surfaces Fiddle actually paints
 * it on.
 *
 * That qualifier is the whole of TD-PPpfid-26072401. Both views inject
 * poetic's bare `renderPoem()` fragment into
 * `<body><div class="container">…</div></body>` inside an isolated iframe,
 * styled by nothing but `poeticCss`. The fragment never emits the white
 * `.poem-section` card that only poetic's *standalone page* template paints,
 * and `poeticCss` gives `.container` no background of its own — so poem text
 * sits directly on `poeticCss`'s own `body` background. poetic's muted greys
 * were once calibrated against that white card, where they cleared AA by a
 * hair and were below it here.
 *
 * These tests therefore render poems through `renderPoem`, resolve what
 * poetic.css paints each piece of text on top of, and check the pair. Which
 * roles get covered follows from what the renderer emits rather than a
 * hand-kept list, so a role poetic starts colouring is measured as soon as it
 * lands in the pinned package.
 *
 * Only the two schemes a Fiddle iframe can be in are covered: the default
 * light rules, and the `@media (prefers-color-scheme: dark)` block. poetic's
 * third palette, `html.dark-mode`, is a Blogger JavaScript workaround needing
 * that class on the root element, which Fiddle's iframe never sets.
 */
type PoeticRule = {
  selectors: string[];
  declarations: Record<string, string>;
};

type ColourScheme = "light" | "dark";

const NAMED_COLOURS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
};

// What a browser paints when no author rule says otherwise. The link colour
// is a UA rule on the element itself, not an inherited value, so it beats an
// ancestor's `color` — which is why a poem's song links are blue and not the
// grey their container declares.
const UA_DEFAULT_TEXT = "#000000";
const UA_DEFAULT_BACKGROUND = "#ffffff";
const UA_LINK_TEXT = "#0000ee";

/**
 * Normalises the colour syntaxes poetic.css uses to the 6-digit hex
 * `contrastRatio` parses. Null for a value naming no measurable colour —
 * `inherit`, `none`, `transparent`, or a `var()` with no definition here —
 * which the callers treat as "this rule says nothing; keep looking".
 */
function toHex6(value: string | undefined): string | null {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;
  if (NAMED_COLOURS[raw]) return NAMED_COLOURS[raw];
  const short = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (short) {
    const [, r, g, b] = short;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : null;
}

/** `opacity: 70%` or `opacity: .7` as an alpha; null when unset. */
function toAlpha(value: string | undefined): number | null {
  const raw = value?.trim();
  if (!raw) return null;
  const isPercentage = raw.endsWith("%");
  const numeric = Number.parseFloat(isPercentage ? raw.slice(0, -1) : raw);
  if (Number.isNaN(numeric)) return null;
  return isPercentage ? numeric / 100 : numeric;
}

function parseDeclarations(body: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  for (const chunk of body.split(";")) {
    const colon = chunk.indexOf(":");
    if (colon === -1) continue;
    const property = chunk.slice(0, colon).trim();
    if (property) {
      declarations[property] = chunk
        .slice(colon + 1)
        .replace("!important", "")
        .trim();
    }
  }
  return declarations;
}

/**
 * Rule-level parse of a slice of poetic.css. `[^{}]+` cannot span a brace, so
 * an `@media` prelude never matches as a rule in its own right and the block's
 * inner rules are picked up directly — which is what this wants, the only
 * at-rule in play being the dark-scheme one the caller has already sliced out.
 */
function parsePoeticRules(css: string): PoeticRule[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((rule) => ({
    selectors: rule[1]
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean),
    declarations: parseDeclarations(rule[2]),
  }));
}

// Comments go first: poetic.css writes placeholders in braces
// (`.song-embed--{service}`), which would otherwise parse as rule bodies.
const poeticCssSource = poeticCss.replace(/\/\*[\s\S]*?\*\//g, "");
const DARK_SCHEME_AT_RULE = "@media (prefers-color-scheme: dark)";
const CLASS_DARK_MODE_SELECTOR = "html.dark-mode";

const lightRules = parsePoeticRules(
  poeticCssSource.slice(0, poeticCssSource.indexOf(CLASS_DARK_MODE_SELECTOR)),
);
const darkSchemeRules = parsePoeticRules(
  poeticCssSource.slice(poeticCssSource.indexOf(DARK_SCHEME_AT_RULE)),
);

/** Every declaration a set of rules gives one selector, in source order, so a
 *  grouped rule (`.no-content, .poem-info, … { color: … }`) counts for each
 *  selector in the group and a later rule wins. */
function declarationsForSelector(
  rules: PoeticRule[],
  selector: string,
): Record<string, string> {
  return rules
    .filter((rule) => rule.selectors.includes(selector))
    .reduce((merged, rule) => ({ ...merged, ...rule.declarations }), {});
}

/** The dark scheme's `:root` custom properties, so `var(--muted)` and friends
 *  resolve to the literal a browser would paint. */
const darkCustomProperties = Object.fromEntries(
  Object.entries(declarationsForSelector(darkSchemeRules, ":root")).filter(
    ([property]) => property.startsWith("--"),
  ),
);

function resolveValue(
  value: string | undefined,
  customProperties: Record<string, string>,
): string | undefined {
  const reference = value?.trim().match(/^var\((--[a-z-]+)\)$/);
  return reference ? customProperties[reference[1]] : value;
}

/**
 * Drops pseudo-classes and pseudo-elements before matching an element: a rule
 * for `.filter-reset:hover` or `.audio-cell:empty::after` still describes text
 * a reader sees, and its base selector is what says whether Fiddle renders it
 * at all.
 */
function baseSelector(selector: string): string {
  return selector.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, "").trim();
}

function matches(element: Element, selector: string): boolean {
  const base = baseSelector(selector);
  if (!base) return false;
  try {
    return element.matches(base);
  } catch {
    // A selector jsdom cannot parse describes nothing this fragment renders.
    return false;
  }
}

/**
 * The rules applying to one element, in cascade order: the light scheme
 * always, then the dark scheme layered over it. Dark *overrides* light rather
 * than replacing it — a role poetic leaves out of the dark palette keeps its
 * light colour, which is exactly how `.no-content` came to sit on a dark
 * background in a light-mode grey.
 */
function rulesFor(element: Element, scheme: ColourScheme): PoeticRule[] {
  const applicable = (rules: PoeticRule[]) =>
    rules.filter((rule) =>
      rule.selectors.some((selector) => matches(element, selector)),
    );
  return scheme === "light"
    ? applicable(lightRules)
    : [...applicable(lightRules), ...applicable(darkSchemeRules)];
}

function customPropertiesFor(scheme: ColourScheme): Record<string, string> {
  return scheme === "light" ? {} : darkCustomProperties;
}

/**
 * Walks an element and its ancestors for the last rule declaring `property` as
 * a literal colour — the inheritance a browser performs for `color`, and the
 * see-through-to-the-parent behaviour it gives an unpainted `background`.
 * Returns the selector that supplied it too, since that is the poetic.css role
 * a failure has to be reported against.
 */
function inheritedColour(
  element: Element,
  property: "color" | "background",
  scheme: ColourScheme,
): { colour: string; source: string } | null {
  const customProperties = customPropertiesFor(scheme);
  for (let node: Element | null = element; node; node = node.parentElement) {
    let found: { colour: string; source: string } | null = null;
    for (const rule of rulesFor(node, scheme)) {
      const declared =
        property === "color"
          ? rule.declarations.color
          : (rule.declarations.background ??
            rule.declarations["background-color"]);
      const colour = toHex6(resolveValue(declared, customProperties));
      if (colour) {
        found = {
          colour,
          source:
            rule.selectors.find((selector) => matches(node, selector)) ??
            rule.selectors[0],
        };
      }
    }
    if (!found && property === "color" && node.matches("a[href]")) {
      found = { colour: UA_LINK_TEXT, source: "a[href] (browser default)" };
    }
    if (found) return found;
  }
  return null;
}

/** Opacity compounds down the tree, so an ancestor's fade dims this text too. */
function inheritedAlpha(element: Element, scheme: ColourScheme): number | null {
  let alpha: number | null = null;
  for (let node: Element | null = element; node; node = node.parentElement) {
    for (const rule of rulesFor(node, scheme)) {
      const declared = toAlpha(rule.declarations.opacity);
      if (declared !== null) alpha = (alpha ?? 1) * declared;
    }
  }
  return alpha;
}

/**
 * Poems chosen to exercise the fragment's styled roles between them: the
 * editor's own example poem (labels, highlighted phrases, postscript, songs),
 * a poem carrying every optional section including an analysis with a heading,
 * and a header-only poem, which is what makes poetic emit `.no-content`.
 */
const PROBE_POEMS = [
  EXAMPLE_POEM,
  `Probe Poem
A Poet
2026-08-01

{Verse}
A line of verse.

====

Audiomack: my-artist/my-song
Suno: s/SongLink12345678

====

A postscript note.

====

{Synopsis}

A short synopsis.

{Full}

### A heading inside the analysis

The full analysis.

====
`,
  `Header Only
A Poet
2026-08-01
`,
];

type PoeticTextRole = {
  /** The poetic.css selector that set this text's colour. */
  source: string;
  scheme: ColourScheme;
  colour: string;
  background: string;
  alpha: number | null;
};

/**
 * Every distinct colour-on-background pair poetic.css paints over the probe
 * fragments, in both schemes. Only elements holding text of their own are
 * measured: a wrapper's colour is visible solely through its descendants,
 * which resolve it through inheritance and get measured in their own right.
 * `.sr-only` text is clipped to a single pixel for screen readers, so its
 * contrast is not a thing a reader can see.
 */
function collectTextRoles(): PoeticTextRole[] {
  document.body.innerHTML = `<div class="container">${PROBE_POEMS.map((poem) =>
    renderPoem(poem),
  ).join("")}</div>`;

  const byKey = new Map<string, PoeticTextRole>();
  for (const scheme of ["light", "dark"] as const) {
    for (const element of document.body.querySelectorAll("*")) {
      if (element.closest(".sr-only")) continue;
      const hasOwnText = [...element.childNodes].some(
        (node) => node.nodeType === node.TEXT_NODE && node.textContent?.trim(),
      );
      if (!hasOwnText) continue;

      const colour = inheritedColour(element, "color", scheme);
      const background = inheritedColour(element, "background", scheme);
      const role: PoeticTextRole = {
        source: colour?.source ?? "(browser default)",
        scheme,
        colour: colour?.colour ?? UA_DEFAULT_TEXT,
        background: background?.colour ?? UA_DEFAULT_BACKGROUND,
        alpha: inheritedAlpha(element, scheme),
      };
      byKey.set(
        `${role.scheme}|${role.source}|${role.colour}|${role.background}|${role.alpha}`,
        role,
      );
    }
  }
  return [...byKey.values()];
}

const poeticTextRoles = collectTextRoles();

/** The colour poetic.css declares for one selector under one scheme, with the
 *  dark rules layered over the light ones as a browser would apply them. */
function declaredStyle(selector: string, scheme: ColourScheme) {
  const declarations =
    scheme === "light"
      ? declarationsForSelector(lightRules, selector)
      : {
          ...declarationsForSelector(lightRules, selector),
          ...declarationsForSelector(darkSchemeRules, selector),
        };
  const customProperties = customPropertiesFor(scheme);
  return {
    colour: toHex6(resolveValue(declarations.color, customProperties)),
    alpha: toAlpha(declarations.opacity),
  };
}

const pageBackgrounds: Record<ColourScheme, string | null> = {
  light: toHex6(declarationsForSelector(lightRules, "body").background),
  dark: toHex6(
    resolveValue(
      declarationsForSelector(darkSchemeRules, "body").background,
      darkCustomProperties,
    ),
  ),
};

describe("poetic.css muted roles meet WCAG AA on the page background", () => {
  /**
   * The roles TD-PPpfid-26072401 was filed against, checked as declared tokens
   * against the background Fiddle paints them on — the pairing list the item
   * asks for. This is deliberately independent of what any probe poem renders:
   * `.song-link`, for one, wraps its text in an anchor the browser colours
   * itself, so the rendered checks below never see the grey this declares.
   */
  const MUTED_ROLES = [
    ".no-content",
    ".poem-info",
    ".postscript",
    ".song-link",
    ".song-segment",
  ];

  it("read a different page background out of each scheme", () => {
    // Guards the slicing above: were either region to stop parsing, both
    // schemes would collapse onto one background and the dark checks would
    // silently be re-measuring the light one.
    expect(pageBackgrounds.light).toBe("#f5f5f5");
    expect(pageBackgrounds.dark).toBeTruthy();
    expect(pageBackgrounds.dark).not.toBe(pageBackgrounds.light);
  });

  const mutedPairs = MUTED_ROLES.flatMap((selector) =>
    (["light", "dark"] as const).map(
      (scheme): [string, string, ColourScheme] => [
        `${selector} — ${scheme}`,
        selector,
        scheme,
      ],
    ),
  );

  it.each(mutedPairs)("%s (>= 4.5:1)", (_label, selector, scheme) => {
    const background = pageBackgrounds[scheme];
    const { colour, alpha } = declaredStyle(selector, scheme);
    // A null colour means poetic renamed or dropped the role: fail rather
    // than pass vacuously.
    expect(colour).toBeTruthy();
    expect(background).toBeTruthy();
    const painted =
      alpha === null ? colour! : blendOver(colour!, alpha, background!);
    expect(contrastRatio(painted, background!)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });
});

describe("poetic.css text meets WCAG AA where Fiddle renders it", () => {
  /**
   * The roles this suite exists to hold, asserted separately so a probe poem
   * that stops exercising one fails loudly instead of quietly shrinking what
   * gets measured.
   */
  const EXPECTED_SOURCES = [
    ".analysis",
    ".analysis h2",
    ".no-content",
    ".poem-info",
    ".poem-label",
    ".poem-title",
    ".postscript",
    ".song-embed-btn",
    ".song-segment",
  ];

  it.each(EXPECTED_SOURCES)("measures %s in both schemes", (source) => {
    const schemes = poeticTextRoles
      .filter((role) => role.source === source)
      .map((role) => role.scheme);
    expect(schemes).toContain("light");
    expect(schemes).toContain("dark");
  });

  it.each(
    poeticTextRoles.map((role): [string, PoeticTextRole] => [
      `${role.source} — ${role.scheme}: ${role.colour}${
        role.alpha === null
          ? ""
          : ` at ${Math.round(role.alpha * 100)}% opacity`
      } on ${role.background}`,
      role,
    ]),
  )("%s (>= 4.5:1)", (_label, role) => {
    // Opacity is composited, not ignored: it fades text towards its
    // background, and poetic.css has shipped a muted role whose declared
    // colour cleared AA while the painted result did not.
    const painted =
      role.alpha === null
        ? role.colour
        : blendOver(role.colour, role.alpha, role.background);
    expect(contrastRatio(painted, role.background)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });
});
