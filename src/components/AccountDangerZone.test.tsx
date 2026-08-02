import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { AccountDangerZone } from "./AccountDangerZone";
import { deleteAccount } from "@/lib/account";

vi.mock("@/lib/account", () => ({
  deleteAccount: vi.fn(),
}));

const signOut = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-client", () => ({
  supabase: { auth: { signOut } },
}));

const SESSION = { user: { email: "poet@example.com" } } as Session;

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));
}

let originalLocation: Location;

beforeEach(() => {
  originalLocation = window.location;
  // jsdom's default navigation isn't implemented (and prints noisily); this
  // component deliberately does a full navigation on success (see its own
  // comment), so stub `location` to observe that without jsdom trying — and
  // failing — to actually navigate.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, href: "" },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
  vi.clearAllMocks();
});

describe("AccountDangerZone", () => {
  it("shows a warning and keeps delete disabled until the account's own email is typed", () => {
    render(<AccountDangerZone session={SESSION} />);
    openDialog();

    expect(
      screen.getByText(/deleting your account is irreversible/i),
    ).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", {
      name: /delete account forever/i,
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "someone-else@example.com" },
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "poet@example.com" },
    });
    expect(confirmButton).toBeEnabled();
  });

  it("matches the confirmation email case-insensitively", () => {
    render(<AccountDangerZone session={SESSION} />);
    openDialog();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "POET@EXAMPLE.COM" },
    });

    expect(
      screen.getByRole("button", { name: /delete account forever/i }),
    ).toBeEnabled();
  });

  it("deletes the account, signs out, and navigates home on confirm", async () => {
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    signOut.mockResolvedValue({ error: null });
    render(<AccountDangerZone session={SESSION} />);
    openDialog();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "poet@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /delete account forever/i }),
    );

    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    await waitFor(() => expect(window.location.href).toBe("/"));
  });

  it("shows an error and does not sign out or navigate when deletion fails", async () => {
    vi.mocked(deleteAccount).mockRejectedValue(
      new Error("Couldn't delete your account — please try again."),
    );
    render(<AccountDangerZone session={SESSION} />);
    openDialog();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "poet@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /delete account forever/i }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't delete your account/i);
    expect(signOut).not.toHaveBeenCalled();
    expect(window.location.href).toBe("");
  });

  it("closes the confirmation without deleting when Cancel is clicked", () => {
    render(<AccountDangerZone session={SESSION} />);
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /delete account forever/i }),
    ).not.toBeInTheDocument();
  });
});
