# Tech debt

Deferred work and known gaps in poetic-fiddle. Record an entry here
whenever you defer something, rather than leaving it only in a commit message or
in chat. Keep entries short and dated. Live items live under the "Current Items"
heading as `### <id> <title>` sections. Once an issue has been resolved, remove
its `### <id> <title>` section from Current Items below — but never remove its
row from the Ledger table at the bottom of this file; see "Ledger" below.

Format:
```
### <id> <short title>

A description of what, why it matters, where, and a suggested fix.

```
Where `<id>` is a literal "TD" then the date followed by a zero-padded
sequential number (starting at 1 for the the first entry of a day). I.e.:
**TD*YYMMDDNN***. `NN` is one more than the highest `NN` already used for
that date **in the Ledger table**, not just what's currently visible above
it — a resolved entry's body is removed, but its Ledger row stays forever,
so the Ledger (not memory or scrollback) is the source of truth for the next
free ID. Compute it with `scripts/next-tech-debt-id.pl --ref origin/main`
(after a `git fetch origin`) rather than counting by hand — the `--ref` makes
the allocation reflect the shared state instead of a possibly stale checkout.
It still cannot see IDs allocated on unmerged branches, so also skim open
pull requests and `td/*` branches when filing.

IDs are only unique within this repository: sister repositories allocate from
the same date-based sequence, so the bare ID may exist in several of them.
When referring to an item anywhere outside this repository (a sister repo's
docs, a cross-repo PR, chat), qualify it with the repo name — e.g.
`poetic-fiddle TD26071801`.

## Claiming an item

This repository is worked by concurrent agents: autonomous and interactive
sessions may pick up items at the same time, so a claim must be checked and
taken against the shared state, never against what a local checkout happens
to say. Before starting work on an open item:

1. `git fetch origin`, then confirm the item's Ledger row is `open` (not
   `in-progress`) **as of `origin/main`** — e.g. via
   `perl scripts/get-tech-debt-record.pl --ref origin/main <id>`.
2. Confirm nobody holds a claim: `git ls-remote origin "refs/heads/td/<id>"`
   must print nothing, and skim open pull requests for the ID (which also
   catches claims made on unconventionally named branches).
3. Create the claim branch, named exactly **`td/<id>`**, from `origin/main`;
   flip the item's Ledger row Status to `in-progress`; commit and push. The
   branch name is the claim lock: git refuses the push if the branch already
   exists, so a rejected push means another agent won the race — abandon
   quietly; never force-push over it.
4. Open a **draft** pull request right away — before the fix is finished — so
   `gh pr list` shows the claim too. The Ledger status flip can be its first
   commit.
5. Do the work, pushing further commits to the same branch/PR.
6. Once verified, flip the Ledger row to `resolved` (fill in `Resolved` and
   `Ref`), remove the entry's `### <id>` section from Current Items, and mark
   the PR ready for review.

If a claim is abandoned, close the draft PR and delete the `td/<id>` branch —
that releases the lock. The in-progress flip only ever lived on the branch,
so `main`'s Ledger still says `open` and nothing needs reverting.

## Review provenance

Where a Current Items entry mirrors the *whole* intended end state of a
weekly project-review recommendation, that mapping is recorded here so the
review and the register aren't double-counted — the implementation
pipeline's Co-Ordinator uses this to know the register entry and the
recommendation are the same work.

