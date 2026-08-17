# Improvement prompts

One prompt per recommendation, in priority order (severity first, quick wins
first at equal severity). Each prompt is self-contained and may be pasted
into a fresh AI agent session with no other context from this review.
Ordering dependencies: none — all twelve recommendations are independent and
may be executed in any order or in parallel, except that R-04 cannot be
completed inside this repository at all (see its prompt).

## Prompt for R-01 — Align Terms of Service with the Privacy Policy's self-service account deletion

**Bundles:** R-01 only · **Run after:** no prerequisites

```text
Poetic Fiddle (github.com/Poetic-Poems/poetic-fiddle) is a Next.js (App
Router) + TypeScript web editor for the `.poem` poetry format. Its legal
pages live at `src/app/terms/page.tsx` and `src/app/privacy/page.tsx`, both
rendered via the shared `src/components/PageHeader.tsx` component.

Problem: `src/app/terms/page.tsx`'s "Termination" section (around line 147)
still says: "You can delete your account and its data at any time by
emailing warwick@datumprocess.co.nz, as set out in our Privacy Policy." This
is stale. `src/app/privacy/page.tsx`'s equivalent section was updated in a
prior pull request to correctly describe the self-service account-deletion
flow that ships in `src/components/AccountDangerZone.tsx` (reachable from
the "My poems" dashboard's Danger Zone), keeping the mailto only as a
fallback for a poet who can't sign in. The Terms page was never given the
same update, so the two legal pages now contradict each other on the same
fact — on the one page whose purpose is explaining account termination, to
an audience of non-technical poets.

Goal (acceptance criteria):
- `src/app/terms/page.tsx`'s Termination section describes self-service
  deletion (via the My poems dashboard's Danger Zone) as the primary path,
  with emailing the maintainer documented as the fallback for someone who
  can't sign in — matching `src/app/privacy/page.tsx`'s current wording in
  substance (reword rather than copy verbatim; the two pages have distinct
  voices).
- The page's `lastUpdated` prop (passed to `PageHeader`) is bumped to the
  date of this change.
- No other content on either legal page changes.

Constraints: this is a content-only change to one file (plus the date
prop). Do not touch `AccountDangerZone.tsx`, the deletion route, or
`privacy/page.tsx`. Match the existing prose style and heading structure of
`terms/page.tsx`.

Verification: run `npm run lint`, `npm run typecheck`, `npm run
format:check`, and `npm test` (there is a `src/app/terms/page.test.tsx` —
check whether it asserts on the old copy and update it if so). All must
pass before declaring this done.

Work cost-consciously. This is a small, well-specified content edit — it
suits a low-cost model tier end to end; no delegation to subagents is
needed for a change this size.

Deliverable: a single commit/PR with the updated copy, on a short-lived
branch per this repository's branch-workflow rules in `CLAUDE.md` (PR
required, conventional-commit title, e.g. `fix(legal): align Terms of
Service with self-service account deletion`). If this repository's
tech-debt register has an open item for this specific gap (check
`tech-debt/` for one referencing "Terms of Service" and "account
deletion"), resolve it per `TECH-DEBT.md`'s workflow as part of this PR.
```

## Prompt for R-02 — Close the two security-adjacent test-coverage gaps

