import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { AccountDangerZone } from "./AccountDangerZone";
import { deleteAccount, exportAccountData } from "@/lib/account";
import { revalidateSharedPoem } from "@/lib/revalidate-share";

vi.mock("@/lib/account", () => ({
  deleteAccount: vi.fn(),
  exportAccountData: vi.fn(),
}));

vi.mock("@/lib/revalidate-share", () => ({
  revalidateSharedPoem: vi.fn(),
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
  // jsdom doesn't implement the object-URL registry; the export button only
  // needs these called, not a working blob: URL.
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
  // jsdom has no `download` attribute support, so a real anchor.click() on a
  // blob: href tries — and fails, noisily — to navigate the test document.
  // The export button only needs the click to happen, not a real download.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
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
    vi.mocked(deleteAccount).mockResolvedValue([]);
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

  it("invalidates each deleted poem's share page so its permalink stops serving from cache", async () => {
    vi.mocked(deleteAccount).mockResolvedValue(["share-a", "share-b"]);
    vi.mocked(revalidateSharedPoem).mockResolvedValue(undefined);
    signOut.mockResolvedValue({ error: null });
    render(<AccountDangerZone session={SESSION} />);
    openDialog();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "poet@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /delete account forever/i }),
    );

    await waitFor(() =>
      expect(revalidateSharedPoem).toHaveBeenCalledWith("share-a"),
    );
    expect(revalidateSharedPoem).toHaveBeenCalledWith("share-b");
    await waitFor(() => expect(window.location.href).toBe("/"));
  });

  it("still signs out and navigates when a share invalidation fails", async () => {
    vi.mocked(deleteAccount).mockResolvedValue(["share-a"]);
    vi.mocked(revalidateSharedPoem).mockRejectedValue(new Error("no cache"));
    signOut.mockResolvedValue({ error: null });
    render(<AccountDangerZone session={SESSION} />);
    openDialog();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "poet@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /delete account forever/i }),
    );

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

  it("refuses Escape while the delete is in flight, so a failure is still shown in the dialog", async () => {
    let failDelete: (error: Error) => void = () => {};
    vi.mocked(deleteAccount).mockReturnValue(
      new Promise((_resolve, reject) => {
        failDelete = reject;
      }),
    );
    const { container } = render(<AccountDangerZone session={SESSION} />);
    openDialog();

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "poet@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /delete account forever/i }),
    );
    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());

    const dialog = container.querySelector("dialog")!;
    const cancelled = fireEvent(
      dialog,
      new Event("cancel", { cancelable: true }),
    );
    expect(cancelled).toBe(false);

    failDelete(new Error("Couldn't delete your account — please try again."));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't delete your account/i);
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

  it("exports and downloads the archive via an object URL", async () => {
    const blob = new Blob(["archive bytes"]);
    vi.mocked(exportAccountData).mockResolvedValue({
      blob,
      filename: "poetic-fiddle-export-2026.tar.gz",
    });
    render(<AccountDangerZone session={SESSION} />);

    fireEvent.click(
      screen.getByRole("button", { name: /^export your data$/i }),
    );

    await waitFor(() => expect(exportAccountData).toHaveBeenCalled());
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("shows an error and does not create a download when export fails", async () => {
    vi.mocked(exportAccountData).mockRejectedValue(
      new Error("Couldn't export your data — please try again."),
    );
    render(<AccountDangerZone session={SESSION} />);

    fireEvent.click(
      screen.getByRole("button", { name: /^export your data$/i }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't export your data/i);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
