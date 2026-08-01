import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import Editor from "./Editor";
import { makeSession, resetEditorTestState } from "./editor-test-support";
import { useSession } from "@/lib/use-session";

vi.mock("@/lib/use-session", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/supabase-client", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

// jsdom's <iframe> doesn't implement real cross-window postMessage, which is
// how axe-core recurses into frame content — letting it try crashes with
// "Respondable target must be a frame in the current window". The preview
// pane's sandboxed iframe has its own accessible title (PoemPreview.tsx);
// what this suite checks is the editor chrome around it, so skip recursing
// into frames rather than into the iframe element itself.
const AXE_OPTIONS = { iframes: false };

// jsdom has no real layout/rendering engine, so axe-core's color-contrast
// rule silently doesn't run under it at all (TD-PPpfid-26080109) — this
// suite catches labelling/structure defects, not contrast regressions.

describe("Editor accessibility (TD-PPpfid-26072435)", () => {
  it("has no axe violations when signed out", async () => {
    resetEditorTestState();
    vi.mocked(useSession).mockReturnValue(null);
    const { container } = render(<Editor poeticCss="" />);

    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
  });

  it("has no axe violations when signed in", async () => {
    resetEditorTestState();
    vi.mocked(useSession).mockReturnValue(makeSession());
    const { container } = render(<Editor poeticCss="" />);

    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
  });
});
