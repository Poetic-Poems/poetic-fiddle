"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";
import { deleteAccount, exportAccountData } from "@/lib/account";
import { revalidateSharedPoem } from "@/lib/revalidate-share";
import { errorMessage } from "@/lib/errors";

interface AccountDangerZoneProps {
  session: Session;
}

/**
 * Self-service account deletion (AC92, W13), gated behind a confirmation
 * modal that requires typing the account's own email — the same
 * type-to-confirm pattern as most "delete forever" flows, chosen because a
 * bare confirm button is too easy to click through on an action this
 * irreversible.
 *
 * On success, signs the browser out (the server has already invalidated the
 * session's refresh token by deleting the `auth.users` row — this is belt
 * and braces for the client's own copy) and redirects to the home page,
 * matching every other surface's signed-out state rather than adding a
 * dedicated confirmation page.
 */
export function AccountDangerZone({ session }: AccountDangerZoneProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleClose() {
    if (deleting) return;
    setOpen(false);
    setConfirmEmail("");
    setError(null);
  }

  const emailConfirmed =
    confirmEmail.trim().toLowerCase() ===
    (session.user.email ?? "").toLowerCase();

  async function handleConfirmDelete(event: FormEvent) {
    event.preventDefault();
    if (!emailConfirmed || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const shareIds = await deleteAccount();
      // Best-effort, exactly as per-poem deletion treats it
      // (`PoemsDashboard.tsx`): the account is already gone, so a failed
      // invalidation must not report the deletion as failed — it only costs
      // a permalink still serving from cache until its 300s expiry.
      await Promise.all(
        shareIds.map((shareId) =>
          revalidateSharedPoem(shareId).catch(() => {}),
        ),
      );
      await supabase.auth.signOut();
      // A full navigation (not client-side routing) is deliberate: this is
      // the one action in the app where leaving every in-memory client
      // state behind — cached poems, the just-deleted session — matters
      // more than a fast transition.
      window.location.href = "/";
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const { blob, filename } = await exportAccountData();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-6 flex flex-col items-start gap-2 rounded-lg border border-red-700/40 p-4 dark:border-red-400/40">
      <h2 className="font-serif text-lg font-semibold text-red-700 dark:text-red-400">
        Danger zone
      </h2>
      <p className="text-sm text-foreground/70">
        Download a copy of every saved poem and your account details, as a
        gzipped archive.
      </p>
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
      >
        {exporting ? "Exporting…" : "Export your data"}
      </button>
      {exportError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {exportError}
        </p>
      )}
      <p className="mt-2 text-sm text-foreground/70">
        Permanently delete your account, including every saved poem and share
        link. This can&rsquo;t be undone.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-700 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        Delete account
      </button>

      <dialog
        ref={dialogRef}
        onClose={handleClose}
        onCancel={(event) => {
          // Escape mid-delete would close the dialog natively while
          // `handleClose` declines to clear `open` — and because "Delete
          // account" only sets `open` to a value it already holds, nothing
          // would reopen it, stranding the section until a reload. Refusing
          // the cancel keeps the two in step.
          if (deleting) event.preventDefault();
        }}
        className="w-full max-w-sm rounded-lg border border-black/10 bg-background p-6 text-foreground backdrop:bg-black/40 dark:border-white/10"
      >
        {open && (
          <form onSubmit={handleConfirmDelete} className="flex flex-col gap-4">
            <div>
              <p className="font-serif text-lg font-semibold">
                Delete your account?
              </p>
              <p className="mt-2 text-sm text-foreground/70">
                Deleting your account is irreversible. All your poems and
                account data will be removed. Type your email (
                {session.user.email}) to confirm.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="delete-account-email"
                className="text-sm font-medium"
              >
                Email
              </label>
              <input
                id="delete-account-email"
                type="email"
                required
                autoComplete="off"
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
                disabled={deleting}
                className="w-full rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/10"
              />
            </div>
            {error && (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={!emailConfirmed || deleting}
                className="rounded-md border border-red-700 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {deleting ? "Deleting…" : "Delete account forever"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={deleting}
                className="text-sm text-foreground/70 underline underline-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
