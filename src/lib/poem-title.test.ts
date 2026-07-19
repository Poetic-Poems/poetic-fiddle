import { describe, expect, it } from "vitest";
import { derivePoemTitle } from "./poem-title";
import { EXAMPLE_POEM } from "@/lib/example-poem";

describe("derivePoemTitle", () => {
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
