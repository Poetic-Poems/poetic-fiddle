import { describe, expect, it } from "vitest";
import { wireAnalysisToggles } from "./PoemPreview";

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
