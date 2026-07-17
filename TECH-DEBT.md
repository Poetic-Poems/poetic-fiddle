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

## TD26071504 OAuth consent screen App name doesn't match the home page

Google's brand verification for the Poetic Fiddle Google Cloud OAuth client
is flagging: "The app name 'Poetic Fiddle' configured for your OAuth consent
screen does not match the app name on your home page." Ruled out so far:

- Console's App name field is an exact `Poetic Fiddle` (confirmed by the
  project owner).
- Console's Application home page field is `https://www.poeticfiddle.com`
  (confirmed by the project owner).
- The live page matches both: `src/app/layout.tsx`'s `<title>` and
  `src/components/brand-header.tsx`'s wordmark render exactly "Poetic
  Fiddle", including when fetched with a Googlebot user agent — no bot
  challenge or alternate response.

What was missing: the page had no machine-readable app/site name signal —
no `<meta name="application-name">`, no `og:site_name`. Added both via
`applicationName` and `openGraph.siteName` in `src/app/layout.tsx`'s
`metadata` export, since Google's brand checker most plausibly matches
against a structured signal like these rather than scraping arbitrary page
text. This is the best remaining code-side hypothesis, not a confirmed fix.

This does not block sign-in: Supabase's Google provider requests only the
non-sensitive scopes `openid`, `email`, and `profile`, so there is no
"unverified app" warning and no user cap — only the custom branding is
withheld from the consent screen until verification completes.

Fix: once this deploys, a human resubmits/re-triggers Google's brand
verification and confirms the mismatch warning clears. If it persists,
the next step is contacting Google's OAuth API verification support, since
every checkable configuration and content signal already matches.

**Update** *2026-07-15 16:00 NZST*:  
An "I believe the issues found are incorrect" request has been sent to the
Google verification team.  The estimated time for a response is three days.

## TD26071801 `npm test` fails on Node 26 (26 tests, all localStorage)

*Noticed 2026-07-18.* Every test touching `window.localStorage` — the whole of
`src/lib/draft-storage.test.ts` plus the editor's draft/save/share/remix
suites, 26 in all — fails on Node 26 with `TypeError: Cannot read properties
of undefined (reading 'clear')`. CI is green and the code is fine: this is
purely a local-toolchain gap, but it makes a clean `npm test` impossible on
the newest Node, and that is where a contributor arriving today lands.

Cause: Node 26 exposes its own experimental global `localStorage`, inert
unless `--localstorage-file` is passed (it warns: "localStorage is not
available because --localstorage-file was not provided"). It shadows the one
Vitest's jsdom environment installs, so `window.localStorage` reads back
`undefined`. Confirmed by version — `'localStorage' in globalThis` is `false`
on Node 20, 22 and 24, and `true` on 26.5. CI pins `node-version: "20"` in
`.github/workflows/build.yml`, which predates the global — hence the
disagreement. `package.json` says `engines.node: ">=20.9.0"`, so a contributor
on 26 is within the declared range and still gets 26 red tests.

Workaround for a local run (not a fix — Node's file-backed store is shared
across test files, where jsdom gives each its own, so parallel suites can race
over it):

    NODE_OPTIONS="--localstorage-file=$(mktemp -u)" npm test

Fix: pick one — (a) run tests under a Node without the global, pinning it in an
`.nvmrc`/`engines` narrowing so it's the same version CI uses; (b) neutralise
the global in `vitest.setup.ts` by redefining `localStorage` from the jsdom
window before the suites run; or (c) track Vitest/jsdom upstream, which may
handle the collision in a later release. (b) is the cheapest and keeps CI and
local on one path; whichever is chosen, bump CI off Node 20 (out of support
since 2026-04) at the same time so the two stop diverging silently.

## TD26071802 poem-title CSS override is a brittle regex against vendored CSS

`scripts/sync-poetic-css.mjs` strips `poetic`'s `.poem-info .title, .poem-info
#title { display: none; }` rule with a regex matched against the exact
whitespace/formatting of the vendored `poetic.css` (pinned at v6.0.1), to fix
issue #41 (poem title not shown in the preview). If a future `poetic` version
bump reformats or restructures that rule, the regex silently stops matching —
`npm install`'s postinstall step does not fail, it just re-hides the title,
regressing #41 with no build signal.

Fix: either assert the regex actually matched something in
`sync-poetic-css.mjs` (throw if `css.length` is unchanged after the
`.replace()`), or replace the removal with a doc/e2e check that fails loudly
if the title becomes hidden again.

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
| TD26071401 | Analysis show/hide toggle is inert under DOMPurify sanitisation | resolved | 2026-07-16 | https://github.com/Poetic-Poems/poetic-fiddle/pull/32 |
| TD26071501 | Auth needs manual Supabase/Vercel dashboard configuration | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/24 |
| TD26071502 | Privacy policy needed for Google OAuth brand verification | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/26 |
| TD26071503 | Point the Google OAuth consent screen at the published privacy policy | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/27 |
| TD26071504 | OAuth consent screen App name doesn't match the home page | open | | |
| TD26071601 | Auth email reaches only project-team addresses (no custom SMTP) | resolved | 2026-07-16 | https://github.com/Poetic-Poems/poetic-fiddle/pull/34 |
| TD26071602 | Analysis synopsis/full selector is inert under DOMPurify sanitisation | resolved | 2026-07-16 | https://github.com/Poetic-Poems/poetic-fiddle/pull/33 |
| TD26071701 | No way to revoke a share link | resolved | 2026-07-17 | https://github.com/Poetic-Poems/poetic-fiddle/pull/39 |
| TD26071801 | `npm test` fails on Node 26 (26 tests, all localStorage) | open | | |
| TD26071802 | poem-title CSS override is a brittle regex against vendored CSS | in-progress | | |
