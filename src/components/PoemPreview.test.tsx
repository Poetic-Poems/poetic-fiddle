import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { PoemPreview } from "./PoemPreview";
import { POSTSCRIPT_RESIZE_DEBOUNCE_MS } from "@/lib/poem-toggles";
import { NonceProvider } from "@/lib/nonce-context";

// The clamp is only right if the component actually reaches for the preview
// document — on load and again on resize. jsdom never loads a srcdoc iframe's
// content (its contentDocument stays empty), so the document a real browser
// would build is stubbed onto the iframe and the `load` event fired by hand;
// what is under test is PoemPreview's wiring, not jsdom's iframe support.
//
// jsdom also never lays elements out, so it never fires a real
// ResizeObserver either — a mock class captures the callback PoemPreview
// registers, letting tests invoke it directly to stand in for both a window
// resize and the hidden -> visible pane transition a real ResizeObserver
// reports for (unlike a window `resize` listener, which fires for neither).
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

describe("PoemPreview postscript wiring", () => {
  // Not vi.restoreAllMocks(): see the note in the evaluatePostscriptPreviews
  // block above — it would tear down the module-level window.open spy the
  // song-embed block sets up once.
  const globalSpies: { mockRestore: () => void }[] = [];

  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    globalSpies.splice(0).forEach((spy) => spy.mockRestore());
  });

  // Stubs the document a loaded preview iframe would expose, with layout
  // (which jsdom never computes) standing in as fixed rects: a 5-line budget
  // at 20px per line is 100px, so `contentBottom` above 120px is more than a
  // line hidden and clamps.
  function stubPreviewDocument(
    iframe: HTMLIFrameElement,
    contentBottom: number,
  ): HTMLElement {
    const doc = document.implementation.createHTMLDocument("preview");
    doc.body.innerHTML =
      '<div class="postscript-content"><p>A postscript.</p></div>';
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

    globalSpies.push(
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        lineHeight: "20px",
        fontSize: "16px",
      } as CSSStyleDeclaration),
    );

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

  function renderPreview(): {
    iframe: HTMLIFrameElement;
    observer: MockResizeObserver;
  } {
    const { container } = render(
      <NonceProvider nonce="test-nonce-123">
        <PoemPreview html="<p>A poem.</p>" css="" />
      </NonceProvider>,
    );
    const observer =
      MockResizeObserver.instances[MockResizeObserver.instances.length - 1];
    return { iframe: container.querySelector("iframe")!, observer };
  }

  it("clamps a long postscript when the preview iframe loads", () => {
    const { iframe } = renderPreview();
    const content = stubPreviewDocument(iframe, 130);

    fireEvent.load(iframe);

    expect(content.classList.contains("postscript-clamped")).toBe(true);
  });

  it("leaves a short postscript unclamped when the preview iframe loads", () => {
    const { iframe } = renderPreview();
    const content = stubPreviewDocument(iframe, 110);

    fireEvent.load(iframe);

    expect(content.classList.contains("postscript-clamped")).toBe(false);
  });

  it("observes the iframe for size changes", () => {
    const { iframe, observer } = renderPreview();

    expect(observer.observe).toHaveBeenCalledWith(iframe);
  });

  // The editor's mobile preview pane keeps this iframe permanently mounted
  // and toggles it between `display: none` and visible with a class switch
  // (Editor.tsx's `mobileView`), rather than mounting/unmounting it or
  // reloading its srcDoc. Neither `load` nor a window `resize` fires on that
  // transition, but the iframe's rendered box goes from zero to its real
  // size, which is exactly what a ResizeObserver on the iframe reports —
  // this is what TD-PPpfid-26080403 covers: deleting the ResizeObserver
  // wiring (or reverting to the window `resize` listener it replaced) turns
  // this red, because nothing else re-measures the pane when it appears.
  it("re-evaluates when the previously-hidden pane becomes visible, not only on the next srcDoc reload", () => {
    vi.useFakeTimers();
    const { iframe, observer } = renderPreview();
    // Loaded while the pane was hidden (a zero-size box in a real browser),
    // measuring as unclamped; the pane then becomes visible with content
    // tall enough to clamp, without a fresh `load`.
    const content = stubPreviewDocument(iframe, 110);
    fireEvent.load(iframe);
    expect(content.classList.contains("postscript-clamped")).toBe(false);

    vi.spyOn(
      content.lastElementChild!,
      "getBoundingClientRect",
    ).mockReturnValue({ bottom: 130 } as DOMRect);
    observer.trigger();

    vi.advanceTimersByTime(POSTSCRIPT_RESIZE_DEBOUNCE_MS - 1);
    expect(content.classList.contains("postscript-clamped")).toBe(false);

    vi.advanceTimersByTime(1);
    expect(content.classList.contains("postscript-clamped")).toBe(true);
  });

  it("coalesces a burst of size-change reports into one evaluation", () => {
    vi.useFakeTimers();
    const { iframe, observer } = renderPreview();
    const content = stubPreviewDocument(iframe, 130);
    const evaluated = vi.spyOn(content, "getBoundingClientRect");

    for (let i = 0; i < 5; i++) {
      observer.trigger();
      vi.advanceTimersByTime(POSTSCRIPT_RESIZE_DEBOUNCE_MS - 1);
    }
    vi.advanceTimersByTime(1);

    expect(evaluated).toHaveBeenCalledTimes(1);
  });

  // Asserted against the observer instance rather than "nothing happens
  // after unmount": the ref is null by then, so a leaked observer would find
  // no document and look identical — while still accumulating one observer
  // per mount for the life of the page.
  it("disconnects its ResizeObserver on unmount", () => {
    const { unmount } = render(
      <NonceProvider nonce="test-nonce-123">
        <PoemPreview html="<p>A poem.</p>" css="" />
      </NonceProvider>,
    );
    const observer =
      MockResizeObserver.instances[MockResizeObserver.instances.length - 1];
    expect(observer.disconnect).not.toHaveBeenCalled();

    unmount();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
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
