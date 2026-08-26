import { afterEach, describe, expect, it, vi } from "vitest";
import DOMPurify from "dompurify";
import { renderPoem } from "poetic/browser";
import { evaluatePostscriptPreviews, wirePoemToggles } from "./poem-toggles";
import { POEM_SANITIZE_CONFIG } from "@/lib/sanitize-poem";
import { EXAMPLE_POEM, POEM_SYNTAX_REFERENCE_URL } from "@/lib/example-poem";

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
    // src/lib/csp.ts exists to let it through.
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

describe("evaluatePostscriptPreviews", () => {
  // Not vi.restoreAllMocks() in afterEach: that would also tear down the
  // module-level window.open spy the song-embed describe block below sets up
  // once, outside any beforeEach/afterEach of its own.
  let computedStyleSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    document.body.innerHTML = "";
    computedStyleSpy?.mockRestore();
    computedStyleSpy = undefined;
  });

  // Builds a detached `.postscript-content` element attached to the live
  // `document` (not `document.implementation.createHTMLDocument()`, whose
  // result has no `defaultView` — see the "does nothing" case below — the
  // same reason evaluatePostscriptPreviews reaches computed style through
  // `doc.defaultView` rather than a global). jsdom never lays elements out,
  // so the two rects that decide clamping are stubbed directly on the nodes
  // under test, standing in for `getBoundingClientRect()` in a real browser.
  function postscriptContentElement({
    previewLines,
    lineHeight,
    fontSize = "16px",
    contentBottom,
  }: {
    previewLines?: number;
    lineHeight: string;
    fontSize?: string;
    contentBottom: number;
  }): HTMLElement {
    const container = document.createElement("div");
    container.innerHTML = `
      <div class="postscript-content"${previewLines !== undefined ? ` data-preview-lines="${previewLines}"` : ""}>
        <p>A postscript.</p>
      </div>
    `;
    document.body.appendChild(container);

    const content = container.querySelector<HTMLElement>(
      ".postscript-content",
    )!;
    computedStyleSpy = vi.spyOn(window, "getComputedStyle").mockReturnValue({
      lineHeight,
      fontSize,
    } as CSSStyleDeclaration);
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue({
      top: 0,
    } as DOMRect);
    vi.spyOn(
      content.lastElementChild!,
      "getBoundingClientRect",
    ).mockReturnValue({ bottom: contentBottom } as DOMRect);

    return content;
  }

  it("adds postscript-clamped when hidden content exceeds a full line", () => {
    // 5 (default) lines * 20px budget = 100px; 130px of content leaves 30px
    // hidden, more than one 20px line.
    const content = postscriptContentElement({
      lineHeight: "20px",
      contentBottom: 130,
    });

    evaluatePostscriptPreviews(document);

    expect(content.classList.contains("postscript-clamped")).toBe(true);
  });

  it("does not add postscript-clamped when hidden content is a line or less", () => {
    // 100px budget; 110px of content leaves only 10px hidden, under one
    // 20px line — poetic's own preview would offer nothing to reveal.
    const content = postscriptContentElement({
      lineHeight: "20px",
      contentBottom: 110,
    });

    evaluatePostscriptPreviews(document);

    expect(content.classList.contains("postscript-clamped")).toBe(false);
  });

  it("removes an already-applied clamp once it no longer applies", () => {
    const content = postscriptContentElement({
      lineHeight: "20px",
      contentBottom: 110,
    });
    content.classList.add("postscript-clamped");

    evaluatePostscriptPreviews(document);

    expect(content.classList.contains("postscript-clamped")).toBe(false);
  });

  it("falls back to 1.2x font-size when line-height isn't a pixel value", () => {
    // lineHeight "normal" isn't parseable, so lineHeightPx falls back to
    // 1.2 * 16px = 19.2px; budget = 5 * 19.2 = 96px. 130px of content leaves
    // 34px hidden, more than one fallback line.
    const content = postscriptContentElement({
      lineHeight: "normal",
      fontSize: "16px",
      contentBottom: 130,
    });

    evaluatePostscriptPreviews(document);

    expect(content.classList.contains("postscript-clamped")).toBe(true);
  });

  it("respects a non-default data-preview-lines budget", () => {
    // 2 lines * 20px = 40px budget; 130px of content leaves 90px hidden.
    const content = postscriptContentElement({
      previewLines: 2,
      lineHeight: "20px",
      contentBottom: 130,
    });

    evaluatePostscriptPreviews(document);

    expect(content.classList.contains("postscript-clamped")).toBe(true);
  });

  it("does nothing when there is no postscript-content element", () => {
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML = "<p>No postscript here.</p>";

    expect(() => evaluatePostscriptPreviews(doc)).not.toThrow();
  });

  it("does nothing when the document has no defaultView", () => {
    // document.implementation.createHTMLDocument() produces a Document with
    // no browsing context (defaultView is null) — the shape a detached test
    // fixture has, distinct from a live iframe's contentDocument.
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML = '<div class="postscript-content"><p>Text</p></div>';

    expect(() => evaluatePostscriptPreviews(doc)).not.toThrow();
    expect(
      doc
        .querySelector(".postscript-content")!
        .classList.contains("postscript-clamped"),
    ).toBe(false);
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

// Regression coverage for issue #315: a left-clicked link inside the
// srcDoc-sandboxed preview would otherwise navigate the iframe itself in
// place, which the page's frame-src CSP directive blocks.
describe("wirePoemToggles body/postscript links", () => {
  const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

  afterEach(() => {
    openSpy.mockClear();
    document.body.innerHTML = "";
  });

  // The preview is a srcdoc iframe, whose base URL is its *container's* —
  // HTML's fallback base URL for `about:srcdoc`. A detached
  // `createHTMLDocument` would instead sit on `about:blank`, under which every
  // relative href resolves to a non-http(s) URL and so never reaches the
  // interception these tests are about; a real iframe document is what
  // reproduces what the browser does.
  function previewDocument(bodyHtml: string): Document {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument as Document;
    doc.body.innerHTML = bodyHtml;
    return doc;
  }

  function linkDocument(href: string): Document {
    return previewDocument(`<a href="${href}">syntax reference</a>`);
  }

  function clickIn(doc: Document, selector: string): MouseEvent {
    // Built from the document's own realm, as the browser would.
    const view = doc.defaultView as Window & typeof globalThis;
    const event = new view.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    doc.querySelector(selector)?.dispatchEvent(event);
    return event;
  }

  it("resolves a relative href against the container's base URL, not about:srcdoc", () => {
    const doc = previewDocument(`<a href="#x">x</a>`);
    expect(new URL("#x", doc.baseURI).protocol).toBe("http:");
  });

  it("opens an https link in a new tab instead of navigating the iframe", () => {
    const doc = linkDocument(
      "https://github.com/Poetic-Poems/poetic/blob/v6.3.0/docs/POEM-SYNTAX.md",
    );
    wirePoemToggles(doc);

    const event = clickIn(doc, "a");

    expect(event.defaultPrevented).toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      "https://github.com/Poetic-Poems/poetic/blob/v6.3.0/docs/POEM-SYNTAX.md",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("opens an http link in a new tab too", () => {
    const doc = linkDocument("http://example.com/notes");
    wirePoemToggles(doc);

    (doc.querySelector("a") as HTMLElement).click();

    expect(openSpy).toHaveBeenCalledWith(
      "http://example.com/notes",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("scrolls to an in-page anchor rather than opening a tab of the app", () => {
    const doc = previewDocument(
      `<a href="#some-heading">jump</a><h2 id="some-heading">Heading</h2>`,
    );
    const scrollIntoView = vi.fn();
    (
      doc.defaultView as Window & typeof globalThis
    ).Element.prototype.scrollIntoView = scrollIntoView;
    wirePoemToggles(doc);

    const event = clickIn(doc, "a");

    expect(event.defaultPrevented).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();
    expect(scrollIntoView.mock.instances[0]).toBe(
      doc.getElementById("some-heading"),
    );
  });

  it("matches a percent-encoded fragment against the element's decoded id", () => {
    const doc = previewDocument(
      `<a href="#caf%C3%A9">jump</a><h2 id="café">Café</h2>`,
    );
    const scrollIntoView = vi.fn();
    (
      doc.defaultView as Window & typeof globalThis
    ).Element.prototype.scrollIntoView = scrollIntoView;
    wirePoemToggles(doc);

    clickIn(doc, "a");

    expect(scrollIntoView.mock.instances[0]).toBe(doc.getElementById("café"));
  });

  it("does not throw and does not open on a fragment with no matching element", () => {
    const doc = previewDocument(`<a href="#">top</a>`);
    wirePoemToggles(doc);

    expect(() => clickIn(doc, "a")).not.toThrow();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("does not throw and does not open when the link has no href", () => {
    const doc = previewDocument(`<a>no href here</a>`);
    wirePoemToggles(doc);

    expect(() => clickIn(doc, "a")).not.toThrow();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("renders the example poem's syntax-reference link as a plain anchor and opens it via window.open", () => {
    const html = renderPoem(EXAMPLE_POEM);
    const sanitised = DOMPurify.sanitize(html, POEM_SANITIZE_CONFIG);
    const doc = previewDocument(sanitised);
    wirePoemToggles(doc);

    const link = Array.from(doc.querySelectorAll("a")).find(
      (a) => a.textContent === "syntax reference",
    );
    expect(link).toBeTruthy();

    link?.click();

    expect(openSpy).toHaveBeenCalledWith(
      POEM_SYNTAX_REFERENCE_URL,
      "_blank",
      "noopener,noreferrer",
    );
  });
});

// Regression coverage for TD-PPpfid-26081401: a modified click
// (Ctrl/Cmd/Shift/Alt) dispatches a plain `click`, so it used to be
// intercepted into an ordinary foreground tab regardless of what the poet
// asked for, and a middle-click dispatches `auxclick`, not `click`, so it
// wasn't intercepted at all and still renavigated the frame — issue #315's
// violation, surviving on that one gesture. The fix reads the frame
// element's live `sandbox` attribute to decide whether to fall through to
// native handling or intercept exactly like a plain left-click.
describe("wirePoemToggles modifier and auxiliary link clicks", () => {
  const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

  afterEach(() => {
    openSpy.mockClear();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  // Same real-iframe rationale as the describe block above: `doc.baseURI`
  // resolves like the browser's own srcdoc base, and — the part this suite
  // is actually about — `doc.defaultView.frameElement` is only readable
  // through a real nested browsing context, which is what the sandbox
  // fall-through decision reads.
  function previewDocument(bodyHtml: string, sandbox?: string): Document {
    const iframe = document.createElement("iframe");
    if (sandbox !== undefined) iframe.setAttribute("sandbox", sandbox);
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument as Document;
    doc.body.innerHTML = bodyHtml;
    return doc;
  }

  function linkDocument(sandbox: string | undefined, href: string): Document {
    return previewDocument(`<a href="${href}">syntax reference</a>`, sandbox);
  }

  function fire(
    doc: Document,
    type: "click" | "auxclick",
    init: MouseEventInit = {},
  ): MouseEvent {
    const view = doc.defaultView as Window & typeof globalThis;
    const event = new view.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    doc.querySelector("a")?.dispatchEvent(event);
    return event;
  }

  // A `click` event left unprevented makes jsdom itself schedule a real
  // navigation attempt (HTMLHyperlinkElementUtils-impl.js), which logs a
  // "Not implemented: navigation" error to the console once its timer fires
  // — harmless (the assertions below run first), but noisy. Fake timers
  // stop that timer from ever firing during the test.
  function fireUnpreventedClick(
    doc: Document,
    init: MouseEventInit,
  ): MouseEvent {
    vi.useFakeTimers();
    return fire(doc, "click", init);
  }

  const MODIFIERS: [string, MouseEventInit][] = [
    ["ctrlKey", { ctrlKey: true }],
    ["metaKey", { metaKey: true }],
    ["shiftKey", { shiftKey: true }],
    ["altKey", { altKey: true }],
  ];

  it.each(MODIFIERS)(
    "intercepts a %s+click into a foreground tab when the sandbox has no allow-popups",
    (_name, init) => {
      const doc = linkDocument(
        "allow-same-origin",
        "https://example.com/notes",
      );
      wirePoemToggles(doc);

      const event = fire(doc, "click", init);

      expect(event.defaultPrevented).toBe(true);
      expect(openSpy).toHaveBeenCalledWith(
        "https://example.com/notes",
        "_blank",
        "noopener,noreferrer",
      );
    },
  );

  it.each(MODIFIERS)(
    "lets a %s+click fall through natively when the sandbox grants allow-popups",
    (_name, init) => {
      const doc = linkDocument(
        "allow-scripts allow-same-origin allow-popups",
        "https://example.com/notes",
      );
      wirePoemToggles(doc);

      const event = fireUnpreventedClick(doc, init);

      expect(event.defaultPrevented).toBe(false);
      expect(openSpy).not.toHaveBeenCalled();
    },
  );

  it("falls through an unsandboxed frame (no sandbox attribute) on a modified click", () => {
    const doc = linkDocument(undefined, "https://example.com/notes");
    wirePoemToggles(doc);

    const event = fireUnpreventedClick(doc, { ctrlKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("intercepts a modified click when the frame element cannot be read (detached document)", () => {
    // document.implementation.createHTMLDocument() has no defaultView (see
    // the "body/postscript links" describe block above), the same "not
    // readable" case a cross-origin frameElement access would throw for —
    // both fall into the same never-leave-it-dead default.
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML = `<a href="https://example.com/notes">syntax reference</a>`;
    wirePoemToggles(doc);

    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    doc.querySelector("a")?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/notes",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("intercepts a middle-click (auxclick, button 1) into a foreground tab when the sandbox has no allow-popups", () => {
    const doc = linkDocument("allow-same-origin", "https://example.com/notes");
    wirePoemToggles(doc);

    const event = fire(doc, "auxclick", { button: 1 });

    expect(event.defaultPrevented).toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/notes",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("lets a middle-click (auxclick, button 1) fall through natively when the sandbox grants allow-popups", () => {
    const doc = linkDocument(
      "allow-scripts allow-same-origin allow-popups",
      "https://example.com/notes",
    );
    wirePoemToggles(doc);

    const event = fire(doc, "auxclick", { button: 1 });

    expect(event.defaultPrevented).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("does nothing on a right-click auxclick (button 2)", () => {
    const doc = linkDocument("allow-same-origin", "https://example.com/notes");
    wirePoemToggles(doc);

    const event = fire(doc, "auxclick", { button: 2 });

    expect(event.defaultPrevented).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("keeps a fragment link's scroll-and-preventDefault behaviour under a modified click", () => {
    const doc = previewDocument(
      `<a href="#some-heading">jump</a><h2 id="some-heading">Heading</h2>`,
      "allow-scripts allow-same-origin allow-popups",
    );
    const scrollIntoView = vi.fn();
    (
      doc.defaultView as Window & typeof globalThis
    ).Element.prototype.scrollIntoView = scrollIntoView;
    wirePoemToggles(doc);

    const event = fire(doc, "click", { ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("keeps a fragment link's scroll-and-preventDefault behaviour under a middle-click, at the cost of the frame's native autoscroll", () => {
    const doc = previewDocument(
      `<a href="#some-heading">jump</a><h2 id="some-heading">Heading</h2>`,
      "allow-scripts allow-same-origin allow-popups",
    );
    const scrollIntoView = vi.fn();
    (
      doc.defaultView as Window & typeof globalThis
    ).Element.prototype.scrollIntoView = scrollIntoView;
    wirePoemToggles(doc);

    const event = fire(doc, "auxclick", { button: 1 });

    expect(event.defaultPrevented).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("leaves a non-http(s) link untouched under a modified click", () => {
    const doc = linkDocument("allow-same-origin", "mailto:poet@example.com");
    wirePoemToggles(doc);

    const event = fireUnpreventedClick(doc, { ctrlKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("leaves a non-http(s) link untouched under a middle-click", () => {
    const doc = linkDocument("allow-same-origin", "mailto:poet@example.com");
    wirePoemToggles(doc);

    const event = fire(doc, "auxclick", { button: 1 });

    expect(event.defaultPrevented).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });
});
