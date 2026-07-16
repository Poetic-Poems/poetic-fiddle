import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";
import { renderPoem } from "poetic/browser";

/**
 * Hosts poetic's builtin song handlers can point an embed at (see poetic's
 * `src/song-handlers.yaml`). Fiddle passes no `config.song_handlers` to
 * `renderPoem` (there is no `.poetic-config.yaml` UI), so every
 * `data-embed-src` this module ever sees is built from one of these two
 * fixed URL templates — a poet's audio value can only fill the *path*, never
 * the origin. This allow-list is still enforced explicitly (AC86), rather
 * than trusted implicitly, as the defence that actually matters if that
 * assumption ever stops holding.
 */
const EMBED_ALLOWED_HOSTS = new Set(["mega.nz", "audiomack.com"]);

/**
 * Sandboxed just enough for a media player to work (script execution, and
 * same-origin storage/cookies of the *embed's own* origin — never Fiddle's,
 * since this iframe's `src` is a different origin entirely) while denying
 * top-level navigation and everything else (AC86).
 */
const EMBED_SANDBOX = "allow-scripts allow-same-origin allow-popups";

/**
 * Renders a poem's HTML fragment for the share page: sanitises it as the
 * untrusted-content boundary (poetic performs none — see
 * poetic/docs/RENDERER-BROWSER.md), then activates each song-handler embed
 * into a real, always-visible, allow-listed iframe so the share page shows
 * the full player rather than the editor preview's click-to-load button
 * (AC25). Runs server-side via jsdom, since there is no browser DOM at SSR
 * time.
 */
export function sanitizeSharedPoemHtml(rawHtml: string): string {
  const { window } = new JSDOM("");
  const purify = DOMPurify(window);
  const document = window.document;

  // Default config: no <script>, no on* handlers, no <iframe> — the poem's
  // own song-embed markup is just buttons/divs with data-* attributes at
  // this point (poetic.js, which Fiddle never loads, is what would normally
  // turn them into iframes — see poetic's song-handlers.js), so it survives
  // sanitisation intact and unexploitable.
  const clean = purify.sanitize(rawHtml, { RETURN_DOM_FRAGMENT: true });

  const container = document.createElement("div");
  container.appendChild(clean);

  container
    .querySelectorAll<HTMLButtonElement>(".song-embed-btn[data-embed-src]")
    .forEach((button) => {
      const src = button.getAttribute("data-embed-src");
      const wrapper = button.closest(".song-embed");
      const player = wrapper?.querySelector(".song-embed-player");
      if (!src || !wrapper || !player) return;

      let url: URL;
      try {
        url = new URL(src);
      } catch {
        return;
      }
      if (
        url.protocol !== "https:" ||
        !EMBED_ALLOWED_HOSTS.has(url.hostname.toLowerCase())
      ) {
        return;
      }

      const iframe = document.createElement("iframe");
      iframe.src = url.toString();
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer";
      iframe.setAttribute("sandbox", EMBED_SANDBOX);
      iframe.title = button.getAttribute("data-title") || "Embedded player";
      const allow = button.getAttribute("data-allow");
      if (allow) iframe.setAttribute("allow", allow);
      if (button.getAttribute("data-allow-fullscreen") === "true") {
        iframe.allowFullscreen = true;
      }

      player.replaceChildren(iframe);
      player.classList.remove("hidden");
      button.remove();
    });

  return container.innerHTML;
}

/**
 * The share page's full read-to-render path: parse + render + sanitise +
 * activate embeds, tolerant of source that doesn't parse. A saved poem's
 * `source_text` is never validated at save time (M5 — a half-written poem
 * must still save), and Share can be clicked straight after pasting broken
 * source, so the share page must degrade to a friendly message rather than
 * a 500 (matching the editor's own `tryRenderPoem` posture).
 */
export function renderSharedPoemHtml(source: string): {
  html: string;
  error: boolean;
} {
  try {
    return { html: sanitizeSharedPoemHtml(renderPoem(source)), error: false };
  } catch {
    return { html: "", error: true };
  }
}
