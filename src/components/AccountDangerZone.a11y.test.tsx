import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import type { Session } from "@supabase/supabase-js";
import { AccountDangerZone } from "./AccountDangerZone";

vi.mock("@/lib/account", () => ({
  deleteAccount: vi.fn(),
  exportAccountData: vi.fn(),
}));

vi.mock("@/lib/revalidate-share", () => ({
  revalidateSharedPoem: vi.fn(),
}));

vi.mock("@/lib/supabase-client", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

const SESSION = { user: { email: "poet@example.com" } } as Session;

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

describe("AccountDangerZone accessibility", () => {
  it("has no axe violations when the account deletion dialog is open", async () => {
    const { container } = render(<AccountDangerZone session={SESSION} />);

    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
