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
});
