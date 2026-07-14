import { describe, expect, it } from "vitest";
import { tryRenderPoem } from "./Editor";
import { EXAMPLE_POEM } from "@/lib/example-poem";

describe("tryRenderPoem", () => {
  it("renders the example poem", () => {
    const result = tryRenderPoem(EXAMPLE_POEM);
    expect(result.error).toBeNull();
    expect(result.html).toContain("Hello, poet");
  });

  it("reports a parse error without a previous render to fall back to", () => {
    const result = tryRenderPoem("not a valid poem at all");
    expect(result.error).not.toBeNull();
    expect(result.html).toBe("");
  });

  it("keeps the last good preview when a later edit fails to parse", () => {
    const good = tryRenderPoem(EXAMPLE_POEM);
    const bad = tryRenderPoem("not a valid poem at all", good.html);
    expect(bad.error).not.toBeNull();
    expect(bad.html).toBe(good.html);
  });
});
