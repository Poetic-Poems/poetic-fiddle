"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { oneDarkTheme } from "@codemirror/theme-one-dark";
import { poemLanguage, poemSyntaxHighlighting } from "@/lib/poem-syntax";
import { PoemPreview } from "@/components/PoemPreview";
import { SignInPrompt } from "@/components/SignInPrompt";
import { POEM_SYNTAX_REFERENCE_URL } from "@/lib/example-poem";
import { supabase } from "@/lib/supabase-client";
import { usePoemPersistence } from "@/lib/use-poem-persistence";
import { useNonce } from "@/lib/nonce-context";

export { tryRenderPoem } from "@/lib/use-poem-persistence";

function usePrefersDark() {
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) =>
      setPrefersDark(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return prefersDark;
}

interface EditorProps {
  poeticCss: string;
  /**
   * Opens a specific saved poem instead of the anonymous draft/example —
   * the poem's id then survives a reload because it lives in the URL
   * (`/poems/[id]`) rather than only in this component's state.
   */
  initialPoemId?: string;
  /**
   * Seeds the editor with source that isn't (yet) a row of the poet's own —
   * a remix of someone else's shared poem (`/remix/[share_id]`, AC20). No
   * `poemId` comes with it deliberately: the copy is independent, so the
   * first Save inserts a new poem owned by whoever is signed in, leaving the
   * original untouched.
   */
  initialSource?: string;
}

