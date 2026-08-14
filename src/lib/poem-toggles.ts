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
export function wirePoemToggles(doc: Document) {
  doc.addEventListener("click", (event) => {
    // Not `instanceof Element`: in the preview iframe these nodes come from
    // another realm, whose Element is a different constructor.
    const target = event.target as Element | null;
    if (typeof target?.closest !== "function") return;

    // poetic.css leaves `.postscript-content` unclamped by default and only
    // clamps (and reveals this toggle) once `evaluatePostscriptPreviews`
    // below has added `.postscript-clamped` — so a postscript short enough to
    // need no preview never reaches this handler with a visible control at
    // all.
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

    // poetic.js (never loaded here) is what would normally turn this button
    // into an always-visible player (see render-share.ts, which does the same
    // server-side for the share page's "full player", AC25). The editor
    // preview only owes a best-effort representation, so instead of loading a
    // player script into the preview sandbox (which would need allow-scripts,
    // weighed against AC86 and out of scope here), a click opens the embed in
    // a new tab — keeping the button's clickable styling honest rather than
    // leaving it dead (TD-PPpfid-26072603). window.open runs here in the
    // parent page's own realm, not the sandboxed preview's, so this new tab is
    // Fiddle's own doing, not the iframe content's.
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
      // (embed-hosts.ts) — a poet's audio value can only ever fill the URL's
      // path, never its origin, but this is still checked explicitly rather
      // than trusted implicitly.
      if (
        url.protocol !== "https:" ||
        !EMBED_ALLOWED_HOSTS.has(url.hostname.toLowerCase())
      ) {
        return;
      }
      window.open(url.toString(), "_blank", "noopener,noreferrer");
      return;
    }

    // Any other left-clicked link (the postscript's Markdown links, e.g. the
    // syntax-reference link in EXAMPLE_POEM, are the common case) would
    // otherwise navigate the sandboxed iframe itself in place — which the
    // page's own frame-src CSP directive blocks, since frame-src governs
    // renavigating an existing nested browsing context just as much as
    // framing one initially (issue #315). Opening it from here runs in the
    // parent page's own realm, exactly like the embed button above, so it's
    // Fiddle's own window.open rather than a frame navigation and never hits
    // frame-src at all. In-page anchors (`href="#..."`) resolve against the
    // srcDoc's `about:srcdoc` base to a non-http(s) URL and fall through
    // un-intercepted, so they still scroll normally.
    const link = target.closest("a[href]");
    if (link) {
      const href = link.getAttribute("href");
      if (!href) return;

      let url: URL;
      try {
        url = new URL(href, doc.baseURI);
      } catch {
        return;
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") return;

      event.preventDefault();
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    }
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
