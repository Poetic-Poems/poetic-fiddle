import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/supabase-client", () => ({
  supabase: { auth: authMock },
}));

import { SignInPrompt } from "./SignInPrompt";

function openPasswordSection() {
  fireEvent.click(screen.getByText(/use a password instead/i));
}

describe("SignInPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers magic-link email, Google, and a password fallback (AC11)", () => {
    render(<SignInPrompt action="save" onClose={() => {}} />);
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send magic link/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/use a password instead/i)).toBeInTheDocument();
  });

  it("sends a magic link to the entered email", async () => {
    authMock.signInWithOtp.mockResolvedValue({ error: null });
    render(<SignInPrompt action="save" onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "poet@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() =>
      expect(authMock.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: "poet@example.com" }),
      ),
    );
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
  });

  it("starts the Google OAuth redirect", async () => {
    authMock.signInWithOAuth.mockResolvedValue({ error: null });
    render(<SignInPrompt action="save" onClose={() => {}} />);

    fireEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() =>
      expect(authMock.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "google" }),
      ),
    );
  });

  it("signs in with email and password, closing the dialog on success", async () => {
    const onClose = vi.fn();
    authMock.signInWithPassword.mockResolvedValue({
      data: { session: {} },
      error: null,
    });
    render(<SignInPrompt action="save" onClose={onClose} />);

    openPasswordSection();
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "poet@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "hunter2222" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(authMock.signInWithPassword).toHaveBeenCalledWith({
        email: "poet@example.com",
        password: "hunter2222",
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows an error when password sign-in fails", async () => {
    authMock.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });
    render(<SignInPrompt action="save" onClose={() => {}} />);

    openPasswordSection();
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "poet@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid login credentials/i,
    );
  });

  it("switches to sign-up and shows a confirmation message when no session is returned", async () => {
    authMock.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    render(<SignInPrompt action="save" onClose={() => {}} />);

    openPasswordSection();
    fireEvent.click(screen.getByText(/new here\? create a password instead/i));
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "poet@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "hunter2222" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(authMock.signUp).toHaveBeenCalledWith({
        email: "poet@example.com",
        password: "hunter2222",
      }),
    );
    expect(
      await screen.findByText(/check your email to confirm/i),
    ).toBeInTheDocument();
  });
});
