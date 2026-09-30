import { describe, expect, it, vi } from "vitest";
import { derivePoemTitle } from "./poem-title";
import { EXAMPLE_POEM } from "@/lib/example-poem";
import { parseAndAugment } from "poetic/browser";

vi.mock("poetic/browser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("poetic/browser")>();
  return { ...actual, parseAndAugment: vi.fn(actual.parseAndAugment) };
});

describe("derivePoemTitle", () => {
  it("returns an empty title when the parser doesn't return a string title", () => {
    // parseAndAugment always either returns a string title or throws (never
    // observed to return a non-string title for any real source), so this
    // exercises the ternary's false branch directly via the parser's own
    // dependency seam rather than hunting for a natural input that hits it.
    vi.mocked(parseAndAugment).mockReturnValueOnce({
      title: undefined,
    } as unknown as ReturnType<typeof parseAndAugment>);

    expect(derivePoemTitle("irrelevant source")).toBe("");
  });
  it("derives the title from the poem header", () => {
    expect(derivePoemTitle(EXAMPLE_POEM)).toBe(
      "Hello, poet — Welcome to Poetic Fiddle",
    );
  });

  it("returns an empty title for source that doesn't parse yet", () => {
    // Half-written poems still save, so this must not throw.
    expect(derivePoemTitle("not a valid poem at all")).toBe("");
    expect(derivePoemTitle("")).toBe("");
  });

  it("keeps a title's restricted inline markup as literal source, not rendered HTML", () => {
    // poetic renders title markup (*em*/**strong**/~~struck~~) only into the
    // separate `titleHtml` field for the visible heading; `title` — what
    // derivePoemTitle reads — stays the raw, unmodified source text (used for
    // <title>, slugs, Open Graph, etc.), so no <em>/<strong>/<s> tag ever
    // leaks into it.
    const source = `*Em* **Strong** ~~Struck~~ Title
A Poet
2026-07-19

{Verse}
Hello world.
`;
    const title = derivePoemTitle(source);
    expect(title).toBe("*Em* **Strong** ~~Struck~~ Title");
    expect(title).not.toMatch(/<\/?(em|strong|s)>/);
  });
});
