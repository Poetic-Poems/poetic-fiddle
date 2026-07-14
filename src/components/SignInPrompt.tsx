"use client";

import { useEffect, useRef } from "react";

interface SignInPromptProps {
  action: "save" | "share" | null;
  onClose: () => void;
}

const COPY: Record<"save" | "share", string> = {
  save: "your account",
  share: "a link",
};

/**
 * Sign-in isn't wired up yet (M4) — this stands in for that flow so Save/Share
 * gate on an account (AC10) without prompting during ordinary editing (AC7).
 */
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
      className="rounded-lg border border-black/10 bg-background p-6 text-foreground backdrop:bg-black/40 dark:border-white/10"
    >
      {action && (
        <>
          <p className="font-serif text-lg font-semibold">
            Sign in to {action}
          </p>
          <p className="mt-2 max-w-xs text-sm text-foreground/70">
            Your poem stays right here in this browser. Sign in to save it to{" "}
            {COPY[action]}.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
          >
            Close
          </button>
        </>
      )}
    </dialog>
  );
}
