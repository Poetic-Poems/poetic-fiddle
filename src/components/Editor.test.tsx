import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Editor, { tryRenderPoem } from "./Editor";
import { EXAMPLE_POEM } from "@/lib/example-poem";

vi.mock("@/lib/use-session", () => ({
  useSession: () => ({ session: null, loading: false }),
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

  it("gives the editor's content-editable element an accessible name (AC79)", () => {
    render(<Editor poeticCss="" />);
    expect(
      screen.getByRole("textbox", { name: /your poem/i }),
    ).toBeInTheDocument();
  });
});

describe("Mobile source/preview toggle (AC26, AC83)", () => {
  function panes() {
    return {
      source: screen.getByTestId("mobile-pane-source"),
      preview: screen.getByTestId("mobile-pane-preview"),
    };
  }

  it("shows the source pane and hides the preview pane by default", () => {
    render(<Editor poeticCss="" />);
    const { source, preview } = panes();
    expect(source).toHaveClass("flex");
    expect(source).not.toHaveClass("hidden");
    expect(preview).toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Source" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switches to the preview pane when the Preview toggle is pressed", () => {
    render(<Editor poeticCss="" />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    const { source, preview } = panes();
    expect(preview).toHaveClass("flex");
    expect(preview).not.toHaveClass("hidden");
    expect(source).toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Source" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("keeps both panes visible on desktop widths regardless of toggle state", () => {
    render(<Editor poeticCss="" />);
    const { source, preview } = panes();
    expect(source).toHaveClass("lg:flex");
    expect(preview).toHaveClass("lg:flex");
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
