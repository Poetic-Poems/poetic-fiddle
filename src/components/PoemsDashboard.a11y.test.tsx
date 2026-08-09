import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import type { Session } from "@supabase/supabase-js";
import { PoemsDashboard } from "./PoemsDashboard";
import { getRemixDefault, listPoems } from "@/lib/poems-store";
import { useSession } from "@/lib/use-session";

vi.mock("@/lib/poems-store", () => ({
  deletePoem: vi.fn(),
  getRemixDefault: vi.fn(),
  listPoems: vi.fn(),
  updateRemixDefault: vi.fn(),
}));

vi.mock("@/lib/use-session", () => ({
  useSession: vi.fn(),
}));

const SESSION = {
  user: { id: "user-1", email: "poet@example.com" },
} as Session;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRemixDefault).mockResolvedValue(false);
});

describe("PoemsDashboard accessibility (TD-PPpfid-26072435)", () => {
  it("has no axe violations when signed out", async () => {
    vi.mocked(useSession).mockReturnValue({ session: null, loading: false });
    const { container } = render(<PoemsDashboard />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations with a loaded, non-empty poem list", async () => {
    vi.mocked(useSession).mockReturnValue({ session: SESSION, loading: false });
    vi.mocked(listPoems).mockResolvedValue([
      {
        id: "poem-1",
        title: "Ode to a Fiddle",
        updatedAt: "2026-07-16T00:00:00Z",
        shareId: "abc123",
      },
      {
        id: "poem-2",
        title: "",
        updatedAt: "2026-07-15T00:00:00Z",
        shareId: null,
      },
    ]);
    const { container, findByRole } = render(<PoemsDashboard />);

    await findByRole("link", { name: /ode to a fiddle/i });

    expect(await axe(container)).toHaveNoViolations();
  });
});
