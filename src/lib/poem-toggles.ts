import { EMBED_ALLOWED_HOSTS } from "@/lib/embed-hosts";

// poetic's Analysis section and postscript preview (_poem-content.pug, upstream
// in the poetic repo) keep their expanded/selected state in `aria-expanded`,
// `aria-pressed` and `data-*` attributes, which poetic.css keys visibility off
// through attribute selectors; poetic's own poetic.js flips them from delegated
// click listeners. Fiddle never loads that script — the preview iframe grants
// no allow-scripts at all — so mirror those listeners here, reaching the
// document through allow-same-origin rather than by executing script inside the
// sandboxed content. Setting the same attributes (rather than inline styles or
// classes of Fiddle's own) is what keeps the CSS in charge of what is visible,
// so the preview matches a published page.

// Whether a modified/auxiliary click may fall through to the browser's own
// handling instead of being intercepted into a `window.open`, per the
// decision rule in TD-PPpfid-26081401: read from the frame element's *live*
// `sandbox` attribute at event time (rather than a parameter threaded through
// `wirePoemToggles`) so this can never drift out of step with the attribute
// docs/CSP-REVIEW-CHECKLIST.md exists to keep in review. `allow-same-origin`
// on both preview frames is what makes `frameElement` (and its `sandbox`
// attribute) readable at all from inside the iframe's own document.
function canFallThroughSandbox(doc: Document): boolean {
  let frameElement: Element | null;
  try {
    frameElement = doc.defaultView?.frameElement ?? null;
  } catch {
    // Cross-origin or otherwise unreadable — never leave the gesture dead.
    return false;
  }
  // No frame element at all: a detached document or a top-level window.
  if (!frameElement) return false;
  if (!frameElement.hasAttribute("sandbox")) return true;
  const tokens =
    frameElement.getAttribute("sandbox")?.trim().split(/\s+/) ?? [];
  return tokens.includes("allow-popups");
}

