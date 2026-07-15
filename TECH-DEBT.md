# Tech debt

Deferred work and known gaps in poetic-fiddle. Record an entry here
whenever you defer something, rather than leaving it only in a commit message or
in chat. Keep entries short and dated. Once an issue has been resolved, remove
its `## <id> <title>` section below — but never remove its row from the
Ledger table at the bottom of this file; see "Ledger" below.

Format:
```
## <id> <short title>

A description of what, why it matters, where, and a suggested fix.

```
Where `<id>` is a literal "TD" then the date followed by a zero-padded
sequential number (starting at 1 for the the first entry of a day). I.e.:
**TD*YYMMDDNN***. `NN` is one more than the highest `NN` already used for
that date **in the Ledger table**, not just what's currently visible above
it — a resolved entry's body is removed, but its Ledger row stays forever,
so the Ledger (not memory or scrollback) is the source of truth for the next
free ID. Compute it with `scripts/next-tech-debt-id.pl` rather than counting
by hand.

## TD26071401 Analysis show/hide toggle is inert under DOMPurify sanitisation

poetic's page/fragment templates (`src/templates/_poem-content.pug`) show/hide
a poem's Analysis section via inline `onclick` handlers on the "Show
analysis"/"Hide analysis" buttons. `PoemPreview.tsx`'s default-config
`DOMPurify.sanitize()` (M2) strips all `on*` attributes, so a poem with an
Analysis section renders with those buttons present but non-functional in
Fiddle's live preview and (once M6 lands) the SSR share page — the content
stays exactly as poetic's CSS defaults it (likely permanently hidden, since
`.analysis` has no other reveal mechanism once the onclick handlers are gone).
This doesn't affect M2's own scope: the curated example `.poem` has no
Analysis section, and every M2 acceptance criterion is unaffected.

Fix at whichever milestone first needs Analysis-section fidelity (M6 share
pages are the more likely trigger than the editor preview): either add a
small script-free reveal (e.g. a checkbox+label CSS toggle, matching the
postscript preview's own pattern, landing upstream in poetic since it's a
template change) or a light client-side rehydration step in Fiddle that
re-wires the toggle after sanitisation instead of relying on the sanitised
inline handlers.

## TD26071504 OAuth consent screen App name doesn't match the home page

Google's brand verification for the Poetic Fiddle Google Cloud OAuth client
is flagging: "The app name 'Poetic Fiddle' configured for your OAuth consent
screen does not match the app name on your home page." The home page side is
already correct — `src/app/layout.tsx`'s `<title>` and
`src/components/brand-header.tsx`'s wordmark both render exactly "Poetic
Fiddle" (confirmed against the live `https://www.poeticfiddle.com/` HTML) —
so the mismatch is in the **Google Cloud Console** OAuth consent screen's
"App information" → App name field, not the codebase. This needs a human
with Google Cloud Console access to the Poetic Fiddle project; there's no
API/CLI credential for it in an agent's environment.

This does not block sign-in: Supabase's Google provider requests only the
non-sensitive scopes `openid`, `email`, and `profile`, so there is no
"unverified app" warning and no user cap — only the custom branding is
withheld from the consent screen until verification completes.

Fix: a human opens the Google Cloud Console OAuth consent screen, checks the
App name field for anything other than an exact `Poetic Fiddle` (case,
spacing, a leftover project-ID default, or a suffix), corrects it, and lets
Google's brand verification re-run.

## Claiming an item

Before starting work on an open item, confirm nobody else already has:
check its Ledger row is `open` (not `in-progress`), and skim open pull
requests for its ID. Then:

1. Flip its Ledger row's Status to `in-progress`.
2. Push a branch and open a **draft** pull request right away — before the
   fix is finished — so `gh pr list` shows it's claimed. The first commit
   can be the Ledger status flip itself.
3. Do the work, pushing further commits to the same branch/PR.
4. Once verified, flip the Ledger row to `resolved` (fill in `Resolved` and
   `Ref`), remove the entry's `## <id>` section, and mark the PR ready for
   review.

If a claim is abandoned (the draft PR is closed without merging), flip the
row back to `open`.

## Ledger

Every tech-debt ID ever allocated — open, in-progress, resolved, or not-debt —
is listed here forever, in ID order. This is what makes numbering unambiguous:
the next free ID for a given date is one more than the highest `NN` seen
below for that date, regardless of whether the corresponding entry still has
a body above.

A row can also close as `not-debt`: the item was filed here but turned out, on
reflection, not to be a deferred cost at all (e.g. deliberately reserved
syntax awaiting a future feature). Its `## <id>` section is removed like a
resolved one, but nothing was fixed, so the `Resolved` column stays blank; the
`Ref` column instead points to wherever the content moved.

| ID | Title | Status | Resolved | Ref |
|----|-------|--------|----------|-----|
| TD26071301 | poetic git dependency needs types shim + transpilePackages | resolved | 2026-07-13 | https://github.com/Poetic-Poems/poetic-fiddle/pull/14 |
| TD26071401 | Analysis show/hide toggle is inert under DOMPurify sanitisation | open | | |
| TD26071501 | Auth needs manual Supabase/Vercel dashboard configuration | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/24 |
| TD26071502 | Privacy policy needed for Google OAuth brand verification | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/26 |
| TD26071503 | Point the Google OAuth consent screen at the published privacy policy | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/27 |
| TD26071504 | OAuth consent screen App name doesn't match the home page | open | | |