| Recommendation | Ledger ID |
|----------------|-----------|
| R-01 — Bump `next` to `16.2.11` | TD26072403 |
| R-02 — Add an accessible name to the CodeMirror editor | TD26072404 |
| R-03 — Require CI status checks in the branch-protection ruleset | TD26072405 |
| R-04 — Correct CLAUDE.md's Status section | TD26072406 |
| R-05 — Correct the Privacy Policy's "storage isn't available yet" claim | TD26072407 |
| R-06 — Guard against missing Supabase env vars breaking the editor silently | TD26072408 |
| R-07 — Align Node version across README/`engines`/`.nvmrc` | TD26072409 |
| R-08 — Route `SignInPrompt` errors through the safe-message convention | TD26072410 |
| R-09 — Add timeout/abort handling to outbound Supabase calls | TD26072411 |
| R-10 — Add tests for `use-session.ts` and `SharedPoemView`'s `escapeHtml` | TD26072412 |
| R-11 — Capture `revalidateSharedPoem` failures in Sentry | TD26072413 |
| R-12 — Add a self-service "delete poem" action | TD26072414 |
| R-13 — Pin exact Supabase CLI / npm versions in CI | TD26072415 |
| R-14 — Fix parse-error contrast and add a visible share-page heading | TD26072416 |
| R-15 — Document the local-only Supabase dev workflow in README | TD26072417 |
| R-16 — Add `CONTRIBUTING.md` and PR/issue templates | TD26072418 |
| R-17 — Document the CODEOWNERS single-reviewer reality | TD26072419 |
| R-18 — Trim the historical-narrative blockquote from OBSERVABILITY-PLAN.md | TD26072420 |
| R-19 — Add a `poetic`-release freshness-check workflow | TD26072421 |
| R-20 — Reconcile CHANGELOG.md and GitHub release notes at release time | TD26072422 |
| R-21 — Extract Editor.tsx's persistence/session orchestration into a hook | TD26072423 |
| R-22 — Add a cross-tool-seam test for the Analysis-toggle DOM wiring | TD26072424 |
| R-23 — Debounce draft-autosave localStorage writes | TD26072425 |
| R-24 — Code-quality quick wins | TD26072426 |
| R-25 — Security polish | TD26072427 |
| R-26 — Add test coverage tooling and a watch-mode script | TD26072428 |
| R-27 — Document the undocumented TypeScript/ESLint major-version holds | TD26072429 |
| R-28 — README/tooling polish | TD26072430 |
| R-29 — Editor/dashboard loading & feedback polish | TD26072431 |
| R-30 — Doc polish | TD26072432 |
| R-31 — Document backup/restore and export/delete runbooks | TD26072433 |
| R-32 — Shared sanitisation-policy constant between preview and share pipelines | TD26072434 |
| R-33 — Add automated accessibility testing (axe smoke test) | TD26072435 |

Full evidence, impact, and rationale for each item live in
`reviews/project-review-2026-07-23/02-findings.md` and
`03-recommendations.md`; the entries below summarise them for readers who
only have this file.

## Current Items

The open and in-progress items, each as a `### <id> <title>` section. This
heading is permanent: when there are no current items it stays here (empty), so
it is always obvious where a new item's body belongs.

### TD26071901 jsdom pinned to 26.x — 27+ pulls an ESM-only dep Turbopack can't require