export default function Editor({
  poeticCss,
  initialPoemId,
  initialSource,
}: EditorProps) {
  const prefersDark = usePrefersDark();
  // Below the `lg` breakpoint the split-pane collapses to one visible pane at
  // a time (AC26, AC83) — desktop ignores this and shows both via `lg:flex`.
  const [mobileView, setMobileView] = useState<"source" | "preview">("source");
  // CodeMirror's style-mod injects the editor's styles as an inline <style>
  // tag; passing the request's CSP nonce here is what lets style-src drop
  // 'unsafe-inline' (TECH-DEBT.md TD26072101).
  const nonce = useNonce();
  const extensions = useMemo(
    () => [
      poemLanguage,
      poemSyntaxHighlighting(prefersDark),
      EditorView.cspNonce.of(nonce ?? ""),
      // CodeMirror's React wrapper puts the `id="poem-source"` (below) on the
      // outer wrapper div, not on this content-editable element (role="textbox"),
      // so the visible <label>'s htmlFor never reaches it — an aria-label here
      // is what actually gives screen readers an accessible name (AC79).
      //
      // `tabindex="0"` is a no-op for real browsers — a contenteditable
      // element is natively part of the tab order — but axe-core's
      // scrollable-region-focusable check only recognises a handful of
      // hardcoded tags as natively focusable and doesn't special-case
      // `contenteditable`, so without it the check can't see past
      // `.cm-scroller` (CodeMirror sets that to `tabIndex = -1` deliberately,
      // to avoid a second tab stop) to this element (TD-PPpfid-26080109).
      EditorView.contentAttributes.of({
        "aria-label": "Your poem",
        tabindex: "0",
      }),
      // oneDarkTheme's own line-number colour (#7d8799 on #282c34) is
      // 3.86:1, short of WCAG AA's 4.5:1 — an upstream contrast gap, not
      // something poemSyntaxHighlighting governs (TD-PPpfid-26080109).
      // `!important` guarantees this wins over oneDarkTheme's rule
      // regardless of the two theme() calls' relative stylesheet order.
      ...(prefersDark
        ? [
            EditorView.theme(
              { ".cm-gutters": { color: "#929cad !important" } },
              { dark: true },
            ),
          ]
        : []),
    ],
    [nonce, prefersDark],
  );
  const {
    session,
    source,
    rendered,
    handleChange,
    open: { opening, openError },
    save: { saving, saveError, saveStatus, handleSave },
    share: {
      sharing,
      shareError,
      shareUrl,
      handleShare,
      unsharing,
      handleUnshare,
      linkCopied,
      handleCopyShareLink,
    },
    remix: {
      allowRemix,
      allowRemixSaving,
      allowRemixError,
      handleAllowRemixChange,
    },
    signInPromptAction,
    dismissSignInPrompt,
  } = usePoemPersistence({ initialPoemId, initialSource });

  if (openError) {
    return (
      <div className="flex flex-1 flex-col items-start gap-3 px-6 pb-6">
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {openError}
        </p>
        <Link
          href="/poems"
          className="text-sm text-link underline underline-offset-2"
        >
          Back to My poems
        </Link>
      </div>
    );
  }

  if (opening) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 pb-6">
        <p role="status" className="text-sm text-foreground/70">
          Opening your poem…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 pb-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {saveError && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {saveError}
          </p>
        )}
        <span
          role="status"
          aria-label="Save status"
          className="text-sm text-foreground/70"
        >
          {saveStatus}
        </span>
        {session && (
          <>
            <Link
              href="/poems"
              className="text-sm text-foreground/70 underline underline-offset-2"
            >
              My poems
            </Link>
            <span className="text-sm text-foreground/70">
              {session.user.email}
            </span>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="text-sm text-foreground/70 underline underline-offset-2"
            >
              Sign out
            </button>
          </>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/5"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {sharing ? "Sharing…" : "Share"}
        </button>
      </div>
      {session && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10">
          <label htmlFor="poem-allow-remix" className="text-foreground/70">
            Remixing this poem:
          </label>
          <select
            id="poem-allow-remix"
            value={
              allowRemix === null ? "default" : allowRemix ? "allow" : "deny"
            }
            disabled={allowRemixSaving}
            onChange={(event) => {
              const next = event.target.value;
              handleAllowRemixChange(
                next === "default" ? null : next === "allow",
              );
            }}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
          >
            <option value="default">Use my default setting</option>
            <option value="allow">Always allow</option>
            <option value="deny">Never allow</option>
          </select>
          {allowRemixSaving && (
            <span role="status" className="text-xs text-foreground/70">
              Saving…
            </span>
          )}
          {allowRemixError && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {allowRemixError}
            </p>
          )}
        </div>
      )}
      {shareError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {shareError}
        </p>
      )}
      {shareUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10">
          <span className="text-foreground/70">Share link:</span>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-link underline underline-offset-2"
          >
            {shareUrl}
          </a>
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="ml-auto rounded-md border border-black/10 px-2 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
          >
            {linkCopied ? "Copied!" : "Copy"}
          </button>
          {linkCopied && (
            <span
              role="status"
              aria-label="Link copied to clipboard"
              className="sr-only"
            />
          )}
          <button
            type="button"
            onClick={handleUnshare}
            disabled={unsharing}
            className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/5"
          >
            {unsharing ? "Unsharing…" : "Unshare"}
          </button>
        </div>
      )}
      <div
        role="group"
        aria-label="View"
        className="flex gap-1 self-start rounded-md border border-black/10 p-1 text-sm dark:border-white/10 lg:hidden"
      >
        <button
          type="button"
          aria-pressed={mobileView === "source"}
          onClick={() => setMobileView("source")}
          className={`rounded px-3 py-1.5 font-medium ${
            mobileView === "source"
              ? "bg-primary text-white"
              : "text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5"
          }`}
        >
          Source
        </button>
        <button
          type="button"
          aria-pressed={mobileView === "preview"}
          onClick={() => setMobileView("preview")}
          className={`rounded px-3 py-1.5 font-medium ${
            mobileView === "preview"
              ? "bg-primary text-white"
              : "text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5"
          }`}
        >
          Preview
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          data-testid="mobile-pane-source"
          className={`min-h-0 flex-col gap-2 ${
            mobileView === "source" ? "flex" : "hidden"
          } lg:flex`}
        >
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="poem-source" className="text-sm font-medium">
              Your poem
            </label>
            <a
              href={POEM_SYNTAX_REFERENCE_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-link underline underline-offset-2"
            >
              Syntax reference
            </a>
          </div>
          <p className="text-xs text-foreground/70">
            Tab indents inside the editor. Press Esc, then Tab, to move focus
            out of it instead.
          </p>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-black/10 dark:border-white/10">
            <CodeMirror
              id="poem-source"
              value={source}
              height="100%"
              // `theme="dark"` would also pull in oneDark's own
              // syntax-highlight rules (@codemirror/theme-one-dark's
              // `oneDark` bundles both); those combine with, and for shared
              // tags like `heading` can outrank, poemHighlightStyleDark's
              // colours — e.g. its `heading` (coral, #e06c75) fails AA on
              // this background against a `{...}` label styled by our own
              // `heading2` rule. Only the real-browser suite
              // (e2e/a11y.spec.ts) can see that: contrast.test.ts measures
              // the colours poemHighlightStyleDark declares, not the ones two
              // stacked highlight styles end up painting (TD-PPpfid-26080109).
              // `oneDarkTheme` is one-dark's chrome/UI colours only, leaving
              // poemSyntaxHighlighting as the sole source of syntax colour.
              theme={prefersDark ? oneDarkTheme : "light"}
              extensions={extensions}
              onChange={handleChange}
            />
          </div>
          <p
            role="status"
            className="min-h-5 text-sm text-amber-700 dark:text-amber-400"
          >
            {rendered.error
              ? `Couldn't parse the poem yet: ${rendered.error}`
              : ""}
          </p>
        </div>
        <div
          data-testid="mobile-pane-preview"
          className={`min-h-0 flex-col gap-2 ${
            mobileView === "preview" ? "flex" : "hidden"
          } lg:flex`}
        >
          <span className="text-sm font-medium">Preview</span>
          <PoemPreview html={rendered.html} css={poeticCss} />
        </div>
      </div>
      <SignInPrompt action={signInPromptAction} onClose={dismissSignInPrompt} />
    </div>
  );
}
