import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import DOMPurify from "dompurify";
import { renderPoem } from "poetic/browser";
import { PoemPreview, wirePoemToggles } from "./PoemPreview";
import { NonceProvider } from "@/lib/nonce-context";
import { POEM_SANITIZE_CONFIG } from "@/lib/sanitize-poem";

// Mirrors the markup poetic's _poem-content.pug emits for an Analysis
// section (github.com/Poetic-Poems/poetic src/templates/_poem-content.pug).
// poetic.css hides `div.analysis` until the show button reads
// `aria-expanded="true"`, so the attribute is the whole of the state.
const ANALYSIS_HTML = `
  <button class="analysis show" id="show-analysis--test-poem" type="button" aria-expanded="false" aria-controls="analysis--test-poem">
    Show analysis
  </button>
  <div class="analysis" id="analysis--test-poem">
    <button class="analysis hide" id="hide-analysis--test-poem" type="button" data-analysis-toggle="show-analysis--test-poem">
      Hide analysis
    </button>
    <h2>Analysis</h2>
    <p>Some analysis text.</p>
  </div>
`;

function analysisDocument(): Document {
  const doc = document.implementation.createHTMLDocument("preview");
  doc.body.innerHTML = ANALYSIS_HTML;
  return doc;
}

// Mirrors the markup poetic's _poem-content.pug emits for an Analysis
// section that has both {Synopsis} and {Full} content. Which panel shows is
// poetic.css matching `.full-or-synopsis-selector[data-selected]` against each
// panel's `data-analysis-panel`.
const SELECTOR_HTML = `
  <div class="analysis" id="analysis--test-poem">
    <div class="full-or-synopsis-selector" data-selected="synopsis">
      <button class="analysis selector" id="analysis-select-syno--test-poem" type="button" aria-pressed="true" data-analysis-select="synopsis">
        Synopsis
      </button>
      <button class="analysis selector" id="analysis-select-full--test-poem" type="button" aria-pressed="false" data-analysis-select="full">
        Full Analysis
      </button>
    </div>
    <div class="analysis-panel" id="analysis-syno--test-poem" data-analysis-panel="synopsis">
      <h2>Analysis (synopsis)</h2>
      <p>Synopsis text.</p>
    </div>
    <div class="analysis-panel" id="analysis-full--test-poem" data-analysis-panel="full">
      <h2>Analysis</h2>
      <p>Full text.</p>
    </div>
  </div>
`;

function selectorDocument(): Document {
  const doc = document.implementation.createHTMLDocument("preview");
  doc.body.innerHTML = SELECTOR_HTML;
  return doc;
}