*Filed 2026-07-19, resolving #52.* jsdom 27+ replaced its CommonJS encoding
dependencies with the **ESM-only** `@exodus/bytes` (`jsdom` and
`html-encoding-sniffer@6` both `require()` it). jsdom is on Next's default
`serverExternalPackages` list, so on Vercel it is `require()`d — not bundled —
at runtime, and that CommonJS-`require()`-of-an-ESM-module throws
`ERR_REQUIRE_ESM` under the Turbopack server build (it is not fixed by moving to
Node ≥ 22.12 — see #52 / PR #65). Because the share page imports jsdom at module
scope (`src/lib/render-share.ts`), the throw hard-500s `/share/[share_id]` for
every visitor.

Worked around by pinning `jsdom` to `^26.0.0` in `package.json` — jsdom 26.x's
encoding deps are all CommonJS (`whatwg-encoding`, `html-encoding-sniffer@4`),
so `@exodus/bytes` leaves the tree entirely and there is no ESM `require` left
to fail. The pin is referenced from a comment at the jsdom import in
`src/lib/render-share.ts`.

Dependabot PR #79 bumped jsdom 26.1.0 → 29.1.1 anyway — a `^26.0.0` range in
`package.json` doesn't stop Dependabot from *proposing* a major bump, only
from a plain `npm update` picking one silently — and merging it regressed
this exact 500 in production (issue #86). `.github/dependabot.yml` now has an
`ignore` rule for jsdom `semver-major` updates, so Dependabot itself can no
longer open that PR; a manual bump remains possible and must not land without
re-checking this entry first.

Fix (to lift the pin): bump jsdom once either Turbopack bundles jsdom rather
than externalising it, or its ESM deps can be `require()`d in this runtime
(e.g. jsdom ships a CJS-compatible path again). Alternatively, move the
share-page sanitiser off jsdom onto a bundler-friendly DOM (e.g. linkedom),
which would remove the constraint but is a change to a security-sensitive
sanitisation boundary and needs its own careful review. Either way, remove
the `dependabot.yml` ignore rule in the same change.

### TD26072401 Vendored poetic.css fails WCAG AA contrast for byline/footer/link text

*Filed 2026-07-24, discovered while verifying AA contrast for W4
(`IMPLEMENTATION-PLAN.md` §M8/M9).* The poem-preview/share stylesheet at
`src/lib/poetic-css.generated.ts` (regenerated on every `npm install` by
`scripts/sync-poetic-css.mjs` from the pinned `poetic` package's
`browser/poetic.css`, itself a copy of `public/poetic.css` in
`Poetic-Poems/poetic`) sets several text colours below the 4.5:1 AA threshold
for normal text: `.poem-info` (the byline) and `.song-segment`/`.song-link`/
`.postscript` use `color: gray` (#808080, 3.95:1 on white); `.no-content` and
`.poetic-footer` (the injected site footer, every page) use `#999`
(2.85:1); `.audio-indicator`, `.links a`, and several other link/text roles
use `#007AFF` (4.02:1). This affects every published poem page and share
page.

This is **not** fixable in poetic-fiddle: per `CLAUDE.md`'s single-source-of-
truth rule and `IMPLEMENTATION-PLAN.md` §6.1, `poetic.css` is consumed as-is
from the `poetic` package export, not forked or hand-edited here (the
generated file's own header says so, and a hand-edit would be silently
overwritten by the next `npm install`).

Fix: darken `gray`, `#999`, and `#007AFF` to AA-passing shades in
`Poetic-Poems/poetic`'s `public/poetic.css`, cut a new poetic release, and
bump the tag-pinned dependency in this repo's `package.json` (re-running
`npm install` regenerates `src/lib/poetic-css.generated.ts` from the patched
CSS automatically). `src/lib/contrast.test.ts` (added resolving W4) has the
reusable `contrastRatio`/`blendOver` helpers already; extending its pairing
list to also cover the generated poetic.css's tokens would give this
regression the same CI coverage globals.css now has.

### TD26072402 CodeMirror `.poem` syntax-highlight colours not contrast-verified

*Filed 2026-07-24, discovered while verifying AA contrast for W4
(`IMPLEMENTATION-PLAN.md` §M8/M9).* `src/lib/poem-syntax.ts`'s
`poemHighlightStyle` hardcodes syntax colours (comment `#8a8a8a`, meta gold
`#c88a3a`, string `#5f6368`, etc.) that were never checked against the
`@uiw/react-codemirror` `"light"`/`"dark"` theme backgrounds the editor
switches between (`Editor.tsx`'s `theme={prefersDark ? "dark" : "light"}`).
At least the comment (3.45:1) and meta (2.94:1) colours fail 4.5:1 against a
plain white background; the actual built-in dark theme's background hasn't
been measured at all.

Fix: read the actual background colours the `"light"`/`"dark"` presets
render (or switch to an explicit custom `EditorView.theme` so the
background is known), then pick syntax colours that meet AA against both,
and add them to the contrast test suite alongside `globals.css`'s tokens.

### TD26072403 `next` is one patch behind on advisories affecting Server Actions

*Filed 2026-07-24, from the 2026-07-23 project review (R-01, F-SEC-01, F-DEPS-01).*
`package.json` pins `next@16.2.10`; `npm audit` reports 3 high-severity
advisories fixed in `16.2.11`, several scoped to Server Actions handling and
the proxy/middleware layer. `src/lib/revalidate-share.ts` has a live `"use
server"` export called from `Editor.tsx` on every save of a shared poem, so
this is reachable, not dormant. Neither a Dependabot PR nor a Dependabot
alert has surfaced it yet — `eslint-config-next` was bumped in lockstep in
PR #94, `next` itself was not.

Fix: `npm install next@16.2.11` (or later), run the full check suite, and
confirm `npm audit` no longer reports the three advisories.
### TD26072404 CodeMirror editor has no accessible name for screen readers

*Filed 2026-07-24, from the 2026-07-23 project review (R-02, F-UX-01).*
`Editor.tsx`'s `<label htmlFor="poem-source">` targets an `id` that
CodeMirror's React wrapper places on the outer `<div>`, not on the actual
`role="textbox"` editable element, which has no `aria-label`.
`docs/REQUIREMENTS.md` AC79 requires the editor be labelled; PR #89 closed
that backlog entry without fixing the labelling.

Fix: add `EditorView.contentAttributes.of({ "aria-label": "Your poem" })` to
the CodeMirror `extensions` array; add a `getByRole`/`getByLabelText`
assertion to `Editor.test.tsx`.

### TD26072405 Branch protection doesn't require CI to pass before merge

*Filed 2026-07-24, from the 2026-07-23 project review (R-03, F-CI-01).* The
active ruleset (`rulesets/18828479`) requires code-owner review, CodeQL, and
Copilot code-quality, but has no `required_status_checks` rule — so
`build.yml`, `commit-format.yml`, and `database.yml`'s `test` job can all be
red and a PR is still mergeable, contradicting CLAUDE.md's own description
of the gate ("gated by a PR and CI").

Fix: add a `required_status_checks` rule to the ruleset naming `build`,
`commit-format`, and `database.yml`'s `test` job.

### TD26072407 Privacy Policy says poem storage "isn't available yet," but it's live

*Filed 2026-07-24, from the 2026-07-23 project review (R-05, F-DATA-01).*
`src/app/privacy/page.tsx`'s "Saving and sharing poems" section tells
visitors poem/account storage isn't available yet. `poems-store.ts` has a
fully wired, unflagged save/share/list/load flow against live tables,
exercised in production. Rated above what the project's maturity alone
would suggest, since the harm (a false statement about whether creative
writing is persisted) reaches the user's actual expectations.

Fix: update the section to present-tense, accurate language; cross-check
the "delete at any time" promise against actual capability (TD26072414).

### TD26072409 Node version guidance disagrees across README/`engines`/no `.nvmrc`

*Filed 2026-07-24, from the 2026-07-23 project review (R-07, F-DEPS-03,
F-DOC-02, F-TOOL-05).* `package.json` pins `engines.node: "22.x"` (required
by the jsdom `ERR_REQUIRE_ESM` issue below Node 22.12, TD26071901);
README still says "Requires Node.js >=20.9"; no `.nvmrc` exists for version
managers to auto-select the right version; no `engine-strict` in `.npmrc`.

Fix: update README to `Requires Node.js 22.x`; add a one-line `.nvmrc`
(`22`); adjust `scripts/setup-linux.sh`'s `nvm use node` to plain `nvm use`.

### TD26072411 No timeout on outbound Supabase calls; a stalled request hangs the UI indefinitely

*Filed 2026-07-24, from the 2026-07-23 project review (R-09, F-PERF-02,
F-OPS-03).* No Supabase client configures a request timeout or
`AbortController`, and `@supabase/postgrest-js`'s retry logic excludes
non-idempotent methods (inserts/updates). A hung save leaves the UI stuck
in "Saving…" until the hosting platform's own function timeout fires,
bypassing the app's own typed-error recovery messaging.

Fix: wrap the Supabase client's `fetch` (or individual `poems-store.ts`
calls) with an `AbortController`-based timeout, translated into the
existing typed error classes.

### TD26072412 `use-session.ts` and `SharedPoemView`'s `escapeHtml` are untested

*Filed 2026-07-24, from the 2026-07-23 project review (R-10, F-TEST-01,
F-TEST-02).* Every consumer mocks `useSession` entirely, so the hook
gating all owner-scoped, RLS-backed operations is never exercised directly.
`SharedPoemView.tsx`'s hand-rolled `escapeHtml`, which interpolates a
poet-controlled title into a CSP-bearing HTML template, has zero coverage.

Fix: add `src/lib/use-session.test.ts` and `SharedPoemView.test.tsx`
covering both, per the review's recommendation for concrete test cases.

### TD26072413 `revalidateSharedPoem` failures are silently swallowed with no Sentry capture

*Filed 2026-07-24, from the 2026-07-23 project review (R-11, F-OPS-01).*
Three call sites in `Editor.tsx` do
`revalidateSharedPoem(...).catch(() => {})`. `docs/OBSERVABILITY-PLAN.md`
already flags this exact gap as an open `[flag]` that was never resolved in
code — a failed cache-tag invalidation can leave the share page stale for
up to 5 minutes with zero record anywhere.

Fix: wrap the call sites with the existing `reportSwallowedError` helper,
resolving the plan's own open flag.

### TD26072414 No self-service delete path for a poem, though the schema already supports it

*Filed 2026-07-24, from the 2026-07-23 project review (R-12, F-DATA-02).*
`poems-store.ts` exports no delete function, though the `poems_delete_own`
RLS policy and grant already exist in the migration. Deletion today is
manual, by emailing the maintainer.

Fix: add a `deletePoem(id)` function and a confirmed delete action in
`PoemsDashboard.tsx`.

### TD26072415 CI floats the Supabase CLI and npm versions instead of pinning them

*Filed 2026-07-24, from the 2026-07-23 project review (R-13, F-CI-03,
F-CI-04).* `database.yml` installs the Supabase CLI via `version: latest`;
`build.yml` installs npm via the floating `npm@12`. Both are the
least-pinned parts of an otherwise carefully version-pinned pipeline, and
this project already hit an npm-version-specific bug once (TD26071804).

Fix: pin an exact Supabase CLI release in `database.yml`; pin an exact npm
version (or record the verified major in `package.json`'s `engines.npm`).

### TD26072416 Parse-error text fails AA contrast; share page has no visible heading

*Filed 2026-07-24, from the 2026-07-23 project review (R-14, F-UX-02,
F-UX-03).* `Editor.tsx`'s parse-error status text uses `text-amber-600`
(≈3.18:1 on white, below the 4.5:1 AA threshold). `src/app/share/[share_id]/page.tsx`
has no visible `<h1>` outside the sandboxed iframe. **Note:** open PR #99
already fixes the contrast half (amber-600 → amber-700); check its status
before starting — this item's remaining scope may be just the share-page
heading.

Fix: replace the contrast-failing colour with a checked token; render the
poem title as a visible `<h1>` in the share page's own DOM.

### TD26072417 README doesn't document the local-only Supabase dev workflow

*Filed 2026-07-24, from the 2026-07-23 project review (R-15, F-TOOL-02).*
README's "Environment & secrets" section only describes provisioning a live
Supabase cloud project, though `supabase start` (already used by
`database.yml`'s `test` job and the `test:db` script) gives a fully local,
zero-cloud dev loop.

Fix: add a short "Local-only Supabase" note to README.

### TD26072418 No CONTRIBUTING file or PR/issue templates

*Filed 2026-07-24, from the 2026-07-23 project review (R-16, F-GOV-01,
F-GOV-02).* The project's contribution workflow (branch naming, commit
format, PR-only changes) lives only in CLAUDE.md, framed as agent operating
instructions rather than a human-facing guide, and isn't picked up by
GitHub's own contribution-guide UI affordances.

Fix: add a short root `CONTRIBUTING.md` pointing to CLAUDE.md's relevant
sections, plus a minimal `.github/PULL_REQUEST_TEMPLATE.md`.

### TD26072419 CODEOWNERS' two reviewer accounts appear to be the same person

*Filed 2026-07-24, from the 2026-07-23 project review (R-17, F-GOV-03).*
`@warwickallen` and `@Warwick-Allen` both satisfy the branch-protection
rule's code-owner-review requirement, but review authorship, `mergedBy`,
and LICENCE/CLAUDE.md's git user all point to the same individual — so the
"independent review" the ruleset implies is procedurally self-approval
through an alternate account.

Fix: document explicitly that review is currently a single-human checkpoint
under two accounts, or add a second genuine reviewer as the project grows.

### TD26072420 OBSERVABILITY-PLAN.md narrates a fixed bug's history, duplicating CHANGELOG.md

*Filed 2026-07-24, from the 2026-07-23 project review (R-18, F-DOC-03).*
A dated "Update (2026-07-19)" blockquote in `docs/OBSERVABILITY-PLAN.md`
narrates the jsdom incident's resolution in past tense — the
"previously.../fixed by..." phrasing CLAUDE.md's documentation principles
reserve for `CHANGELOG.md`. The same incident is already narrated there and
in `TD26071901`.

Fix: trim the blockquote to a one-line as-built statement linking to
TD26071901.

### TD26072421 No mechanism detects a new `poetic` release

*Filed 2026-07-24, from the 2026-07-23 project review (R-19, F-DEPS-02).*
`poetic` installs from a pinned GitHub release-tarball URL, which
Dependabot's npm updater can't track. No script/workflow polls
`Poetic-Poems/poetic`'s releases for a newer tag than the one pinned.
Currently up to date, so this is latent, not active.

Fix: a scheduled workflow comparing the pinned version against `poetic`'s
latest release, mirroring the existing `td-tooling-drift.yml` pattern.

### TD26072422 CHANGELOG.md and GitHub release notes are unreconciled

*Filed 2026-07-24, from the 2026-07-23 project review (R-20, F-CI-02).*
`release.yml` creates releases with `--generate-notes` (PR-title bullets),
independent of `CHANGELOG.md`'s manually curated `[Unreleased]` section.
Nothing keeps the two in sync; they've already begun to diverge in spirit.

Fix: have `release.yml` pull its body from `CHANGELOG.md`'s section for the
version being tagged, or add a check that a version-bump PR renames
`[Unreleased]`.

### TD26072423 `Editor.tsx` mixes five concerns in one 581-line component

*Filed 2026-07-24, from the 2026-07-23 project review (R-21, F-ARCH-02,
F-CODE-01).* `Editor.tsx` owns 13 state/ref hooks, session-migration logic,
draft persistence, debounced rendering, and four independent Supabase-backed
save/share/unshare/allow-remix flows. Currently proportionate (thoroughly
tested, well-commented) but a real god-object risk as Phase 2 features land.

Fix: extract the non-presentational state machine into one or more hooks
(e.g. `usePoemPersistence`), incrementally and test-driven.

### TD26072424 Analysis-toggle DOM wiring is tested only against a hand-authored fixture

*Filed 2026-07-24, from the 2026-07-23 project review (R-22, F-ARCH-01).*
`PoemPreview.tsx`'s `wireAnalysisToggles`, shared by the live preview and
the share page, is tested only against a hand-copied fixture string, never
real `poetic` output — the same cross-tool-seam gap that already caused two
resolved incidents (TD26071401, TD26071602).

Fix: add a test piping real `.poem` source with an `{Analysis}` block
through `renderPoem()` and `wireAnalysisToggles`, mirroring
`render-share.test.ts`'s pattern.

### TD26072425 Draft autosave writes to localStorage synchronously on every keystroke

*Filed 2026-07-24, from the 2026-07-23 project review (R-23, F-PERF-01).*
`saveDraft` runs on every `onChange` event with no debounce, while the more
expensive `renderPoem()` call one line below is debounced to 200ms. Not
currently user-visible, but the asymmetry is real.

Fix: fold `saveDraft` into the same or a shorter debounce as the render
call.

### TD26072426 Code-quality quick wins (test boilerplate, error-message helper, PageHeader)

*Filed 2026-07-24, from the 2026-07-23 project review (R-24, F-CODE-03,
F-CODE-04, F-CODE-05).* Six `Editor.*.test.tsx` files repeat identical
mock/fixture boilerplate; `err instanceof Error ? err.message : String(err)`
is duplicated 10 times; three route components inline the same page-header
JSX.

Fix: factor shared test mocks into `editor-test-support.ts`; extract an
`errorMessage()` helper; extract a `PageHeader` component if a fourth route
needs it.

### TD26072427 Unauthenticated cache-bust action; weak minimum password length

*Filed 2026-07-24, from the 2026-07-23 project review (R-25, F-SEC-02,
F-SEC-03).* `revalidateSharedPoem` has no authorization check before
invalidating a share page's cache tag (low-impact given the token's
entropy). `SignInPrompt.tsx` allows 6-character passwords with no strength
guidance.

Fix: no change needed to `revalidateSharedPoem` unless this pattern is
reused for a less entropy-rich identifier; raise password `minLength` to
~8-10.

### TD26072428 No test coverage tooling or watch-mode script

*Filed 2026-07-24, from the 2026-07-23 project review (R-26, F-TEST-03,
F-TEST-04).* No coverage tool is configured anywhere; `package.json`'s only
test script is a single-shot `vitest run`.

Fix: add `@vitest/coverage-v8` and a `coverage` script; add a `test:watch`
script.

### TD26072429 Undocumented TypeScript/ESLint major-version holds

*Filed 2026-07-24, from the 2026-07-23 project review (R-27, F-DEPS-04).*
`typescript` (two majors behind) and `eslint` (one major behind) both had
Dependabot bump PRs closed unmerged with no recorded reason, unlike
jsdom's well-documented TD26071901 hold.

Fix: trial each bump; merge if clean, or record the specific breakage as a
dated entry matching jsdom's style.

### TD26072430 README/tooling polish (missing scripts, WSL pointer, postinstall error message)

*Filed 2026-07-24, from the 2026-07-23 project review (R-28, F-TOOL-03,
F-TOOL-04, F-TOOL-06).* README's commands table omits `start`/`test:db`;
the WSL npm-shadowing workaround (`scripts/setup-linux.sh`) is undocumented
outside its own header and an agent-only skill file;
`sync-poetic-css.mjs`'s postinstall step fails with a raw stack trace
instead of an actionable message.

Fix: add the missing README rows; add a WSL pointer; wrap
`sync-poetic-css.mjs`'s `require.resolve` in `try`/`catch`.

### TD26072431 Editor/dashboard loading & feedback polish

*Filed 2026-07-24, from the 2026-07-23 project review (R-29, F-UX-05,
F-UX-06, F-UX-07).* `EditorClient`/`PoemsDashboardClient` render a blank
gap until client JS hydrates (no `loading` fallback); `useSession()`'s
async initial resolution can briefly show a false sign-in prompt to an
already-signed-in poet; `SignInPrompt.tsx` gives no "in progress" feedback.

Fix: pass a `loading` fallback to the `next/dynamic` calls; add a loading
state to `useSession()`; add pending-state button text to `SignInPrompt.tsx`.

### TD26072432 Doc polish (rejected-alternative narration, missing live-app link)

*Filed 2026-07-24, from the 2026-07-23 project review (R-30, F-DOC-04,
F-DOC-05).* `docs/TRIAGE.md` and `docs/SENTRY-AGENT-ACCESS.md` narrate
rejected alternatives ("was trialled and dropped") with no as-built
exemption. README never links the live app despite CHANGELOG.md
documenting it as deployed.

Fix: trim the rejected-alternative narration to one-liners; add a "Live
at..." link to README.

### TD26072433 No documented backup/restore or export/delete runbooks

*Filed 2026-07-24, from the 2026-07-23 project review (R-31, F-OPS-02,
F-DATA-03).* No document states the Supabase Pro project's actual
backup/PITR coverage or restore steps, or the operational steps for
fulfilling a privacy export/delete request.

Fix: add a short paragraph on the actual backup/PITR guarantee; add a short
internal runbook for export/delete requests, mirroring TRIAGE.md's style.

### TD26072434 Two independently-maintained sanitisation pipelines, no shared policy constant

*Filed 2026-07-24, from the 2026-07-23 project review (R-32, F-ARCH-03).*
The live preview (`PoemPreview.tsx`) and the share page (`render-share.ts`)
each independently configure DOMPurify and embed-activation logic for the
same class of untrusted content, each commented with its own rationale but
with no shared allow-list or config object between them.

Fix: not urgent; when next touching either pipeline, factor the common
baseline into a shared module.

### TD26072435 No automated accessibility testing

*Filed 2026-07-24, from the 2026-07-23 project review (R-33, F-UX-04).* No
`axe-core`/`jest-axe`/`pa11y` tooling exists anywhere in the repo. Manual
review already found real labelling and contrast defects (TD26072404,
TD26072416) that green CI didn't catch.

Fix: add a `vitest-axe` (or equivalent) smoke test over the Editor and
Dashboard component trees.

## Ledger

Every tech-debt ID ever allocated — open, in-progress, resolved, or not-debt —
is listed here forever, in ID order. This is what makes numbering unambiguous:
the next free ID for a given date is one more than the highest `NN` seen
below for that date, regardless of whether the corresponding entry still has
a body above.

A row can also close as `not-debt`: the item was filed here but turned out, on
reflection, not to be a deferred cost at all (e.g. deliberately reserved
syntax awaiting a future feature). Its `### <id>` section is removed like a
resolved one, but nothing was fixed, so the `Resolved` column stays blank; the
`Ref` column instead points to wherever the content moved.

| ID | Title | Status | Resolved | Ref |
|----|-------|--------|----------|-----|
| TD26071301 | poetic git dependency needs types shim + transpilePackages | resolved | 2026-07-13 | https://github.com/Poetic-Poems/poetic-fiddle/pull/14 |
| TD26071401 | Analysis show/hide toggle is inert under DOMPurify sanitisation | resolved | 2026-07-16 | https://github.com/Poetic-Poems/poetic-fiddle/pull/32 |
| TD26071501 | Auth needs manual Supabase/Vercel dashboard configuration | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/24 |
| TD26071502 | Privacy policy needed for Google OAuth brand verification | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/26 |
| TD26071503 | Point the Google OAuth consent screen at the published privacy policy | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/27 |
| TD26071504 | OAuth consent screen App name doesn't match the home page | resolved | 2026-07-21 | https://github.com/Poetic-Poems/poetic-fiddle/pull/84 |
| TD26071601 | Auth email reaches only project-team addresses (no custom SMTP) | resolved | 2026-07-16 | https://github.com/Poetic-Poems/poetic-fiddle/pull/34 |
| TD26071602 | Analysis synopsis/full selector is inert under DOMPurify sanitisation | resolved | 2026-07-16 | https://github.com/Poetic-Poems/poetic-fiddle/pull/33 |
| TD26071701 | No way to revoke a share link | resolved | 2026-07-17 | https://github.com/Poetic-Poems/poetic-fiddle/pull/39 |
| TD26071801 | `npm test` fails on Node 26 (26 tests, all localStorage) | resolved | 2026-07-18 | https://github.com/Poetic-Poems/poetic-fiddle/pull/46 |
| TD26071802 | poem-title CSS override is a brittle regex against vendored CSS | resolved | 2026-07-18 | https://github.com/Poetic-Poems/poetic-fiddle/pull/47 |
| TD26071803 | Merged migrations don't reach the live Supabase project on their own | resolved | 2026-07-18 | https://github.com/Poetic-Poems/poetic-fiddle/pull/49 |
| TD26071804 | npm 12 blocks the `poetic` git dependency by default | resolved | 2026-07-18 | https://github.com/Poetic-Poems/poetic-fiddle/pull/53 |
| TD26071805 | `database.yml`'s live-migration push is failing silently | resolved | 2026-07-19 | https://github.com/Poetic-Poems/poetic-fiddle/pull/70 |
| TD26071901 | jsdom pinned to 26.x — 27+ pulls an ESM-only dep Turbopack can't require | open | | |
| TD26071902 | `supabase/setup-cli@v1` targets the deprecated Node.js 20 runtime | resolved | 2026-07-19 | https://github.com/Poetic-Poems/poetic-fiddle/pull/72 |
| TD26072101 | Site-wide CSP allows `'unsafe-inline'` for script-src and style-src | resolved | 2026-07-22 | https://github.com/Poetic-Poems/poetic-fiddle/pull/95 |
| TD26072401 | Vendored poetic.css fails WCAG AA contrast for byline/footer/link text | open | | |
| TD26072402 | CodeMirror `.poem` syntax-highlight colours not contrast-verified | open | | |
| TD26072403 | `next` is one patch behind on advisories affecting Server Actions | resolved | 2026-07-24 | https://github.com/Poetic-Poems/poetic-fiddle/pull/102 |
| TD26072404 | CodeMirror editor has no accessible name for screen readers | resolved | 2026-07-24 | https://github.com/Poetic-Poems/poetic-fiddle/pull/101 |
| TD26072405 | Branch protection doesn't require CI to pass before merge | open | | |
| TD26072406 | CLAUDE.md's Status section understates what's built | resolved | 2026-07-24 | https://github.com/Poetic-Poems/poetic-fiddle/pull/104 |
| TD26072407 | Privacy Policy says poem storage "isn't available yet," but it's live | open | | |
| TD26072408 | Missing `.env.local` breaks the editor silently, client-side only | resolved | 2026-07-24 | https://github.com/Poetic-Poems/poetic-fiddle/pull/107 |
| TD26072409 | Node version guidance disagrees across README/`engines`/no `.nvmrc` | open | | |
| TD26072410 | `SignInPrompt` leaks raw Supabase Auth errors, bypassing the app's safe-message convention | resolved | 2026-07-24 | https://github.com/Poetic-Poems/poetic-fiddle/pull/106 |
| TD26072411 | No timeout on outbound Supabase calls; a stalled request hangs the UI indefinitely | open | | |
| TD26072412 | `use-session.ts` and `SharedPoemView`'s `escapeHtml` are untested | open | | |
| TD26072413 | `revalidateSharedPoem` failures are silently swallowed with no Sentry capture | open | | |
| TD26072414 | No self-service delete path for a poem, though the schema already supports it | open | | |
| TD26072415 | CI floats the Supabase CLI and npm versions instead of pinning them | open | | |
| TD26072416 | Parse-error text fails AA contrast; share page has no visible heading | open | | |
| TD26072417 | README doesn't document the local-only Supabase dev workflow | open | | |
| TD26072418 | No CONTRIBUTING file or PR/issue templates | open | | |
| TD26072419 | CODEOWNERS' two reviewer accounts appear to be the same person | open | | |
| TD26072420 | OBSERVABILITY-PLAN.md narrates a fixed bug's history, duplicating CHANGELOG.md | open | | |
| TD26072421 | No mechanism detects a new `poetic` release | open | | |
| TD26072422 | CHANGELOG.md and GitHub release notes are unreconciled | open | | |
| TD26072423 | `Editor.tsx` mixes five concerns in one 581-line component | open | | |
| TD26072424 | Analysis-toggle DOM wiring is tested only against a hand-authored fixture | open | | |
| TD26072425 | Draft autosave writes to localStorage synchronously on every keystroke | open | | |
| TD26072426 | Code-quality quick wins (test boilerplate, error-message helper, PageHeader) | open | | |
| TD26072427 | Unauthenticated cache-bust action; weak minimum password length | open | | |
| TD26072428 | No test coverage tooling or watch-mode script | open | | |
| TD26072429 | Undocumented TypeScript/ESLint major-version holds | open | | |
| TD26072430 | README/tooling polish (missing scripts, WSL pointer, postinstall error message) | open | | |
| TD26072431 | Editor/dashboard loading & feedback polish | open | | |
| TD26072432 | Doc polish (rejected-alternative narration, missing live-app link) | open | | |
| TD26072433 | No documented backup/restore or export/delete runbooks | open | | |
| TD26072434 | Two independently-maintained sanitisation pipelines, no shared policy constant | open | | |
| TD26072435 | No automated accessibility testing | open | | |
| TD26072436 | `fast-uri` high-severity advisory, transitive via `@sentry/nextjs` | resolved | 2026-07-24 | https://github.com/Poetic-Poems/poetic-fiddle/pull/103 |
