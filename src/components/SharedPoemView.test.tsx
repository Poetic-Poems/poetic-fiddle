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

// escapeHtml itself isn't exported — SharedPoemView is its only caller, and
// the only place it runs is on `title` in the srcDoc's <title> element, so
// these assert against that rendered output rather than the private
// function directly.
describe("SharedPoemView title escaping (escapeHtml)", () => {
  function titleOf(container: HTMLElement): string {
    const iframe = container.querySelector("iframe")!;
    const srcDoc = iframe.getAttribute("srcdoc")!;
    return /<title>([\s\S]*?)<\/title>/.exec(srcDoc)![1];
  }

  function renderWithTitle(title: string): string {
    const { container } = render(
      <NonceProvider nonce={null}>
        <SharedPoemView html="<p>A poem.</p>" css="" title={title} />
      </NonceProvider>,
    );
    return titleOf(container);
  }

  it("escapes angle brackets so a title can't inject markup", () => {
    expect(renderWithTitle("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("escapes ampersands", () => {
    expect(renderWithTitle("Rock & Roll")).toBe("Rock &amp; Roll");
  });

  it("escapes double and single quotes", () => {
    expect(renderWithTitle(`She said "hi", y'all`)).toBe(
      "She said &quot;hi&quot;, y&#39;all",
    );
  });

  it("re-escapes an already-encoded entity instead of decoding it", () => {
    expect(renderWithTitle("&amp;")).toBe("&amp;amp;");
  });

  it("returns an empty title unchanged", () => {
    expect(renderWithTitle("")).toBe("");
  });

  it("escapes every special character in a long, repeated title", () => {
    const title = "<b>&'\"</b>".repeat(200);
    const escaped = renderWithTitle(title);

    expect(escaped).toBe("&lt;b&gt;&amp;&#39;&quot;&lt;/b&gt;".repeat(200));
    expect(escaped).not.toContain("<b>");
  });
});
