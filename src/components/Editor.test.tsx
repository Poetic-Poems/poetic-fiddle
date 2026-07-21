import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Editor, { tryRenderPoem } from "./Editor";
import { EXAMPLE_POEM } from "@/lib/example-poem";

vi.mock("@/lib/use-session", () => ({
  useSession: () => null,
}));

vi.mock("@/lib/supabase-client", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

describe("Editor keyboard operability (AC75, AC79)", () => {
  it("documents the Esc-then-Tab escape hatch next to the editor", () => {
    render(<Editor poeticCss="" />);
    expect(
      screen.getByText(/Press Esc, then Tab, to move focus out of it/),
    ).toBeInTheDocument();
  });
});

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