describe("wirePoemToggles", () => {
  it("expands the analysis on click of the show button", () => {
    const doc = analysisDocument();
    wirePoemToggles(doc);

    const showButton = doc.getElementById("show-analysis--test-poem")!;

    (showButton as HTMLElement).click();

    expect(showButton.getAttribute("aria-expanded")).toBe("true");
  });

  it("collapses the analysis again on click of the hide button", () => {
    const doc = analysisDocument();
    wirePoemToggles(doc);

    const showButton = doc.getElementById("show-analysis--test-poem")!;
    const hideButton = doc.getElementById("hide-analysis--test-poem")!;

    (showButton as HTMLElement).click();
    (hideButton as HTMLElement).click();

    expect(showButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("does nothing when there is no Analysis section", () => {
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML = "<p>No analysis here.</p>";

    wirePoemToggles(doc);

    expect(() => doc.body.querySelector("p")!.click()).not.toThrow();
  });

  it("switches to the full analysis and marks its button pressed", () => {
    const doc = selectorDocument();
    wirePoemToggles(doc);

    const synoButton = doc.getElementById("analysis-select-syno--test-poem")!;
    const fullButton = doc.getElementById("analysis-select-full--test-poem")!;
    const group = doc.querySelector(".full-or-synopsis-selector")!;

    (fullButton as HTMLElement).click();

    expect(group.getAttribute("data-selected")).toBe("full");
    expect(synoButton.getAttribute("aria-pressed")).toBe("false");
    expect(fullButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("switches back to the synopsis and marks its button pressed", () => {
    const doc = selectorDocument();
    wirePoemToggles(doc);

    const synoButton = doc.getElementById("analysis-select-syno--test-poem")!;
    const fullButton = doc.getElementById("analysis-select-full--test-poem")!;
    const group = doc.querySelector(".full-or-synopsis-selector")!;

    (fullButton as HTMLElement).click();
    (synoButton as HTMLElement).click();

    expect(group.getAttribute("data-selected")).toBe("synopsis");
    expect(synoButton.getAttribute("aria-pressed")).toBe("true");
    expect(fullButton.getAttribute("aria-pressed")).toBe("false");
  });
});

// poetic clamps a postscript to `--preview-lines` and offers a "See more"
// control to lift it. That control was a CSS-only checkbox until poetic v6.2.0
// made it a scripted button, so the clamp is now Fiddle's to release: left
// unwired, a long postscript is truncated with no way to read the rest. The
// visible label is poetic.css's ::after content keyed off aria-expanded; the
// .sr-only span is the button's accessible name.
const POSTSCRIPT_HTML = `
  <div class="postscript">
    <div class="postscript-content" id="postscript-item--test-poem--content" style="--preview-lines: 5" data-preview-lines="5">
      <p>A postscript long enough to be clamped.</p>
    </div>
    <button class="postscript-toggle" id="postscript-item--test-poem--more" type="button" aria-expanded="false" aria-controls="postscript-item--test-poem--content">
      <span class="sr-only">See more</span>
    </button>
  </div>
`;

function postscriptDocument(): Document {
  const doc = document.implementation.createHTMLDocument("preview");
  doc.body.innerHTML = POSTSCRIPT_HTML;
  return doc;
}

describe("wirePoemToggles postscript preview", () => {
  it("lifts the clamp and relabels the control on click", () => {
    const doc = postscriptDocument();
    wirePoemToggles(doc);

    const toggle = doc.getElementById("postscript-item--test-poem--more")!;
    const content = doc.getElementById("postscript-item--test-poem--content")!;

    (toggle as HTMLElement).click();

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(content.classList.contains("postscript-expanded")).toBe(true);
    expect(toggle.querySelector(".sr-only")!.textContent).toBe("See less");
  });

  it("restores the clamp and the label on a second click", () => {
    const doc = postscriptDocument();
    wirePoemToggles(doc);

    const toggle = doc.getElementById("postscript-item--test-poem--more")!;
    const content = doc.getElementById("postscript-item--test-poem--content")!;

    (toggle as HTMLElement).click();
    (toggle as HTMLElement).click();

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(content.classList.contains("postscript-expanded")).toBe(false);
    expect(toggle.querySelector(".sr-only")!.textContent).toBe("See more");
  });

  it("responds to a click on the label inside the control", () => {
    const doc = postscriptDocument();
    wirePoemToggles(doc);

    const toggle = doc.getElementById("postscript-item--test-poem--more")!;

    (toggle.querySelector(".sr-only") as HTMLElement).click();

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});

// The fixtures above are hand-copied from poetic's _poem-content.pug, so a
// template change there could silently desync the fixture from what poetic
// actually emits (the failure mode behind TD26071401/TD26071602). This pipes
// real .poem sources through poetic's own renderPoem(), the same way
// PoemPreview does, to exercise wirePoemToggles against genuine output.
const POEM_WITH_ANALYSIS = `Analysis Wiring Test
A Poet
2026-07-24

{Verse}
Hello world.

====

====

====

{Synopsis}

A short synopsis.

{Full}

The full analysis text.

====
`;

describe("wirePoemToggles against real poetic output", () => {
  function realAnalysisDocument(): Document {
    const html = renderPoem(POEM_WITH_ANALYSIS);
    const sanitised = DOMPurify.sanitize(html, POEM_SANITIZE_CONFIG);
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML = sanitised;
    return doc;
  }

  it("carries no inline handler, and keeps the toggle attributes through sanitising", () => {
    const html = renderPoem(POEM_WITH_ANALYSIS);
    expect(html).not.toContain("onclick");

    // The attributes wirePoemToggles drives have to survive DOMPurify —
    // stripped, the buttons would be inert and the analysis unreachable.
    const doc = realAnalysisDocument();
    expect(doc.body.innerHTML).not.toContain("onclick");
    expect(
      doc
        .getElementById("show-analysis--analysis-wiring-test")
        ?.getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      doc
        .getElementById("hide-analysis--analysis-wiring-test")
        ?.getAttribute("data-analysis-toggle"),
    ).toBe("show-analysis--analysis-wiring-test");
  });

  it("expands the analysis on click of the show button", () => {
    const doc = realAnalysisDocument();
    wirePoemToggles(doc);

    const showButton = doc.getElementById(
      "show-analysis--analysis-wiring-test",
    )!;

    (showButton as HTMLElement).click();

    expect(showButton.getAttribute("aria-expanded")).toBe("true");
  });

  it("collapses the analysis again on click of the hide button", () => {
    const doc = realAnalysisDocument();
    wirePoemToggles(doc);

    const showButton = doc.getElementById(
      "show-analysis--analysis-wiring-test",
    )!;
    const hideButton = doc.getElementById(
      "hide-analysis--analysis-wiring-test",
    )!;

    (showButton as HTMLElement).click();
    (hideButton as HTMLElement).click();

    expect(showButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("switches from the synopsis to the full analysis and marks its button pressed", () => {
    const doc = realAnalysisDocument();
    wirePoemToggles(doc);

    const synoButton = doc.getElementById(
      "analysis-select-syno--analysis-wiring-test",
    )!;
    const fullButton = doc.getElementById(
      "analysis-select-full--analysis-wiring-test",
    )!;
    const fullPanel = doc.getElementById(
      "analysis-full--analysis-wiring-test",
    )!;
    const group = doc.querySelector(".full-or-synopsis-selector")!;

    // poetic renders the synopsis selected by default (both declared,
    // `analysis.synopsis && analysis.full`).
    expect(group.getAttribute("data-selected")).toBe("synopsis");
    expect(synoButton.getAttribute("aria-pressed")).toBe("true");

    (fullButton as HTMLElement).click();

    expect(group.getAttribute("data-selected")).toBe("full");
    expect(synoButton.getAttribute("aria-pressed")).toBe("false");
    expect(fullButton.getAttribute("aria-pressed")).toBe("true");
    expect(fullPanel.getAttribute("data-analysis-panel")).toBe("full");
    expect(fullPanel.textContent).toContain("The full analysis text.");
  });

  it("switches back to the synopsis and marks its button pressed", () => {
    const doc = realAnalysisDocument();
    wirePoemToggles(doc);

    const synoButton = doc.getElementById(
      "analysis-select-syno--analysis-wiring-test",
    )!;
    const fullButton = doc.getElementById(
      "analysis-select-full--analysis-wiring-test",
    )!;
    const synoPanel = doc.getElementById(
      "analysis-syno--analysis-wiring-test",
    )!;
    const group = doc.querySelector(".full-or-synopsis-selector")!;

    (fullButton as HTMLElement).click();
    (synoButton as HTMLElement).click();

    expect(group.getAttribute("data-selected")).toBe("synopsis");
    expect(synoButton.getAttribute("aria-pressed")).toBe("true");
    expect(fullButton.getAttribute("aria-pressed")).toBe("false");
    expect(synoPanel.getAttribute("data-analysis-panel")).toBe("synopsis");
    expect(synoPanel.textContent).toContain("A short synopsis.");
  });
});

// Long enough that poetic's five-line preview clamp hides part of it, which is
// the case where leaving the control unwired loses text outright.
const POEM_WITH_LONG_POSTSCRIPT = `Postscript Wiring Test
A Poet
2026-08-01

{Verse}
Hello world.

====

====

${Array.from({ length: 12 }, (_, line) => `Postscript line ${line + 1}.`).join("\n")}

====
`;

describe("wirePoemToggles postscript against real poetic output", () => {
  function realPostscriptDocument(): Document {
    const html = renderPoem(POEM_WITH_LONG_POSTSCRIPT);
    const sanitised = DOMPurify.sanitize(html, POEM_SANITIZE_CONFIG);
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML = sanitised;
    return doc;
  }

  it("keeps the clamp and the control's attributes through sanitising", () => {
    const doc = realPostscriptDocument();

    const content = doc.querySelector(".postscript-content")!;
    const toggle = doc.querySelector(".postscript-toggle")!;

    // The inline custom property is what poetic.css's max-height reads, and
    // src/lib/csp.ts's style-src-attr exists to let it through.
    expect(content.getAttribute("style")).toContain("--preview-lines");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(content.id);
  });

  it("reveals the clamped postscript on click", () => {
    const doc = realPostscriptDocument();
    wirePoemToggles(doc);

    const content = doc.querySelector(".postscript-content")!;
    const toggle = doc.querySelector(".postscript-toggle")!;

    (toggle as HTMLElement).click();

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(content.classList.contains("postscript-expanded")).toBe(true);
    expect(content.textContent).toContain("Postscript line 12.");
  });
});

// Mirrors render-share.test.ts's POEM_WITH_EMBEDS: one handler per builtin
// embed style (a fixed height, an aspect ratio) plus a link-only handler
// (Suno) that never renders a button at all.
const POEM_WITH_EMBEDS = `Embed Test
A Poet
2026-07-17

{Verse}
Hello world.

====

Audiomack: my-artist/my-song
Mega: FileId123#Key456 (audio)
Suno: s/SongLink12345678

====
`;

describe("wirePoemToggles song-embed buttons", () => {
  const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

  afterEach(() => {
    openSpy.mockClear();
  });

  function embedDocument(dataEmbedSrc: string): Document {
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML = `<button class="song-embed-btn" data-embed-src="${dataEmbedSrc}">Load player</button>`;
    return doc;
  }

  it("opens an allow-listed embed URL in a new tab", () => {
    const doc = embedDocument("https://audiomack.com/embed/my-artist/my-song");
    wirePoemToggles(doc);

    (doc.querySelector(".song-embed-btn") as HTMLElement).click();

    expect(openSpy).toHaveBeenCalledWith(
      "https://audiomack.com/embed/my-artist/my-song",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("does not open a URL whose host is not on the allow-list", () => {
    const doc = embedDocument("https://evil.example/embed");
    wirePoemToggles(doc);

    (doc.querySelector(".song-embed-btn") as HTMLElement).click();

    expect(openSpy).not.toHaveBeenCalled();
  });

  it("does not open a non-https URL even for an allow-listed host", () => {
    const doc = embedDocument("http://audiomack.com/embed/my-artist/my-song");
    wirePoemToggles(doc);

    (doc.querySelector(".song-embed-btn") as HTMLElement).click();

    expect(openSpy).not.toHaveBeenCalled();
  });

  it("does not throw and does not open on an unparseable embed URL", () => {
    const doc = embedDocument("not a url");
    wirePoemToggles(doc);

    expect(() =>
      (doc.querySelector(".song-embed-btn") as HTMLElement).click(),
    ).not.toThrow();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("does nothing when the button carries no data-embed-src", () => {
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML = `<button class="song-embed-btn">Load player</button>`;
    wirePoemToggles(doc);

    (doc.querySelector(".song-embed-btn") as HTMLElement).click();

    expect(openSpy).not.toHaveBeenCalled();
  });

  it("opens the right host for each embed button against real poetic output", () => {
    const html = renderPoem(POEM_WITH_EMBEDS);
    const sanitised = DOMPurify.sanitize(html, POEM_SANITIZE_CONFIG);
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML = sanitised;
    wirePoemToggles(doc);

    const buttons = doc.querySelectorAll<HTMLElement>(".song-embed-btn");
    // Audiomack and Mega both declare embed_url and get a button; Suno is
    // link-only and renders a plain anchor instead.
    expect(buttons.length).toBe(2);

    buttons.forEach((button) => button.click());

    expect(openSpy).toHaveBeenCalledWith(
      "https://audiomack.com/embed/my-artist/song/my-song",
      "_blank",
      "noopener,noreferrer",
    );
    expect(openSpy).toHaveBeenCalledWith(
      "https://mega.nz/embed/FileId123#Key456",
      "_blank",
      "noopener,noreferrer",
    );
  });
});

// A srcdoc iframe inherits the parent document's CSP (issue #97), whose
// style-src requires a nonce — these assert the <style> tag PoemPreview
// writes into srcDoc carries the one src/proxy.ts minted for this request,
// not that the browser actually enforces the policy (jsdom doesn't).
describe("PoemPreview srcDoc nonce", () => {
  function srcDocOf(container: HTMLElement): string {
    const iframe = container.querySelector("iframe")!;
    return iframe.getAttribute("srcdoc")!;
  }

  it("carries the request nonce on the inline <style> element", () => {
    const { container } = render(
      <NonceProvider nonce="test-nonce-123">
        <PoemPreview html="<p>A poem.</p>" css="p { color: red; }" />
      </NonceProvider>,
    );

    expect(srcDocOf(container)).toContain(
      '<style nonce="test-nonce-123">p { color: red; }</style>',
    );
  });

  it('omits the nonce attribute rather than rendering nonce="null" when there is no nonce', () => {
    const { container } = render(
      <NonceProvider nonce={null}>
        <PoemPreview html="<p>A poem.</p>" css="p { color: red; }" />
      </NonceProvider>,
    );

    const srcDoc = srcDocOf(container);
    expect(srcDoc).toContain("<style>p { color: red; }</style>");
    expect(srcDoc).not.toContain("null");
  });

  // poetic's rendered markup carries per-instance sizing as inline `style`
  // attributes (issue #119) — POEM_SANITIZE_CONFIG keeps them, so this
  // asserts the value genuinely survives the sanitisation step, not just
  // that the site CSP (unexercised by jsdom) would allow it.
  it("keeps an inline style attribute through DOMPurify sanitisation", () => {
    const { container } = render(
      <NonceProvider nonce="test-nonce-123">
        <PoemPreview
          html='<div class="song-embed-player" style="--song-embed-height: 252px"></div>'
          css=""
        />
      </NonceProvider>,
    );

    expect(srcDocOf(container)).toContain('style="--song-embed-height: 252px"');
  });

  // The nonce arrives as a request header, and src/proxy.ts only overwrites
  // that header on the paths its matcher covers — so this string reaches raw
  // markup and has to be treated as a value that might not be one of ours.
  it("ignores a nonce that isn't shaped like one, rather than writing it into the markup", () => {
    const { container } = render(
      <NonceProvider nonce={'x"><script>alert(1)</script>'}>
        <PoemPreview html="<p>A poem.</p>" css="p { color: red; }" />
      </NonceProvider>,
    );

    const srcDoc = srcDocOf(container);
    expect(srcDoc).toContain("<style>p { color: red; }</style>");
    expect(srcDoc).not.toContain("<script>");
  });
});
