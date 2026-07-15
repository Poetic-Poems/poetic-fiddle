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
});
