import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { POSTSCRIPT_RESIZE_DEBOUNCE_MS } from "@/lib/poem-toggles";
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

// The srcDoc's own <meta> CSP re-states the song-embed host allow-list as a
// second, browser-enforced line of defence (AC86); embed-hosts.ts is where
// every copy of that list comes from. Asserted against literal origins here,
// as proxy.test.ts does for the site-wide policy, so that a change to the
// shared list has to be a deliberate one in both consumers' tests.
describe("SharedPoemView srcDoc frame-src", () => {
  it("allow-lists the song-embed hosts the sanitiser activates embeds for", () => {
    const { container } = render(
      <NonceProvider nonce={null}>
        <SharedPoemView html="<p>A poem.</p>" css="" title="A shared poem" />
      </NonceProvider>,
    );

    const srcDoc = container.querySelector("iframe")!.getAttribute("srcdoc")!;
    const frameSrc = /frame-src ([^;"]+);/.exec(srcDoc)![1];

    expect(frameSrc).toContain("https://mega.nz");
    expect(frameSrc).toContain("https://audiomack.com");
  });
});

// The share page owes the same clamp the editor preview does, so it has to
// reach for its iframe's document on load and again on resize — the wiring,
// not evaluatePostscriptPreviews itself, which poem-toggles.test.ts exercises
// in full (short/long/fallback/data-preview-lines cases). jsdom never loads a
// srcdoc iframe's content, so the document a real browser would build is
// stubbed onto the iframe, shaped like what sanitizeSharedPoemHtml
// (render-share.ts) emits into `html`, and the `load` event fired by hand.
describe("SharedPoemView postscript wiring", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // A 5-line budget at 20px per line is 100px, so a `contentBottom` above
  // 120px is more than a line hidden and clamps; jsdom computes no layout, so
  // both rects the measurement reads are stubbed.
  function stubShareDocument(
    iframe: HTMLIFrameElement,
    contentBottom: number,
  ): HTMLElement {
    const doc = document.implementation.createHTMLDocument("share");
    doc.body.innerHTML = `
      <div class="postscript-content" style="--preview-lines: 5" data-preview-lines="5">
        <p>A postscript.</p>
      </div>
    `;
    // createHTMLDocument() has no browsing context, so no defaultView — the
    // one thing a live iframe's contentDocument has that this fixture lacks.
    Object.defineProperty(doc, "defaultView", {
      value: window,
      configurable: true,
    });
    Object.defineProperty(iframe, "contentDocument", {
      value: doc,
      configurable: true,
    });

    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      lineHeight: "20px",
      fontSize: "16px",
    } as CSSStyleDeclaration);

    const content = doc.querySelector<HTMLElement>(".postscript-content")!;
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue({
      top: 0,
    } as DOMRect);
    vi.spyOn(
      content.lastElementChild!,
      "getBoundingClientRect",
    ).mockReturnValue({ bottom: contentBottom } as DOMRect);
    return content;
  }

  function renderShare(): HTMLIFrameElement {
    const { container } = render(
      <NonceProvider nonce="test-nonce-456">
        <SharedPoemView html="<p>A poem.</p>" css="" title="A shared poem" />
      </NonceProvider>,
    );
    return container.querySelector("iframe")!;
  }

  it("clamps a long postscript when the share iframe loads", () => {
    const iframe = renderShare();
    const content = stubShareDocument(iframe, 130);

    fireEvent.load(iframe);

    expect(content.classList.contains("postscript-clamped")).toBe(true);
  });

  it("does not clamp a postscript short enough that hiding it would show one line or less", () => {
    const iframe = renderShare();
    // 100px budget (5 * 20px); 110px of content leaves only 10px hidden.
    const content = stubShareDocument(iframe, 110);

    fireEvent.load(iframe);

    expect(content.classList.contains("postscript-clamped")).toBe(false);
  });

  it("re-evaluates on a window resize, debounced", () => {
    vi.useFakeTimers();
    const iframe = renderShare();
    const content = stubShareDocument(iframe, 110);
    fireEvent.load(iframe);
    expect(content.classList.contains("postscript-clamped")).toBe(false);

    vi.spyOn(
      content.lastElementChild!,
      "getBoundingClientRect",
    ).mockReturnValue({ bottom: 130 } as DOMRect);
    fireEvent(window, new Event("resize"));

    vi.advanceTimersByTime(POSTSCRIPT_RESIZE_DEBOUNCE_MS - 1);
    expect(content.classList.contains("postscript-clamped")).toBe(false);

    vi.advanceTimersByTime(1);
    expect(content.classList.contains("postscript-clamped")).toBe(true);
  });

  // Asserted against the listener identity rather than "nothing happens after
  // unmount": the ref is null by then, so a leaked listener would find no
  // document and look identical — while still accumulating one listener per
  // mount for the life of the page.
  it("removes its resize listener on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(
      <NonceProvider nonce="test-nonce-456">
        <SharedPoemView html="<p>A poem.</p>" css="" title="A shared poem" />
      </NonceProvider>,
    );
    const handler = addSpy.mock.calls.find(
      ([type]) => type === "resize",
    )?.[1] as EventListener;
    expect(handler).toBeDefined();

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("resize", handler);
  });
});
