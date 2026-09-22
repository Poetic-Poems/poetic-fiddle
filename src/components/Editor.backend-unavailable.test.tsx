import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Editor from "./Editor";
import { loadPoem } from "@/lib/poems-store";
import { useSession } from "@/lib/use-session";
import { useBackendHealth } from "@/lib/use-backend-health";
import { makeSession, resetEditorTestState } from "./editor-test-support";

vi.mock("@/lib/poems-store", () => ({
  loadPoem: vi.fn(),
  savePoem: vi.fn(),
}));

vi.mock("@/lib/use-session", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/use-backend-health", () => ({
  useBackendHealth: vi.fn(),
}));

vi.mock("@/lib/supabase-client", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

const SESSION = makeSession();

beforeEach(resetEditorTestState);

function unavailable(retry = vi.fn()) {
  vi.mocked(useBackendHealth).mockReturnValue({
    status: "unavailable",
    retry,
  });
}

describe("Editor with the backend unavailable (issue #422)", () => {
  it("shows a status banner explaining sign-in and saving are unavailable", () => {
    vi.mocked(useSession).mockReturnValue({ session: null, loading: false });
    unavailable();

    render(<Editor poeticCss="" />);

    const message = screen.getByText(/aren.t available right now/i);
    expect(message.closest('[role="status"]')).toBeInTheDocument();
  });

  it("disables Save and Share, without ever opening the sign-in prompt", () => {
    vi.mocked(useSession).mockReturnValue({ session: null, loading: false });
    unavailable();

    render(<Editor poeticCss="" />);

    const saveButton = screen.getByRole("button", { name: "Save" });
    const shareButton = screen.getByRole("button", { name: "Share" });
    expect(saveButton).toBeDisabled();
    expect(shareButton).toBeDisabled();

    fireEvent.click(saveButton);
    fireEvent.click(shareButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides the account chrome and remix selector for a stale signed-in session (AC3)", () => {
    vi.mocked(useSession).mockReturnValue({ session: SESSION, loading: false });
    unavailable();

    render(<Editor poeticCss="" />);

    expect(screen.queryByText(SESSION.user.email!)).not.toBeInTheDocument();
    expect(screen.queryByText(/remixing this poem/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /my poems/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the unavailable banner instead of a raw error when a saved poem fails to open (issue #429)", async () => {
    vi.mocked(useSession).mockReturnValue({ session: SESSION, loading: false });
    vi.mocked(loadPoem).mockRejectedValue(new Error("network error"));
    const retry = vi.fn();
    unavailable(retry);

    render(<Editor poeticCss="" initialPoemId="poem-1" />);

    const message = await screen.findByText(/aren.t available right now/i);
    expect(message.closest('[role="status"]')).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalledTimes(1);

    expect(
      screen.getByRole("link", { name: /back to my poems/i }),
    ).toHaveAttribute("href", "/poems");
  });

  it("re-probes when Try again is clicked", () => {
    vi.mocked(useSession).mockReturnValue({ session: null, loading: false });
    const retry = vi.fn();
    unavailable(retry);

    render(<Editor poeticCss="" />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows no banner and behaves as usual while the probe is still checking", () => {
    vi.mocked(useSession).mockReturnValue({ session: SESSION, loading: false });
    vi.mocked(useBackendHealth).mockReturnValue({
      status: "checking",
      retry: vi.fn(),
    });

    render(<Editor poeticCss="" />);

    expect(
      screen.queryByText(/aren.t available right now/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
    expect(screen.getByText(SESSION.user.email!)).toBeInTheDocument();
  });

  it("behaves as usual once the backend is available", () => {
    vi.mocked(useSession).mockReturnValue({ session: SESSION, loading: false });
    vi.mocked(useBackendHealth).mockReturnValue({
      status: "available",
      retry: vi.fn(),
    });

    render(<Editor poeticCss="" />);

    expect(
      screen.queryByText(/aren.t available right now/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
    expect(screen.getByText(SESSION.user.email!)).toBeInTheDocument();
  });
});
