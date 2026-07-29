import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import DOMPurify from "dompurify";
import { renderPoem } from "poetic/browser";
import { PoemPreview, wireAnalysisToggles } from "./PoemPreview";
import { NonceProvider } from "@/lib/nonce-context";

// Mirrors the markup poetic's _poem-content.pug emits for an Analysis
// section (github.com/Poetic-Poems/poetic src/templates/_poem-content.pug)
// once DOMPurify.sanitize() has stripped the onclick handlers.
const ANALYSIS_HTML = `
  <button class="analysis show" id="show-analysis--test-poem" type="button">
    Show analysis
  </button>
  <div class="analysis" id="analysis--test-poem">
    <button class="analysis hide" id="hide-analysis--test-poem" type="button">
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
// section that has both {Synopsis} and {Full} content, once
// DOMPurify.sanitize() has stripped the onclick handlers.
const SELECTOR_HTML = `
  <div class="analysis" id="analysis--test-poem">
    <div class="full-or-synopsis-selector">
      <button class="analysis selector selected" id="analysis-select-syno--test-poem" type="button">
        Synopsis
      </button>
      <button class="analysis selector" id="analysis-select-full--test-poem" type="button">
        Full Analysis
      </button>
    </div>
    <div id="analysis-syno--test-poem">
      <h2>Analysis (synopsis)</h2>
      <p>Synopsis text.</p>
    </div>
    <div id="analysis-full--test-poem" class="hidden">
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

describe("wireAnalysisToggles", () => {
  it("shows the panel and hides the show button on click", () => {
    const doc = analysisDocument();
    wireAnalysisToggles(doc);

    const showButton = doc.getElementById("show-analysis--test-poem")!;
    const panel = doc.getElementById("analysis--test-poem")!;

    (showButton as HTMLElement).click();

    expect(panel.style.display).toBe("block");
    expect(showButton.style.display).toBe("none");
  });

  it("hides the panel and restores the show button on click", () => {
    const doc = analysisDocument();
    wireAnalysisToggles(doc);

    const showButton = doc.getElementById("show-analysis--test-poem")!;
    const hideButton = doc.getElementById("hide-analysis--test-poem")!;
    const panel = doc.getElementById("analysis--test-poem")!;

    (showButton as HTMLElement).click();
    (hideButton as HTMLElement).click();

    expect(panel.style.display).toBe("none");
    expect(showButton.style.display).toBe("block");
  });

  it("does nothing when there is no Analysis section", () => {
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML = "<p>No analysis here.</p>";

    expect(() => wireAnalysisToggles(doc)).not.toThrow();
  });

  it("switches to the full analysis and marks its button selected", () => {
    const doc = selectorDocument();
    wireAnalysisToggles(doc);

    const synoButton = doc.getElementById("analysis-select-syno--test-poem")!;
    const fullButton = doc.getElementById("analysis-select-full--test-poem")!;
    const synoPanel = doc.getElementById("analysis-syno--test-poem")!;
    const fullPanel = doc.getElementById("analysis-full--test-poem")!;

    (fullButton as HTMLElement).click();

    expect(synoPanel.classList.contains("hidden")).toBe(true);
    expect(fullPanel.classList.contains("hidden")).toBe(false);
    expect(synoButton.classList.contains("selected")).toBe(false);
    expect(fullButton.classList.contains("selected")).toBe(true);
  });

  it("switches back to the synopsis and marks its button selected", () => {
    const doc = selectorDocument();
    wireAnalysisToggles(doc);

    const synoButton = doc.getElementById("analysis-select-syno--test-poem")!;
    const fullButton = doc.getElementById("analysis-select-full--test-poem")!;
    const synoPanel = doc.getElementById("analysis-syno--test-poem")!;
    const fullPanel = doc.getElementById("analysis-full--test-poem")!;

    (fullButton as HTMLElement).click();
    (synoButton as HTMLElement).click();

    expect(synoPanel.classList.contains("hidden")).toBe(false);
    expect(fullPanel.classList.contains("hidden")).toBe(true);
    expect(synoButton.classList.contains("selected")).toBe(true);
    expect(fullButton.classList.contains("selected")).toBe(false);
  });
});

