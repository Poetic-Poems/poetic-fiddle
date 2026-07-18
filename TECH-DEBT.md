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

## TD26071804 npm 12 blocks the `poetic` git dependency by default

*Noticed 2026-07-18.* npm 12 is released (12.0.1 is the current major) and
**disables git-protocol dependencies by default**. Because `package.json`
pins the framework as a git dependency —
`"poetic": "github:Poetic-Poems/poetic#v6.0.1"` — `npm install`/`npm ci`
under npm 12 fails outright before installing anything:

```
npm error code EALLOWGIT
npm error Fetching packages of type "git" have been disabled
npm error Refusing to fetch "poetic@github:Poetic-Poems/poetic#v6.0.1"
```

This is not yet breaking us: CI pins `node-version: "20"`
(`.github/workflows/build.yml`), which ships npm 10, and the fix hasn't been
forced. But it is a latent, total install failure for anyone on npm 12, and
it collides with the Node bump already flagged under [[TD26071801]]'s note
(CI's Node 20 is out of support since 2026-04) — the moment CI or a
contributor moves to a current Node/npm, nothing installs.

Verified against npm 12.0.1 in a sandbox:

- The git dependency is blocked by default (`EALLOWGIT`, as above).
- A committed project `.npmrc` with `allow-git=root` unblocks it with no CLI
  flag. `allow-git` accepts only `all`, `none`, or `root`; `root` is the
  least-privilege value that works, since `poetic` is a top-level (not
  transitive) dependency. `all` also works but is broader than needed.
- Separately, npm 12 makes **dependency** install-scripts opt-in — a git
  dep's own `prepare`/build is blocked-with-a-warning by default (tooling
  renamed: `npm install-scripts ls` / `npm install-scripts approve`). This
  repo's *own* root `postinstall` (`scripts/sync-poetic-css.mjs`) still runs,
  because a root package always runs its own scripts; the open question is
  whether the **`poetic`** package needs its own `prepare`/build to run on
  install to produce the files Fiddle consumes (e.g.
  `poetic/browser/poetic.css` → `public/poetic.css`). If those files are
  committed in the `poetic` repo, no `allowScripts` entry is needed; if they
  are generated by `poetic`'s `prepare`, an `allowScripts` entry for `poetic`
  is also required. Confirm before bumping.

Fix: add a committed `.npmrc` with `allow-git=root` (and, if the check above
finds it necessary, an `allowScripts` entry for `poetic` in `package.json`),
then verify a clean `npm ci` under npm 12 with a cold cache. Do the npm/Node
bump in CI at the same time so local and CI stay on one toolchain. **Do not**
persist `allow-git`/`allow-scripts` in a *user or global* `.npmrc` to work
around this — that reintroduces the git-dep-preparation `EALLOWSCRIPTS` trap
(a persistent `allow-*` setting is forwarded to the inner preparation install
as an env-layer policy and rejected); keep such settings project-local.

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
| TD26071801 | `npm test` fails on Node 26 (26 tests, all localStorage) | resolved | 2026-07-18 | https://github.com/Poetic-Poems/poetic-fiddle/pull/46 |
| TD26071802 | poem-title CSS override is a brittle regex against vendored CSS | resolved | 2026-07-18 | https://github.com/Poetic-Poems/poetic-fiddle/pull/47 |
| TD26071803 | Merged migrations don't reach the live Supabase project on their own | resolved | 2026-07-18 | https://github.com/Poetic-Poems/poetic-fiddle/pull/49 |
| TD26071804 | npm 12 blocks the `poetic` git dependency by default | open | | |