export function wirePoemToggles(doc: Document) {
  const handlePreviewClick = (event: MouseEvent) => {
    // Not `instanceof Element`: in the preview iframe these nodes come from
    // another realm, whose Element is a different constructor.
    const target = event.target as Element | null;
    if (typeof target?.closest !== "function") return;

    // Gesture-type gate for every branch below except the link branch: this
    // handler is shared by both `click` and `auxclick` (TD-PPpfid-26081401),
    // and none of the postscript toggle, analysis show/hide/selector, or
    // song-embed controls are links — they have no native "open in a new
    // tab/window" behaviour for a modified or middle-click to defer to, so a
    // plain, unmodified left-click is the only gesture that may run their
    // actions. The link branch further down still inspects these itself, to
    // decide between intercepting and falling through to native handling.
    const isAuxiliaryClick = event.type === "auxclick";
    const isModified =
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      isAuxiliaryClick;

    if (!isModified) {
      // poetic.css leaves `.postscript-content` unclamped by default and only
      // clamps (and reveals this toggle) once `evaluatePostscriptPreviews`
      // below has added `.postscript-clamped` — so a postscript short enough
      // to need no preview never reaches this handler with a visible control
      // at all.
      const postscriptToggle = target.closest(".postscript-toggle");
      if (postscriptToggle) {
        const contentId = postscriptToggle.getAttribute("aria-controls");
        const content = contentId ? doc.getElementById(contentId) : null;
        if (!content) return;

        const expanded =
          postscriptToggle.getAttribute("aria-expanded") === "true";
        postscriptToggle.setAttribute("aria-expanded", String(!expanded));
        content.classList.toggle("postscript-expanded", !expanded);
        // The visible label is poetic.css's ::after content, keyed off
        // aria-expanded; this span is the button's accessible name.
        const label = postscriptToggle.querySelector(".sr-only");
        if (label) label.textContent = expanded ? "See more" : "See less";
        return;
      }

      const showButton = target.closest(".analysis.show");
      if (showButton) {
        showButton.setAttribute("aria-expanded", "true");
        return;
      }

      const hideButton = target.closest(".analysis.hide");
      if (hideButton) {
        const showButtonId = hideButton.getAttribute("data-analysis-toggle");
        if (showButtonId) {
          doc
            .getElementById(showButtonId)
            ?.setAttribute("aria-expanded", "false");
        }
        return;
      }

      const selectButton = target.closest(".analysis.selector");
      const group = selectButton?.closest(".full-or-synopsis-selector");
      if (selectButton && group) {
        const panel = selectButton.getAttribute("data-analysis-select");
        if (panel) group.setAttribute("data-selected", panel);
        group.querySelectorAll(".analysis.selector").forEach((button) => {
          button.setAttribute("aria-pressed", String(button === selectButton));
        });
        return;
      }

      // poetic.js (never loaded here) is what would normally turn this
      // button into an always-visible player (see render-share.ts, which
      // does the same server-side for the share page's "full player", AC25).
      // The editor preview only owes a best-effort representation, so
      // instead of loading a player script into the preview sandbox (which
      // would need allow-scripts, weighed against AC86 and out of scope
      // here), a click opens the embed in a new tab — keeping the button's
      // clickable styling honest rather than leaving it dead
      // (TD-PPpfid-26072603). window.open runs here in the parent page's own
      // realm, not the sandboxed preview's, so this new tab is Fiddle's own
      // doing, not the iframe content's.
      const embedButton = target.closest(".song-embed-btn[data-embed-src]");
      if (embedButton) {
        const src = embedButton.getAttribute("data-embed-src");
        if (!src) return;

        let url: URL;
        try {
          url = new URL(src);
        } catch {
          return;
        }
        // Same allow-list enforcement as render-share.ts's activation gate
        // (embed-hosts.ts) — a poet's audio value can only ever fill the
        // URL's path, never its origin, but this is still checked explicitly
        // rather than trusted implicitly.
        if (
          url.protocol !== "https:" ||
          !EMBED_ALLOWED_HOSTS.has(url.hostname.toLowerCase())
        ) {
          return;
        }
        window.open(url.toString(), "_blank", "noopener,noreferrer");
        return;
      }
    }

    // Any other clicked link (the postscript's Markdown links, e.g. the
    // syntax-reference link in EXAMPLE_POEM, are the common case) would
    // otherwise navigate the sandboxed iframe itself in place — which the
    // page's own frame-src CSP directive blocks, since frame-src governs
    // renavigating an existing nested browsing context just as much as
    // framing one initially (issue #315). Opening it from here runs in the
    // parent page's own realm, exactly like the embed button above, so it's
    // Fiddle's own window.open rather than a frame navigation and never hits
    // frame-src at all.
    const link = target.closest("a[href]");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href) return;

    // An in-page anchor is the one link that must not become a new tab. A
    // srcdoc document's base URL is its *container's* — HTML's fallback base
    // URL for `about:srcdoc` — not the frame's own, so `#id` resolves to a
    // URL on Fiddle's origin rather than to anything in this document: the
    // browser would navigate the frame there (frame-src again) and a
    // window.open would spawn a pointless second copy of the app. Scrolling
    // this document is what the anchor actually means.
    if (href.startsWith("#")) {
      event.preventDefault();
      const raw = href.slice(1);
      if (!raw) return;
      let id = raw;
      try {
        id = decodeURIComponent(raw);
      } catch {
        // A malformed escape is not a URL-encoded id; match it literally.
      }
      const anchor = doc.getElementById(id) ?? doc.getElementById(raw);
      // Guarded because a realm without layout (jsdom, in this file's tests)
      // implements no scrollIntoView.
      if (typeof anchor?.scrollIntoView === "function") anchor.scrollIntoView();
      return;
    }

    let url: URL;
    try {
      url = new URL(href, doc.baseURI);
    } catch {
      return;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return;

    // A plain left-click always gets today's interception. A modified click
    // (Ctrl/Cmd/Shift/Alt) or a middle-click (auxclick, button 1) asks for a
    // background tab or a new window, which native handling gives for free —
    // but only where the frame's sandbox permits it (TD-PPpfid-26081401): a
    // sandboxed frame without `allow-popups` would otherwise swallow the
    // gesture and leave it dead, which is worse than the foreground tab a
    // plain left-click already settles for. `isModified`/`isAuxiliaryClick`
    // are computed once, at the top of this handler, and gate the non-link
    // branches above too.
    if (isModified && canFallThroughSandbox(doc)) return;

    event.preventDefault();
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  doc.addEventListener("click", handlePreviewClick);
  // Middle-click dispatches `auxclick`, not `click`, so it never reached
  // handlePreviewClick at all before this — the frame-src violation issue
  // #315 fixed for the plain left-click, surviving on that one gesture
  // (TD-PPpfid-26081401). Right-click does not reliably produce `auxclick`,
  // and the browser's own "Open link in new tab" context-menu item already
  // works (issue #319), so only button 1 (middle) is handled here.
  doc.addEventListener("auxclick", (event) => {
    if (event.button !== 1) return;
    handlePreviewClick(event);
  });
}

// The debounce interval poetic.js itself uses for its resize listener —
// kept in step with published pages rather than chosen independently.
export const POSTSCRIPT_RESIZE_DEBOUNCE_MS = 150;

// Mirrors poetic.js's evaluatePostscriptPreview()/evaluateAllPostscriptPreviews():
// poetic.css leaves `.postscript-content` unclamped by default so a
// postscript degrades to fully expanded with no script, and this adds
// `.postscript-clamped` (which both applies the clamp and, via poetic.css's
// adjacent-sibling selector, reveals the toggle) once rendered layout is
// known. Fiddle never loads poetic.js (see wirePoemToggles above), so this
// has to run here instead, driven by the same iframe `load` and `resize`
// events poetic.js itself listens for. Reaches computed style and layout
// through `doc.defaultView`, not the parent window's globals: these nodes
// come from another realm, the same reason wirePoemToggles avoids
// `instanceof Element`.
export function evaluatePostscriptPreviews(doc: Document) {
  const view = doc.defaultView;
  if (!view) return;

  doc.querySelectorAll(".postscript-content").forEach((el) => {
    const previewLines =
      parseFloat(el.getAttribute("data-preview-lines") ?? "") || 5;
    const style = view.getComputedStyle(el);
    let lineHeightPx = parseFloat(style.lineHeight);
    if (Number.isNaN(lineHeightPx)) {
      lineHeightPx = 1.2 * parseFloat(style.fontSize);
    }
    const budgetPx = previewLines * lineHeightPx;

    // Measure the true bottom of rendered content, excluding the trailing
    // margin of the last child, which scrollHeight would count as hidden
    // and show a pointless toggle for.
    const last = el.lastElementChild;
    const contentPx = last
      ? last.getBoundingClientRect().bottom - el.getBoundingClientRect().top
      : el.scrollHeight;
    const hiddenPx = contentPx - budgetPx;

    // Only clamp — and so offer the toggle — when it would reveal at least a
    // full line of real text.
    el.classList.toggle("postscript-clamped", hiddenPx > lineHeightPx);
  });
}