// The ANALYSIS_HTML/SELECTOR_HTML fixtures above are hand-copied from
// poetic's _poem-content.pug, so a template change there could silently
// desync the fixture from what poetic actually emits (the failure mode
// behind TD26071401/TD26071602). This pipes a real .poem source with an
// {Analysis} block through poetic's own renderPoem(), the same way
// PoemPreview does, to exercise wireAnalysisToggles against genuine output.
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

describe("wireAnalysisToggles against real poetic output", () => {
  function realAnalysisDocument(): Document {
    const html = renderPoem(POEM_WITH_ANALYSIS);
    const sanitised = DOMPurify.sanitize(html);
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML = sanitised;
    return doc;
  }

  it("strips the onclick handlers poetic emits, leaving the buttons for wireAnalysisToggles to rewire", () => {
    const html = renderPoem(POEM_WITH_ANALYSIS);
    expect(html).toContain("onclick=");

    const doc = realAnalysisDocument();
    expect(doc.body.innerHTML).not.toContain("onclick");
  });

  it("shows the analysis panel and hides the show button on click", () => {
    const doc = realAnalysisDocument();
    wireAnalysisToggles(doc);

    const showButton = doc.getElementById(
      "show-analysis--analysis-wiring-test",
    )!;
    const panel = doc.getElementById("analysis--analysis-wiring-test")!;

    (showButton as HTMLElement).click();

    expect(panel.style.display).toBe("block");
    expect(showButton.style.display).toBe("none");
  });

  it("hides the analysis panel and restores the show button on click", () => {
    const doc = realAnalysisDocument();
    wireAnalysisToggles(doc);

    const showButton = doc.getElementById(
      "show-analysis--analysis-wiring-test",
    )!;
    const hideButton = doc.getElementById(
      "hide-analysis--analysis-wiring-test",
    )!;
    const panel = doc.getElementById("analysis--analysis-wiring-test")!;

    (showButton as HTMLElement).click();
    (hideButton as HTMLElement).click();

    expect(panel.style.display).toBe("none");
    expect(showButton.style.display).toBe("block");
  });

  it("switches from the synopsis to the full analysis and marks its button selected", () => {
    const doc = realAnalysisDocument();
    wireAnalysisToggles(doc);

    const synoButton = doc.getElementById(
      "analysis-select-syno--analysis-wiring-test",
    )!;
    const fullButton = doc.getElementById(
      "analysis-select-full--analysis-wiring-test",
    )!;
    const synoPanel = doc.getElementById(
      "analysis-syno--analysis-wiring-test",
    )!;
    const fullPanel = doc.getElementById(
      "analysis-full--analysis-wiring-test",
    )!;

    // poetic renders the synopsis selected and the full panel hidden by
    // default (both declared, `analysis.synopsis && analysis.full`).
    expect(synoButton.classList.contains("selected")).toBe(true);
    expect(fullPanel.classList.contains("hidden")).toBe(true);

    (fullButton as HTMLElement).click();

    expect(synoPanel.classList.contains("hidden")).toBe(true);
    expect(fullPanel.classList.contains("hidden")).toBe(false);
    expect(synoButton.classList.contains("selected")).toBe(false);
    expect(fullButton.classList.contains("selected")).toBe(true);
    expect(fullPanel.textContent).toContain("The full analysis text.");
  });

  it("switches back to the synopsis and marks its button selected", () => {
    const doc = realAnalysisDocument();
    wireAnalysisToggles(doc);

    const synoButton = doc.getElementById(
      "analysis-select-syno--analysis-wiring-test",
    )!;
    const fullButton = doc.getElementById(
      "analysis-select-full--analysis-wiring-test",
    )!;
    const synoPanel = doc.getElementById(
      "analysis-syno--analysis-wiring-test",
    )!;
    const fullPanel = doc.getElementById(
      "analysis-full--analysis-wiring-test",
    )!;

    (fullButton as HTMLElement).click();
    (synoButton as HTMLElement).click();

    expect(synoPanel.classList.contains("hidden")).toBe(false);
    expect(fullPanel.classList.contains("hidden")).toBe(true);
    expect(synoButton.classList.contains("selected")).toBe(true);
    expect(fullButton.classList.contains("selected")).toBe(false);
    expect(synoPanel.textContent).toContain("A short synopsis.");
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
  // attributes (issue #119) — DOMPurify's default config (used here) keeps
  // them, so this asserts the value genuinely survives the sanitisation
  // step, not just that the site CSP (unexercised by jsdom) would allow it.
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
