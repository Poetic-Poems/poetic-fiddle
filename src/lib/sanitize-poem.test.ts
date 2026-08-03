import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";
import { POEM_SANITIZE_CONFIG } from "./sanitize-poem";

/**
 * The policy is exercised through both shapes its two call sites use, so a
 * change to POEM_SANITIZE_CONFIG that only one context tolerates fails here
 * rather than in production: the live preview's client-side string call
 * (`PoemPreview.tsx`, DOMPurify's browser build) and the share page's
 * server-side fragment call (`render-share.ts`, DOMPurify against a jsdom
 * `window`, `RETURN_DOM_FRAGMENT`). What each context then *does* with the
 * clean markup is its own tests' business; this covers only the boundary
 * both share.
 */
function sanitiseAsPreview(html: string): string {
  return DOMPurify.sanitize(html, POEM_SANITIZE_CONFIG);
}

function sanitiseAsSharePage(html: string): string {
  const { window } = new JSDOM("");
  const fragment = DOMPurify(window).sanitize(html, {
    ...POEM_SANITIZE_CONFIG,
    RETURN_DOM_FRAGMENT: true,
  });
  const container = window.document.createElement("div");
  container.appendChild(fragment);
  return container.innerHTML;
}

const CONTEXTS: ReadonlyArray<[string, (html: string) => string]> = [
  ["client (live preview)", sanitiseAsPreview],
  ["server (share page)", sanitiseAsSharePage],
];

for (const [context, sanitise] of CONTEXTS) {
  describe(`POEM_SANITIZE_CONFIG, ${context}`, () => {
    it("drops <script> without taking the surrounding poem with it", () => {
      const clean = sanitise(
        '<div class="verse"><p>A line.</p><script>window.pwned = true;</script></div>',
      );

      expect(clean).not.toContain("<script");
      expect(clean).not.toContain("window.pwned");
      expect(clean).toContain("<p>A line.</p>");
    });

    it("drops inline event handlers but keeps the element", () => {
      const clean = sanitise(
        '<button type="button" onclick="alert(1)">Load</button>',
      );

      expect(clean).not.toContain("onclick");
      expect(clean).toContain("<button");
    });

    it("drops <iframe> — the share page mints its own, allow-listed", () => {
      const clean = sanitise(
        '<iframe src="https://evil.example/embed"></iframe>',
      );

      expect(clean).not.toContain("<iframe");
    });

    it("keeps the inline style attributes poetic's sizing relies on (issue #119)", () => {
      const clean = sanitise(
        '<div class="song-embed-player" style="--song-embed-height: 252px"></div>',
      );

      expect(clean).toContain('style="--song-embed-height: 252px"');
    });

    it("keeps the data-* attributes the embed and toggle markup carries", () => {
      const clean = sanitise(
        '<button class="song-embed-btn" data-embed-src="https://player.example/x" data-title="A song">Load</button>',
      );

      expect(clean).toContain('data-embed-src="https://player.example/x"');
      expect(clean).toContain('data-title="A song"');
    });

    it("keeps the restricted inline markup a poem title may use", () => {
      const clean = sanitise(
        '<h2 class="poem-title"><em>Em</em> <strong>Strong</strong> <s>Struck</s> Title</h2>',
      );

      expect(clean).toContain(
        '<h2 class="poem-title"><em>Em</em> <strong>Strong</strong> <s>Struck</s> Title</h2>',
      );
    });
  });
}
