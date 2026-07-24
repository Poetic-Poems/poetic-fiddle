"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthError } from "@/lib/auth-error";
import { supabase } from "@/lib/supabase-client";

interface SignInPromptProps {
  action: "save" | "share" | null;
  onClose: () => void;
}

const COPY: Record<"save" | "share", string> = {
  save: "your account",
  share: "a link",
};

type PasswordMode = "sign-in" | "sign-up";

type Status =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "error"; message: string }
  | { kind: "info"; message: string };

const inputClassName =
  "w-full rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/10";

export function SignInPrompt({ action, onClose }: SignInPromptProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (action && !dialog.open) dialog.showModal();
    if (!action && dialog.open) dialog.close();
  }, [action]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="w-full max-w-xs rounded-lg border border-black/10 bg-background p-6 text-foreground backdrop:bg-black/40 dark:border-white/10"
    >
      {/* Keyed by action so each time the dialog opens, the form below
          mounts fresh — resetting its fields without a reset effect. */}
      {action && <SignInForm key={action} action={action} onClose={onClose} />}
    </dialog>
  );
}

interface SignInFormProps {
  action: "save" | "share";
  onClose: () => void;
}

function SignInForm({ action, onClose }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("sign-in");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleMagicLink(event: FormEvent) {
    event.preventDefault();
    setStatus({ kind: "pending" });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setStatus(
      error
        ? { kind: "error", message: new AuthError(error).message }
        : { kind: "info", message: "Check your inbox for a sign-in link." },
    );
  }

  async function handleGoogle() {
    setStatus({ kind: "pending" });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error)
      setStatus({ kind: "error", message: new AuthError(error).message });
  }

  async function handlePassword(event: FormEvent) {
    event.preventDefault();
    setStatus({ kind: "pending" });
    const result =
      passwordMode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (result.error) {
      setStatus({
        kind: "error",
        message: new AuthError(result.error).message,
      });
      return;
    }
    if (result.data.session) {
      onClose();
      return;
    }
    setStatus({
      kind: "info",
      message: "Check your email to confirm your account, then sign in.",
    });
  }

  const pending = status.kind === "pending";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-serif text-lg font-semibold">Sign in to {action}</p>
        <p className="mt-2 text-sm text-foreground/70">
          Your poem stays right here in this browser. Sign in to save it to{" "}
          {COPY[action]}.
        </p>
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={pending}
        className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
      >
        Continue with Google
      </button>

      <form onSubmit={handleMagicLink} className="flex flex-col gap-2">
        <label htmlFor="signin-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClassName}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Send magic link
        </button>
      </form>

      <details className="text-sm">
        <summary className="cursor-pointer text-foreground/70">
          Use a password instead
        </summary>
        <form onSubmit={handlePassword} className="mt-2 flex flex-col gap-2">
          <label htmlFor="signin-password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="signin-password"
            type="password"
            required
            minLength={6}
            autoComplete={
              passwordMode === "sign-in" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClassName}
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
          >
            {passwordMode === "sign-in" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            onClick={() =>
              setPasswordMode((mode) =>
                mode === "sign-in" ? "sign-up" : "sign-in",
              )
            }
            className="text-left text-foreground/70 underline underline-offset-2"
          >
            {passwordMode === "sign-in"
              ? "New here? Create a password instead"
              : "Already have an account? Sign in"}
          </button>
        </form>
      </details>

      {status.kind === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {status.message}
        </p>
      )}
      {status.kind === "info" && (
        <p role="status" className="text-sm text-foreground/70">
          {status.message}
        </p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="text-sm text-foreground/70 underline underline-offset-2"
      >
        Close
      </button>
    </div>
  );
}
