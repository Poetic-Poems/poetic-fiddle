import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SharedPoemView } from "./SharedPoemView";
import { NonceProvider } from "@/lib/nonce-context";

// A srcdoc iframe inherits the parent document's CSP in addition to its own
// <meta> CSP (issue #97) — the top-level policy's style-src requires a
// nonce, so the <style> tag SharedPoemView writes into srcDoc must carry it
// even though the <meta> tag's own style-src already allows 'unsafe-inline'.
describe("SharedPoemView srcDoc nonce", () => {
  function srcDocOf(container: HTMLElement): string {
    const iframe = container.querySelector("iframe")!;
    return iframe.getAttribute("srcdoc")!;
  }

  it("carries the request nonce on the inline <style> element", () => {
    const { container } = render(
      <NonceProvider nonce="test-nonce-456">
        <SharedPoemView
          html="<p>A poem.</p>"
          css="p { color: blue; }"
          title="A shared poem"
        />
      </NonceProvider>,
    );

    expect(srcDocOf(container)).toContain(
      '<style nonce="test-nonce-456">p { color: blue; }</style>',
    );
  });

  it('omits the nonce attribute rather than rendering nonce="null" when there is no nonce', () => {
    const { container } = render(
      <NonceProvider nonce={null}>
        <SharedPoemView
          html="<p>A poem.</p>"
          css="p { color: blue; }"
          title="A shared poem"
        />
      </NonceProvider>,
    );

    const srcDoc = srcDocOf(container);
    expect(srcDoc).toContain("<style>p { color: blue; }</style>");
    expect(srcDoc).not.toContain("null");
  });
});
