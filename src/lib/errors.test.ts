import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("returns an Error's message", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("stringifies a non-Error thrown value", () => {
    expect(errorMessage("boom")).toBe("boom");
    expect(errorMessage(42)).toBe("42");
  });
});