**Bundles:** R-02 (three small, independent test additions found together in the same review pass — bundled for one PR's worth of review overhead, not because one depends on another) · **Run after:** no prerequisites

```text
Poetic Fiddle (github.com/Poetic-Poems/poetic-fiddle) is a Next.js (App
Router) + TypeScript web editor for the `.poem` poetry format, using Vitest
for testing (`npm test`, `npm run coverage`).

Problem 1: `src/lib/render-share.ts`'s `renderSharedPoemHtml` function
(around lines 106-119) is the try/catch that turns a saved-but-unparseable
`.poem` source into a friendly degrade on the public share page, instead of
a 500. It is reachable in practice: the app never validates `source_text`
at save time, and the `poetic` package's `renderPoem` genuinely throws a
classified error on unparseable source. `src/lib/render-share.test.ts`
exercises the inner `sanitizeSharedPoemHtml` with real `poetic` output, but
never calls the outer `renderSharedPoemHtml` wrapper at all;
`src/app/share/[share_id]/page.test.tsx` covers the page's rendering of the
error state only by fully mocking `renderSharedPoemHtml`. The catch body's
real behaviour is therefore untested.

Problem 2: `src/lib/supabase-server.ts` exports `getSupabaseAdmin()` and
`getSupabaseServer()`. Per its own doc comment, `getSupabaseAdmin()` is the
only code path in the app that can bypass row-level security, and it backs
`src/app/api/account/delete/route.ts`. Both functions are supposed to throw
if their required environment variable is unset, but every real consumer
(`route.test.ts`, `src/lib/shared-poem-cache.test.ts`) mocks the module
entirely — this fail-closed guard is currently verified only by reading the
code, never by a test.

Problem 3: `src/components/Editor.share.test.tsx` has one
`vi.useFakeTimers({ shouldAdvanceTime: true })` test that restores real
timers manually at the end of the test body, rather than via `afterEach`.
Sibling files (`src/lib/use-poem-persistence.test.ts`,
`src/components/PoemPreview.test.tsx`, `src/components/SharedPoemView.test.tsx`)
all have `afterEach(() => vi.useRealTimers())` as a safety net so a failing
assertion mid-test doesn't leak fake timers into the next test in the file;
this file doesn't.

Goal (acceptance criteria):
- `render-share.test.ts` gains a case that calls `renderSharedPoemHtml`
  (not `sanitizeSharedPoemHtml`) with genuinely unparseable `.poem` source
  and asserts the result is `{ html: "", error: true }` (check the actual
  return shape in the source — match it exactly) and that
  `reportSwallowedError` (from `src/lib/observability.ts`) is called.
- A new test file (or an addition to an existing one) for
  `supabase-server.ts`, run without mocking the module, asserts
  `getSupabaseAdmin()` and `getSupabaseServer()` each throw when their
  respective required environment variable is unset, and construct
  successfully (return a client, don't throw) when it is set. Use
  `vi.stubEnv`/module re-import as needed to test both branches per
  function.
- `Editor.share.test.tsx` gains `afterEach(() => vi.useRealTimers())` at
  the top of its `describe` block, matching the pattern in the three
  sibling files named above; the existing manual `vi.useRealTimers()` call
  may stay or be removed (either is fine, but no duplicate real-timer
  restore should cause a test failure).

Constraints: do not change the production behaviour of `render-share.ts` or
`supabase-server.ts` — this is test-only. Match each file's existing test
style (Vitest, Testing Library conventions already used elsewhere in
`src/`).

Verification: run `npm test` (all tests, including new ones, must pass) and
`npm run coverage`; confirm `render-share.ts` and `supabase-server.ts` both
show non-zero coverage on the previously-uncovered lines. Run `npm run
lint`/`typecheck`/`format:check` — all must be clean.

Work cost-consciously. All three additions are mechanical, well-specified
test-writing against clearly stated acceptance criteria — this whole task
suits a low-cost model tier. If your environment supports subagents, the
three problems are independent enough to delegate to separate subagents in
parallel; verify each one's tests actually pass before integrating.

Deliverable: one commit/PR (branch-workflow rules per this repo's
`CLAUDE.md`; conventional-commit title, e.g. `test(coverage): cover
render-share error path and supabase-server env guards`). If a tech-debt
item exists for this gap (check `tech-debt/` for one referencing
`supabase-server.ts` or `render-share.ts` coverage), resolve it per
`TECH-DEBT.md`'s workflow as part of this PR.
```

## Prompt for R-03 — Establish a working release/rollback story

**Bundles:** R-03 only · **Run after:** no prerequisites

```text
Poetic Fiddle (github.com/Poetic-Poems/poetic-fiddle) is a Next.js app
deployed continuously to Vercel from `main`. Its release tooling lives at
`.github/workflows/release.yml`, `docs/RELEASE-RUNBOOK.md`, and
`CHANGELOG.md` (Keep a Changelog format, with an `[Unreleased]` section
meant to be renamed to a version heading at release time, enforced by a
`changelog-rename` CI check).

Problem: `package.json`'s `version` is still `"0.1.0"`, and the only
GitHub release (`v0.1.0`) predates the app's MVP by about a week — the
release mechanism appears to have been exercised once, at the initial
scaffold, and never since, despite roughly 180 commits and continuous
production deployment since. `CHANGELOG.md`'s `[Unreleased]` section has
never been renamed. No document in the repository names a rollback
mechanism for a bad production deploy.

Goal: read `docs/RELEASE-RUNBOOK.md` in full to understand the documented
release procedure, then do ONE of the following two things — this is a
judgement call for the project maintainer, so if you cannot reach the
maintainer for a decision, do the second (documentation-only) option, which
is reversible and lower-risk, and note in your deliverable that the first
option remains available as a future choice:

Option A — cut a real release: follow `docs/RELEASE-RUNBOOK.md`'s
documented procedure exactly (version bump, rename the CHANGELOG heading,
let `release.yml` tag and publish on push) so a current, meaningful release
exists.

Option B — document the actual mechanism: add a short, clearly-labelled
paragraph to `docs/RELEASE-RUNBOOK.md` (or `README.md`, whichever the
runbook's own structure suggests) stating plainly that Vercel's own
deployment history is the project's actual rollback mechanism (not git
tags), and give the concrete steps (Vercel dashboard → Deployments → find a
prior good deployment → redeploy/promote it) as far as you can determine
them from Vercel's own current documentation or the project's existing
Vercel configuration. Do not invent steps you cannot verify — if you can't
confirm the exact UI flow, say so and describe what you were and weren't
able to verify.

Constraints: do not touch `release.yml`'s logic itself unless Option A
reveals a real bug in it (unlikely — it was found well-designed in review).
Follow this repository's own documentation conventions from `CLAUDE.md`:
docs are as-built only, no historical-narrative phrasing.

Verification: for Option A, confirm the new tag/release exists (`gh api
repos/Poetic-Poems/poetic-fiddle/releases`) and that `changelog-rename`'s
CI check passes. For Option B, run `npm run check`/whatever this repo's
trailing-whitespace/format gate is (see `package.json`'s scripts) against
the doc changes.

Work cost-consciously. Option B is mechanical documentation work suiting a
low-cost tier. Option A involves a real, visible release action (a
judgement call, and something that becomes part of the project's public
history) — if you delegate any part of it to a subagent, verify its work
yourself at a mid-to-high-capability tier before the release actually goes
out.

Deliverable: a PR per this repo's branch-workflow rules (conventional-commit
title, e.g. `docs(release): document Vercel as the rollback mechanism` or
`chore(release): cut vX.Y.Z`). If a tech-debt item exists for this gap
(check `tech-debt/` for one referencing "release" or "rollback"), resolve
it per `TECH-DEBT.md`'s workflow as part of this PR.
```

## Prompt for R-04 — Fix the orphan-branch sweeper's stale-resurrection gap (cross-repo)

**Bundles:** R-04 only · **Run after:** no prerequisites

```text
This task concerns a script called `scripts/sweep-orphan-branches.sh`,
which is PIPELINE/ORCHESTRATION INFRASTRUCTURE — it does NOT live in the
`poetic-fiddle` repository (github.com/Poetic-Poems/poetic-fiddle). A
project review of `poetic-fiddle` observed this script's behaviour causing
problems there, but could not identify which repository actually contains
it.

Your first and most important task is to locate the actual repository that
contains `scripts/sweep-orphan-branches.sh` — it is very likely a
different repository in the same organisation or a related automation/
orchestration project, not `poetic-fiddle` itself. Search available
repositories (e.g. via `gh search code sweep-orphan-branches`, or by asking
whoever assigned you this task where the pipeline/orchestration code
lives) before writing any code. If you cannot find it, STOP and report
that back rather than guessing or creating a new script under this name in
the wrong repository.

Problem (observed symptom, in `poetic-fiddle`, not the cause): this
sweeper resurrects a branch that has no open pull request into a new
"resume orphaned branch" PR, purely on the basis that no open PR exists —
without checking whether the branch's changes are already reflected in the
current state of the target repository's default branch. This produced two
concrete incidents in one day in `poetic-fiddle`:
1. PR #223 tried to flip two tech-debt records (`tech-debt/TD-PPpfid-26071901.md`,
   `tech-debt/TD-PPpfid-26072429.md`) from `open` to `resolved`. While it
   sat waiting for human review, a different PR (#225) independently landed
   the first flip; PR #223 then conflicted with `main` on that exact file.
2. PR #229 resurrected a branch to flip `tech-debt/TD-PPpfid-26072401.md`
   to `resolved` — but that item was already `resolved` on `main` a week
   earlier via a different, already-merged PR (#146).

Goal (acceptance criteria, once you've located the actual repository):
before opening a "resume orphaned branch" PR, the sweeper should check
whether the target repository's current default branch already reflects
the state the orphaned commit was trying to reach, and skip (or close/
delete) the branch instead of opening a PR if so. The exact check depends
on what the sweeper is generically capable of determining — at minimum, if
every file the orphaned commit touches is byte-identical between the
orphaned commit's target state and the current default branch, the
resurrection should be skipped. A more thorough check (for the tech-debt-
register case specifically) would parse each touched tech-debt item's
`status:` frontmatter and skip if it's already in the status the orphaned
commit would set it to.

Constraints: do not modify anything in `poetic-fiddle` as part of this
task — the fix belongs entirely in the sweeper's own repository. Preserve
the sweeper's existing behaviour for the case where a branch's changes are
NOT yet reflected on the default branch (i.e., don't break the sweeper's
core purpose of recovering genuinely-orphaned work).

Verification: whatever the sweeper repository's own test/CI conventions
are — follow them. At minimum, add a test case simulating "branch content
already merged via a different PR" and confirm the sweeper now skips it.

Work cost-consciously. Locating the right repository and understanding an
unfamiliar codebase's conventions is ambiguous, cross-cutting work — use a
mid-to-high-capability tier for that investigation. Once the fix's shape is
clear, the implementation itself may suit a lower tier.

Deliverable: if you locate the repository and can make the fix, a PR there
following its own contribution conventions, referencing this observation
(you may link to `poetic-fiddle` PRs #223 and #229 as the evidence). If you
cannot locate the repository, report clearly that this recommendation is
blocked pending someone identifying where the sweeper lives — do not create
a new script under this name in `poetic-fiddle` or any other repository as
a workaround.
```

## Prompt for R-05 — Dependabot hygiene: eslint ignore rule, merge the stale Actions bump

**Bundles:** R-05 (two small, independent, low-risk Dependabot actions found together in the same review pass — bundled for efficiency, not because one depends on the other) · **Run after:** no prerequisites

```text
Poetic Fiddle (github.com/Poetic-Poems/poetic-fiddle) uses Dependabot,
configured in `.github/dependabot.yml`, for both the `npm` and
`github-actions` ecosystems.

Problem 1: pull request #129 (`chore(deps-dev): Bump eslint from 9.39.5 to
10.8.0`) is permanently unmergeable — `eslint-config-next` (a dependency of
this project) does not yet support ESLint 10, because it calls an API
(`context.getFilename()`) that ESLint 10 removed. This is documented in
`tech-debt/TD-PPpfid-26072429.md`. `.github/dependabot.yml` already has
`ignore: version-update:semver-major` rules for two other similarly-blocked
major-version dependencies (`jsdom`, `typescript`) — read those existing
entries for the exact style/format to match — but has no equivalent entry
for `eslint`, so Dependabot keeps re-proposing a bump that can never merge.

Problem 2: pull request #170 (`chore(deps): Bump github/codeql-action from
4 to 4.37.3`) is clean, green, and mergeable, but has sat open for over a
week — the one visible outlier against this project's otherwise same-day
Dependabot merge cadence on the `npm` ecosystem.

Goal (acceptance criteria):
- `.github/dependabot.yml` gains an `ignore` entry for `eslint`
  (`dependency-name: eslint`, `versions: ["semver-major"]` or whatever
  syntax the existing `jsdom`/`typescript` entries use — match it exactly),
  with a comment referencing `tech-debt/TD-PPpfid-26072429.md` the same way
  the existing entries reference their own tech-debt items.
- PR #129 is closed (`gh pr close 129`), since the ignore rule means
  Dependabot will not reopen it on its own next cycle in a way that
  conflicts with this change.
- PR #170 is merged: check it's still green and mergeable
  (`gh pr view 170 --json mergeable,mergeStateStatus`), rebase/update the
  branch if needed, then merge per this repo's normal PR process (it may
  already be pre-approved as a routine Dependabot bump — check
  `CONTRIBUTING.md`/branch-protection rules for whether it needs explicit
  review).

Constraints: do not touch any other `dependabot.yml` entries. Do not
attempt to fix the underlying `eslint-config-next`/ESLint 10
incompatibility — that is out of scope and upstream.

Verification: after adding the ignore rule, confirm
`.github/dependabot.yml` is still valid YAML and matches the existing
entries' structure. Confirm PR #129 is closed and PR #170 is merged via
`gh pr view`.

Work cost-consciously. This whole task is mechanical, well-specified
configuration and routine PR housekeeping — it suits a low-cost model tier
end to end.

Deliverable: one PR for the `dependabot.yml` change (branch-workflow rules
per this repo's `CLAUDE.md`; conventional-commit title, e.g.
`chore(deps): ignore blocked eslint major bump`), plus the separate actions
of closing PR #129 and merging PR #170 (these don't need their own PRs —
they're direct repository actions). If a tech-debt item exists for this gap
(check `tech-debt/` for one referencing "Dependabot" or the eslint hold),
resolve it per `TECH-DEBT.md`'s workflow as part of the `dependabot.yml`
PR.
```

## Prompt for R-06 — Add axe coverage for the two destructive-action confirmation dialogs

**Bundles:** R-06 only · **Run after:** no prerequisites

```text
Poetic Fiddle (github.com/Poetic-Poems/poetic-fiddle) is a Next.js + React
app using `jest-axe` for component-level accessibility testing (see
`src/components/Editor.a11y.test.tsx` and
`src/components/PoemsDashboard.a11y.test.tsx` for the existing pattern —
render the component, interact with it, call `axe(container)`, assert no
violations).

Problem: `src/components/PoemsDashboard.a11y.test.tsx` renders
`PoemsDashboard` in a couple of states but never opens the per-row delete
confirmation (the markup that appears when `confirmDeleteId` is set, around
`src/components/PoemsDashboard.tsx` lines 294-322) before running `axe()`.
The same test file also renders `AccountDangerZone`
(`src/components/AccountDangerZone.tsx`), but its confirmation `<dialog>`
content (lines 113-172, conditionally rendered only when `open` is `true`)
is likewise never opened before the axe scan. Both confirmations already
have separately, thoroughly tested keyboard/focus behaviour (see
`src/components/PoemsDashboard.test.tsx`'s "delete focus management"
describe block for the pattern of how to trigger the delete confirmation
in a test) — this is specifically a gap in the automated accessibility
regression net, not a known live defect.

Goal (acceptance criteria):
- In `PoemsDashboard.a11y.test.tsx` (or a new adjacent test), open the
  delete-poem confirmation using the same interaction
  `PoemsDashboard.test.tsx`'s focus-management tests use, then run `axe()`
  against the container and assert no violations.
- Similarly, open the `AccountDangerZone` confirmation dialog (trigger
  whatever click/interaction sets its `open` state to `true` — read the
  component to find it) and run `axe()` against it, asserting no
  violations.
- Both new assertions must actually execute the axe scan against the
  *opened* state, not just render the closed component again.

Constraints: test-only change. Do not modify
`PoemsDashboard.tsx`/`AccountDangerZone.tsx` unless the new axe scan
reveals a genuine violation — if it does, fix the minimal markup issue and
note that in your deliverable (this would be a real finding beyond what
this prompt anticipated).

Verification: run `npm test` — both new/modified test cases must pass. Run
`npm run lint`/`typecheck`/`format:check` — clean.

Work cost-consciously. This is mechanical test-writing following an
existing, well-established pattern in the same file — suits a low-cost
model tier.

Deliverable: one commit/PR (branch-workflow rules per this repo's
`CLAUDE.md`; conventional-commit title, e.g. `test(a11y): scan open
delete-confirmation dialogs`). If a tech-debt item exists for this gap
(check `tech-debt/` for one referencing axe coverage of confirmation
dialogs), resolve it per `TECH-DEBT.md`'s workflow as part of this PR.
```

## Prompt for R-07 — Extend the Supabase auth-drift allowlist to rate-limit/CAPTCHA

**Bundles:** R-07 only · **Run after:** no prerequisites

```text
Poetic Fiddle (github.com/Poetic-Poems/poetic-fiddle) runs a daily scheduled
GitHub Actions workflow, `.github/workflows/supabase-auth-drift.yml`, which
invokes `scripts/check-supabase-auth-drift.mjs` to compare specific
Supabase Auth settings between the committed `supabase/config.toml` and the
live Supabase project (via the Management API), filing a deduplicated
GitHub issue on any disagreement.

Problem: `scripts/check-supabase-auth-drift.mjs`'s `ALLOWLIST` constant
(around lines 85-169) has one entry per monitored setting — password
length/complexity, signup/anonymous-user toggles, JWT expiry,
refresh-token rotation, email OTP settings, and every MFA field — but
nothing for `supabase/config.toml`'s `[auth.rate_limit]` section (fields
like `sign_in_sign_ups`, `token_verifications`, `email_sent`, around lines
176-188 of that file) or its `[auth.captcha]` section (currently disabled,
around lines 191-194). A live drift in either would produce no red run and
no filed issue, unlike every other monitored auth control.

Goal (acceptance criteria):
- `ALLOWLIST` in `scripts/check-supabase-auth-drift.mjs` gains an entry for
  each field under `supabase/config.toml`'s `[auth.rate_limit]` section,
  following the exact same pattern as the existing entries (read several
  existing entries first to match the shape/verification methodology
  precisely — this script deliberately reviews each key individually
  rather than diffing the whole `[auth]` tree, so preserve that design).
- For `[auth.captcha]`: if you can determine from `docs/REQUIREMENTS.md` or
  `docs/IMPLEMENTATION-PLAN.md` that CAPTCHA is a deliberate "not yet"
  decision, add a one-line note recording that in whichever of those two
  documents already tracks similar decisions (don't invent a new doc
  section for it). If you cannot determine intent, add CAPTCHA to the
  allowlist too, on the assumption that its current "disabled" state is the
  intended baseline to guard.
- Update `scripts/check-supabase-auth-drift.test.mjs` (the existing test
  file for this script) with cases covering the new allowlist entries.

Constraints: do not change the script's overall architecture (assert-only,
never pushes changes to Supabase; strips its own access token from any
logged/published output). Do not change any other allowlist entries.

Verification: run `npm test` (the script's test file must pass with the
new cases). If you have access to run the script against a real or
sandboxed Supabase project, do so with `node
scripts/check-supabase-auth-drift.mjs`; otherwise rely on the unit tests.
Run `npm run lint`/`typecheck`/`format:check` — clean.

Work cost-consciously. This is mechanical extension of an existing,
well-established pattern — suits a low-cost model tier. The one judgement
call (CAPTCHA intent) is small enough not to need escalation to a higher
tier; just follow the fallback given above if intent can't be determined.

Deliverable: one commit/PR (branch-workflow rules per this repo's
`CLAUDE.md`; conventional-commit title, e.g. `feat(auth-drift): cover
rate-limit and CAPTCHA settings`). If a tech-debt item exists for this gap
(check `tech-debt/` for one referencing the auth-drift allowlist), resolve
it per `TECH-DEBT.md`'s workflow as part of this PR.
```

## Prompt for R-08 — Add a unit test for `sync-poetic-css.mjs`

**Bundles:** R-08 only · **Run after:** no prerequisites

```text
Poetic Fiddle (github.com/Poetic-Poems/poetic-fiddle) has a `scripts/`
directory of small `.mjs` utility scripts, most with a matching
`*.test.mjs` file run by Vitest (`npm test` picks up `*.test.mjs` anywhere
in the tree automatically — no config change needed to add one). Look at
`scripts/check-changelog-rename.test.mjs` for an example of the existing
test style for this kind of script.

Problem: `scripts/sync-poetic-css.mjs` (which runs on every `npm install`
via the `postinstall` script in `package.json`, copying `poetic`'s CSS
export into a generated TypeScript module) has no matching
`sync-poetic-css.test.mjs`, unlike every one of its sibling scripts. It has
a real, worth-testing branch: when `require.resolve("poetic/browser/poetic.css")`
fails (e.g. because the pinned `poetic` version's export path has moved),
the script catches that and throws a more actionable, specific error
message — read the script's current source to find the exact try/catch and
message wording before writing the test.

Goal (acceptance criteria): a new `scripts/sync-poetic-css.test.mjs`
exists, using the same test framework/mocking approach as the other
`scripts/*.test.mjs` files, that:
- Mocks/stubs module resolution so `require.resolve` throws (simulating
  the CSS export path having moved).
- Asserts the script's actual behaviour in that case matches what the
  source code currently does — if it throws, assert on the thrown error's
  message content; if it calls `process.exit`, mock that and assert it was
  called with a non-zero code, whichever the real implementation does.
- Also covers the success path (resolution succeeds, the file is written)
  if that's not disproportionately harder to set up than the sibling
  tests' scope suggests it should be — check how thorough the sibling
  `*.test.mjs` files are and match that level, not more.

Constraints: do not modify `sync-poetic-css.mjs`'s production behaviour —
this is a test-only addition, unless writing the test reveals the script is
actually untestable as currently structured (e.g. it calls
`process.exit()` directly with no way to intercept), in which case make the
minimal refactor needed to make it testable (e.g. extract the core logic
into an exported function) while preserving its exact current behaviour
when run as a script.

Verification: run `npm test` — the new test file's cases must pass. Run
`npm run lint`/`typecheck`/`format:check` — clean. Run `npm run coverage`
and confirm `scripts/sync-poetic-css.mjs` now shows non-zero coverage.

Work cost-consciously. This is mechanical test-writing mirroring an
existing pattern in sibling files — suits a low-cost model tier.

Deliverable: one commit/PR (branch-workflow rules per this repo's
`CLAUDE.md`; conventional-commit title, e.g. `test(scripts): cover
sync-poetic-css.mjs's resolve-failure path`). If a tech-debt item exists
for this gap (check `tech-debt/` for one referencing `sync-poetic-css.mjs`
test coverage), resolve it per `TECH-DEBT.md`'s workflow as part of this
PR.
```

## Prompt for R-09 — Extract a shared page-heading component

**Bundles:** R-09 only · **Run after:** no prerequisites

```text
Poetic Fiddle (github.com/Poetic-Poems/poetic-fiddle) is a Next.js (App
Router) + TypeScript app. `src/components/PageHeader.tsx` already exists
as a shared heading component with a `{title, lastUpdated}` shape, used by
the three legal pages (`terms`, `privacy`, and one more under `src/app/`).

Problem: four other route files hand-roll an identical heading pattern
inline instead of using a shared component (because their shape —
`{title, description}`, no `lastUpdated`— doesn't match `PageHeader`):
`src/app/page.tsx` (lines 8-13), `src/app/poems/[id]/page.tsx` (lines
14-19), `src/app/poems/page.tsx` (lines 9-20 — note this one also has
`id="poems-heading"` and `tabIndex={-1}` attributes the other three lack,
added for a focus-management fix; preserve these exactly), and
`src/app/remix/[share_id]/page.tsx` (lines 41-50). All four currently share
the identical class string
`"font-serif text-2xl font-semibold tracking-tight"` on an `<h1>`, followed
by a description `<p>`.

Goal (acceptance criteria):
- A new component (e.g. `src/components/RouteHeading.tsx`, or extend
  `PageHeader.tsx` with an optional variant if that fits more naturally —
  your call, but keep `PageHeader`'s existing legal-page usage unchanged
  either way) accepts at minimum `title` and `description`, and optionally
  `id`/`headingProps` or similar so `poems/page.tsx`'s `id="poems-heading"`/
  `tabIndex={-1}` can still be passed through.
- All four call sites use the new/extended component instead of hand-rolled
  markup, with the exact same rendered output (same classes, same DOM
  structure) as before — this is a refactor, not a redesign.
- `poems/page.tsx`'s `id`/`tabIndex` behaviour (used by an existing
  focus-management test) is preserved exactly.

Constraints: do not change visual output. Do not touch the three legal
pages' use of `PageHeader.tsx`.

Verification: run `npm test` — pay particular attention to any test that
queries these four pages' headings by role/text/id (e.g. focus-management
tests for `poems/page.tsx`) and confirm they still pass unmodified if
possible, or update them only if the query needs adjusting for a structural
reason you can justify. Run `npm run lint`/`typecheck`/`format:check` —
clean. Manually diff the rendered HTML (or use a snapshot temporarily,
then discard it — this project doesn't use snapshot tests) to confirm no
visual regression.

Work cost-consciously. This is a small, mechanical extraction with a clear
existing pattern to follow (`PageHeader.tsx`) — suits a low-cost model
tier.

Deliverable: one commit/PR (branch-workflow rules per this repo's
`CLAUDE.md`; conventional-commit title, e.g. `refactor(ui): extract a
shared page-heading component`). File a new tech-debt item resolving
`TD-PPpfid-26080908` per `TECH-DEBT.md`'s workflow as part of this PR (the
item already exists — flip its `status:` to `resolved` with `resolved:`
and `ref:` once merged).
```

## Prompt for R-10 — Move the pure DOM-toggle helpers out of `components/`

**Bundles:** R-10 only · **Run after:** no prerequisites

```text
Poetic Fiddle (github.com/Poetic-Poems/poetic-fiddle) is a Next.js + React
+ TypeScript app with a `src/lib/` directory holding non-React business
logic and a `src/components/` directory holding React components.

Problem: `src/components/PoemPreview.tsx` (lines 24-159) defines two
functions, `wirePoemToggles` and `evaluatePostscriptPreviews`, that are
pure DOM manipulation with no JSX and no dependency on React — they operate
directly on DOM nodes passed to them. Despite this, they live in a
`"use client"` component file, and `src/components/SharedPoemView.tsx`
(lines 4-8) imports both of them directly from `PoemPreview.tsx` — a
`components/` file depending on another `components/` file for logic,
rather than both depending on a shared `lib/` module.

Goal (acceptance criteria):
- `wirePoemToggles` and `evaluatePostscriptPreviews` move to a new file,
  `src/lib/poem-toggles.ts` (or another name if you find a more idiomatic
  one already used for similar utilities in `src/lib/` — check for a
  naming convention first).
- `PoemPreview.tsx` and `SharedPoemView.tsx` both import these two
  functions from the new `src/lib/` location instead of from each other.
- Any existing tests for these two functions (search for their names across
  `*.test.ts*`) move or update their import paths accordingly, with no
  change to what they assert.
- No behaviour change — this is a pure code-location refactor.

Constraints: do not change either function's implementation or signature.
Do not change any other exports from `PoemPreview.tsx`.

Verification: run `npm test` — all existing tests for these two functions
and for `PoemPreview.tsx`/`SharedPoemView.tsx` must still pass. Run `npm
run lint`/`typecheck`/`format:check` — clean. Run `npm run build` to
confirm no broken imports.

Work cost-consciously. This is a small, mechanical move — suits a low-cost
model tier.

Deliverable: one commit/PR (branch-workflow rules per this repo's
`CLAUDE.md`; conventional-commit title, e.g. `refactor(lib): move
poem-toggle DOM helpers out of components/`). File a new tech-debt item
resolving `TD-PPpfid-26080909` per `TECH-DEBT.md`'s workflow as part of
this PR (the item already exists — flip its `status:` to `resolved` with
`resolved:` and `ref:` once merged).
```

## Prompt for R-11 — Documentation polish: two stale references

**Bundles:** R-11 (two small, unrelated doc fixes found in the same review pass, bundled to avoid two near-trivial PRs) · **Run after:** no prerequisites

```text
Poetic Fiddle (github.com/Poetic-Poems/poetic-fiddle) documents its
non-functional-hardening work in `docs/IMPLEMENTATION-PLAN.md` (a living
planning document, explicitly exempt from the project's as-built-only
documentation rule) and its data-subject-request procedure in
`docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md` (an as-built runbook, subject to
that rule — see `CLAUDE.md`'s "Documentation principles").

Problem 1: `docs/IMPLEMENTATION-PLAN.md` §4's W-item list has two stale
entries. **W10** ("Breach-handling statement... Nothing user-facing today")
is actually done: `src/app/privacy/page.tsx` (around lines 169-179) already
has a "Privacy breach notification" section. **W14** ("Data export... No
export flow exists") is now partially addressed:
`scripts/export-poet-data.mjs` (an admin-run, service-role-key script) plus
`docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md` now exist — but this is a
maintainer-run tool, not the self-service "download my data" flow the item
originally describes, so it needs a status nuance, not a blanket "done".

Problem 2: `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md` line 17 says the
account-deletion route is "reachable from the app's account settings" — no
settings route exists in `src/app/`. The actual feature is the "Danger
zone" section of the "My poems" dashboard
(`src/app/poems/page.tsx`/`src/components/AccountDangerZone.tsx`), which
the same runbook document correctly calls "Danger zone" two paragraphs
later (around line 90).

Goal (acceptance criteria):
- W10 in `docs/IMPLEMENTATION-PLAN.md` reads as done, referencing the PR
  that shipped it if you can find it via `git log -- src/app/privacy/page.tsx`
  (or leave the reference generic if you can't confirm a specific PR
  number).
- W14 is reworded to accurately describe the current state: an admin-run
  export script and runbook exist; a self-service export flow (if that
  remains the item's intended end goal) does not yet. Match the list's
  existing style for "done"/"in progress" entries (read a few neighbouring
  W-items first).
- `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md` line 17's "the app's account
  settings" is changed to "the My poems dashboard's Danger zone" (or
  equivalent wording matching the document's own later usage).

Constraints: these are content-only edits to two documents. Follow this
repository's documentation rule (`CLAUDE.md`): as-built docs get no
historical-narrative phrasing ("previously", "used to", etc.) —
`IMPLEMENTATION-PLAN.md` is explicitly exempt from this rule as a living
planning doc, but the runbook is not, so keep its edit purely descriptive
of current state.

Verification: run this repo's documentation format/whitespace check (see
`package.json`'s scripts, likely `npm run check` or similar — check
`CLAUDE.md`/`README.md` for the exact command) if one exists. No code
changes, so no test suite run is needed, but confirm the edited files
still render as valid Markdown.

Work cost-consciously. Both edits are small, well-specified documentation
fixes — suits a low-cost model tier.

Deliverable: one commit/PR (branch-workflow rules per this repo's
`CLAUDE.md`; conventional-commit title, e.g. `docs(plan): correct stale
W10/W14 status and a runbook UI reference`). File a new tech-debt item
resolving `TD-PPpfid-26080910` per `TECH-DEBT.md`'s workflow as part of
this PR (the item already exists — flip its `status:` to `resolved` with
`resolved:` and `ref:` once merged).
```

## Prompt for R-12 — Add retry/backoff to the `npm audit` CI gate

**Superseded by #336.** This prompt's premise was inverted: the project's own
CI history shows the 23:13 run on commit `a6647036` correctly reported two
live advisories (GHSA-2v37-7h3g-55p8, nanoid, HIGH; GHSA-55q2-fjhq-7xh7,
dompurify, MODERATE) and exited 1, and the 03:53 run on the same unchanged
tree spuriously reported "found 0 vulnerabilities" and exited 0 — the red run
was correct and the green run was the flake. Retrying a red audit before
failing, as both options below proposed, would retry past a correct red into
a spurious green, which moves in the wrong direction against a flake whose
signature is a spurious green, not a spurious red. See #336 for the actual
remediation and #337 for this correction; do not run either option below.

**Bundles:** R-12 only · **Run after:** no prerequisites

```text
This prompt is retired — see the correction above. Do not implement Option A
or Option B as originally written; both retry past a correct red into a
spurious green. Follow #336 instead.
```
