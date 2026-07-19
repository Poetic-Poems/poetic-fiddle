import { describe, expect, it } from "vitest";
import { renderPoem } from "poetic/browser";
import { sanitizeSharedPoemHtml } from "./render-share";

const POEM_WITH_EMBEDS = `Embed Test
A Poet
2026-07-17

{Verse}
<<<
<script>window.pwned = true;</script>
<button type="button" onclick="alert('hi')">Click</button>
>>>
Hello world.

====

Audiomack: my-artist/my-song
Mega: FileId123#Key456 (audio)
Suno: s/SongLink12345678

====
`;

const POEM_WITHOUT_EMBEDS = `Plain Poem
A Poet
2026-07-17

{Verse}
Just words, nothing more.
`;

// poetic's restricted title inline-markup (v6.1.1): *em*, **strong**,
// ~~struck~~ (double-tilde, corrected from v6.1.0's single-tilde syntax,
// which this app deliberately never shipped — see the poetic-6.1.1 bump).
const POEM_WITH_TITLE_MARKUP = `*Em* **Strong** ~~Struck~~ Title
A Poet
2026-07-19

{Verse}
Hello world.
`;

const POEM_WITH_LITERAL_TILDE_TITLE = `A ~single~ tilde title
A Poet
2026-07-19

{Verse}
Hello world.
`;

describe("sanitizeSharedPoemHtml", () => {
  it("strips scripts and inline event handlers (poetic performs no sanitisation itself)", () => {
    const html = renderPoem(POEM_WITH_EMBEDS);
    const clean = sanitizeSharedPoemHtml(html);

    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).toContain("Click");
    expect(clean).toContain("Hello world.");
  });

  it("activates allow-listed embeds into real, visible, sandboxed iframes (AC25, AC86)", () => {
    const html = renderPoem(POEM_WITH_EMBEDS);
    const clean = sanitizeSharedPoemHtml(html);

    // Audiomack and Mega both declare embed_url — both become a real iframe.
    const iframeCount = (clean.match(/<iframe/g) || []).length;
    expect(iframeCount).toBe(2);
    expect(clean).toContain(
      'src="https://audiomack.com/embed/my-artist/song/my-song"',
    );
    expect(clean).toContain('src="https://mega.nz/embed/FileId123#Key456"');
    expect(clean).toContain(
      'sandbox="allow-scripts allow-same-origin allow-popups"',
    );
    // The player is no longer hidden behind a click-to-load button.
    expect(clean).not.toContain("song-embed-btn");
    expect(clean).not.toMatch(/song-embed-player[^>]*\bhidden\b/);
  });

  it("leaves a link-only handler (Suno declares no embed_url) as a plain link", () => {
    const html = renderPoem(POEM_WITH_EMBEDS);
    const clean = sanitizeSharedPoemHtml(html);

    expect(clean).toContain("suno.com/s/SongLink12345678");
  });

  it("is a no-op on a poem with no song handlers", () => {
    const html = renderPoem(POEM_WITHOUT_EMBEDS);
    const clean = sanitizeSharedPoemHtml(html);

    expect(clean).not.toContain("<iframe");
    expect(clean).toContain("Just words, nothing more.");
  });

  it("keeps the restricted title inline markup (em/strong/s) through sanitisation", () => {
    const html = renderPoem(POEM_WITH_TITLE_MARKUP);

    // The renderer itself emits the tags in the visible h2.poem-title heading.
    expect(html).toContain(
      '<h2 class="poem-title"><em>Em</em> <strong>Strong</strong> <s>Struck</s> Title</h2>',
    );

    const clean = sanitizeSharedPoemHtml(html);

    // DOMPurify's default config (used here, and by the live PoemPreview
    // iframe) keeps these three tags — sanitisation is not what would strip
    // them, so this asserts the title markup genuinely survives the
    // untrusted-content boundary, not just the renderer's own output.
    expect(clean).toContain(
      '<h2 class="poem-title"><em>Em</em> <strong>Strong</strong> <s>Struck</s> Title</h2>',
    );
  });

  it("leaves a single ~tilde~ in a title as literal text (double-tilde only, v6.1.1)", () => {
    const html = renderPoem(POEM_WITH_LITERAL_TILDE_TITLE);

    expect(html).toContain(
      '<h2 class="poem-title">A ~single~ tilde title</h2>',
    );
    expect(html).not.toContain("<s>single</s>");

    const clean = sanitizeSharedPoemHtml(html);
    expect(clean).toContain(
      '<h2 class="poem-title">A ~single~ tilde title</h2>',
    );
  });

  it("never turns an arbitrary data-embed-src into an iframe (host allow-list)", () => {
    // A hostile-shaped fragment mimicking the song-embed markup but pointed
    // off the allow-list — the transform must ignore it, not trust the
    // attribute blindly.
    const hostile = `<div class="song-embed"><button class="song-embed-btn" data-embed-src="https://evil.example/embed">Load</button><div class="song-embed-player hidden"></div></div>`;

    const clean = sanitizeSharedPoemHtml(hostile);

    // The unrecognised host is never promoted into an iframe src — the
    // button (and its inert data-attribute) is left exactly as it was.
    expect(clean).not.toContain("<iframe");
  });
});
