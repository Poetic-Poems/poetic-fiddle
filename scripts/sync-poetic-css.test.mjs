import { describe, expect, it } from "vitest";
import { stripHiddenTitleRule } from "./sync-poetic-css.mjs";

describe("stripHiddenTitleRule", () => {
  it("removes the poem title's display:none rule", () => {
    const css = `.poem-info {
  color: red;
}
.poem-info .title, .poem-info #title {
  display: none;
}
.poem-info .author {
  color: blue;
}`;

    const result = stripHiddenTitleRule(css);

    expect(result).not.toMatch(/display:\s*none/);
    expect(result).toContain(".poem-info .author");
  });

  it("throws if the rule can't be found, instead of silently no-op'ing", () => {
    const css = `.poem-info .title {
  font-weight: bold;
}`;

    expect(() => stripHiddenTitleRule(css)).toThrow(/no match/);
  });
});
