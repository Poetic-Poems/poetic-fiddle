# Improvement prompts

One self-contained prompt per recommendation, in priority order, ready to paste into a fresh AI agent session with no other context. Each names the affected repository, paths, problem, acceptance criteria, and verification steps. Ordering dependencies are noted where they exist; there are none of substance here beyond R-01 ideally landing before the others, since several later items are small enough not to meaningfully conflict with it.

## Prompt for R-01 — Land the in-flight dependency-advisory fix; prioritise the durable CI audit-gate redesign

**Bundles:** R-01 only · **Run after:** no prerequisites

```text
Repository: Poetic-Poems/poetic-fiddle (a Next.js/React/TypeScript web app).

Context: `main` currently carries 5 unpatched npm advisories (2 critical in
`next`/`dompurify`, 3 high in `dompurify`/`markdown-it`/`vite`/`zod`), all
with non-major fixes available. `.github/workflows/ci.yml`'s required
`Audit dependencies` job audits the whole dependency tree with no baseline
against `main`, so no single-package fix PR can go green while any other
package's advisory remains outstanding — this has deadlocked `main` for over
a week and blocked at least 4 unrelated PRs.

The problem is already fully diagnosed and a fix already exists:
- PR #546 (branch `agent/541`) bundles all five package bumps in one PR and
  is `mergeStateStatus: CLEAN` / `mergeable: MERGEABLE` as of this review.
- Issue #542 is the open, tracked durable fix: redesign the audit gate to
  diff the advisory set against `main`'s own baseline, so a PR only fails
  for advisories it newly introduces, not ones already present on `main`.

Goal / acceptance criteria:
1. Check whether PR #546 has already merged. If not, verify it is still
   green and mergeable (`gh pr view 546 --repo Poetic-Poems/poetic-fiddle
   --json mergeable,mergeStateStatus,statusCheckRollup`) and merge it if you
   have authority to do so under this repo's branch-protection rules;
   otherwise flag it as ready for the maintainer.
2. Read issue #542 in full and implement its proposed baseline/allowlist
   mechanism for `scripts/check-dependency-audit.mjs` / the `audit` job in
   `.github/workflows/ci.yml`, so a PR's audit only fails on advisories not
   already present in `main`'s own `npm audit` output.
3. Confirm the existing owner-authorised exception for `GHSA-vfj7-8cjw-p6xm`
   in `braces` (scoped in #489/#491) keeps working unchanged under the new
   mechanism.

Constraints: do not widen the existing `braces` exception's scope. Do not
change the gate's behaviour for a genuinely new advisory introduced by a PR
itself — that must still fail. Follow the existing single-purpose,
well-commented style of `scripts/check-dependency-audit.mjs`.

Verification: `npm run audit` passes locally against current `main` with no
advisories; write/extend tests in `scripts/check-dependency-audit.test.mjs`
proving the new baseline logic correctly distinguishes a pre-existing
advisory (must not block) from a newly introduced one (must still block).
Run the full `npm run lint && npm run typecheck && npm run test` suite.

Work cost-consciously. This fix touches a security-and-process-critical
gate used on every future PR, so do the design and implementation at a
high-capability tier; routine test-writing for the new logic can be
delegated to a mid-cost tier once the approach is settled. Verify all
delegated work before integrating it.

Deliverable: a PR closing issue #542 (and noting PR #546 landed, if it did),
describing the baseline mechanism and how it was verified.
```

## Prompt for R-02 — Keep the no-backend operational state visible; prepare for backup/PITR reinstatement

**Bundles:** R-02 only · **Run after:** no prerequisites

```text
Repository: Poetic-Poems/poetic-fiddle. No live Supabase project currently
backs production (deliberately, since issues #418/#422) — sign-in, save,
share, and remix are all non-functional for real users right now, degrading
gracefully (editing/preview/localStorage drafts still work). This is
accurately documented in `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md`'s "Backup /
PITR coverage" section and `docs/IMPLEMENTATION-PLAN.md` §6.3, but only in
those dedicated sections — not in either document's top-level summary, or
in `README.md`.

Goal: a reader skimming `README.md`'s top summary or `docs/TRIAGE.md`'s
opening sees, without having to find the dedicated section, that production
currently has no live backend — so a "production error" investigation is
read in that light from the first paragraph.

Task:
1. Add one or two sentences near the top of `README.md` (and/or
   `docs/TRIAGE.md`, whichever reads more naturally) stating the current
   no-backend state and linking to the existing detailed section
   (`docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md`'s backup section or
   `docs/IMPLEMENTATION-PLAN.md` §6.3).
2. Re-read `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md`'s existing backup
   section and confirm it already states plainly that a deliberate
   backup/PITR tier will be chosen when/if the project is reinstated (not
   left to default). If the wording is vague, tighten it. Do not propose
   reinstating the project, choosing a tier, or any other action that is a
   maintainer/owner decision — this task is documentation-visibility only.

Constraints: do not change any code. Do not add "previously"/"used to be"
phrasing elsewhere — write the new sentences as current, as-built fact, per
this repo's documentation conventions (`AGENTS.md`'s "Documentation
principles" section).

Verification: `npm run format:check` passes (docs are Prettier-formatted in
this repo); read the edited sections aloud to confirm the no-backend state
is now visible without scrolling to a dedicated section.

Work cost-consciously — this is a small, mechanical documentation task
suited entirely to a low-cost model tier.

Deliverable: a small PR with the doc edits, and a `## Changelog` section in
the PR description (this is a `docs` PR, so `None.` is acceptable unless the
visibility change is judged user-facing enough to note).
```

## Prompt for R-03 — Correct stale MVP-status documentation, fix the release-title bug, cut a release

**Bundles:** R-03 only (three small, same-spirit edits — status docs, a release-workflow literal, and the release itself — bundled because cutting the release is only meaningful once the status docs it would reflect are accurate) · **Run after:** no prerequisites

```text
Repository: Poetic-Poems/poetic-fiddle.

Problem 1: `AGENTS.md`'s "Status and plan" section states "M0–M7 (the MVP)
are delivered, and its §4 ('M8/M9 — remaining work') lists the W-series
items that remain." But `docs/IMPLEMENTATION-PLAN.md` lines 476-556 (§4,
"M8/M9 — remaining work, decomposed into selectable items") list every item
W5 through W16 marked "done", each with a landed PR cited. Both documents'
headline status needs to say M0–M9 are delivered, not that M8/M9 work
remains.

Problem 2: `.github/workflows/release.yml` hardcodes a release title as
`"Poetic ${{ steps.version.outputs.tag }}"` — this repository is "Poetic
Fiddle", a distinct project from the upstream "Poetic" framework it
consumes. The one existing GitHub release is consequently titled
`Poetic v0.1.0` instead of `Poetic Fiddle v0.1.0`.

Problem 3: `package.json`'s version is still `0.1.0`, and the one GitHub
release predates nearly the entire feature set (313 commits since). The
project has no release reflecting its actual, delivered MVP scope.

Goal / acceptance criteria:
1. Update `AGENTS.md`'s "Status and plan" section and
   `docs/IMPLEMENTATION-PLAN.md`'s top "Status" paragraph so both state
   plainly that M0–M9 are delivered (§4's own body already shows this —
   just bring the headline summaries in both files into agreement with it).
2. Fix `release.yml`'s title literal to `"Poetic Fiddle ${{
   steps.version.outputs.tag }}"`.
3. Follow `docs/RELEASE-RUNBOOK.md`'s existing, documented procedure to cut
   a new release (e.g. `v1.0.0`) once 1 and 2 are merged, confirming the
   new release's title reads "Poetic Fiddle v1.0.0".

Constraints: do not change any other content of either status document —
this is a status-line correction, not a rewrite. Do not invent new
milestone numbering or renumber W-items. Follow `docs/RELEASE-RUNBOOK.md`
exactly; do not improvise a different release process.

Verification: `npm run format:check` and `npm run lint` pass; confirm via
`gh release view` (after cutting) that the new release's title starts with
"Poetic Fiddle".

Work cost-consciously. The doc-status correction and the one-line workflow
fix are both mechanical and suit a low-cost tier; running the release
procedure itself should be done carefully (it's a one-way action) but
doesn't need a high-capability tier — a mid-cost tier following the runbook
exactly is sufficient.

Deliverable: one PR for the doc/workflow fixes (with a `## Changelog`
section — the release-title fix is user-visible, so note it under
`### Fixed`), then the release itself once that PR is merged.
```

## Prompt for R-04 — Reconcile the disabled migration-deploy job with docs that still describe it as automatic

**Bundles:** R-04 only · **Run after:** no prerequisites

```text
Repository: Poetic-Poems/poetic-fiddle.

Problem: `.github/workflows/ci.yml`'s `deploy` job (lines 338-353) carries
`if: false` — it has been disabled since the production Supabase project
was deliberately deleted (issues #418/#422) — with a comment explaining it
is kept intact "ready to re-enable the day a project ref exists again." But
`docs/IMPLEMENTATION-PLAN.md` §6.2 still states, in the present tense, that
a `database.yml` workflow's `deploy` job "runs that push against the live
project automatically once a migration-touching PR merges to `main`." Both
the filename (the job actually lives inside `ci.yml`, there is no separate
`database.yml`) and the "runs...automatically" claim are stale.

Goal: `docs/IMPLEMENTATION-PLAN.md` §6.2 describes the current, as-built
state: the `deploy` job lives in `ci.yml`, is currently disabled
(`if: false`), and a migration merged to `main` today does not reach any
database automatically — state the manual `supabase db push` command a
maintainer would need to run instead, and note the job is intended to be
re-enabled once a live Supabase project exists again.

Constraints: documentation-only change. Follow this repo's "as-built" docs
convention (`AGENTS.md`'s "Documentation principles" section) — describe
current state plainly, without "previously"/"used to" framing beyond what's
needed to explain why the job is disabled.

Verification: `npm run format:check` passes; re-read `ci.yml`'s `deploy` job
definition after editing to confirm every fact stated in the doc (job name,
file location, trigger condition, disabled state) is accurate against it.

Work cost-consciously — this is a small, mechanical documentation
correction suited to a low-cost model tier.

Deliverable: a small PR with the doc fix; `## Changelog: None.` (internal
doc accuracy fix, not user-visible).
```

## Prompt for R-05 — Extend real-browser e2e coverage to signed-in states and the public share page

**Bundles:** R-05 only · **Run after:** no prerequisites (does not depend on R-01 through R-04, though landing R-01 first keeps CI available to validate this work)

```text
Repository: Poetic-Poems/poetic-fiddle — a Next.js app with Supabase-backed
accounts, a `.poem` editor, and a public `/share/<id>` SSR page. Playwright
e2e specs live in `e2e/`; the CI job that runs them is in
`.github/workflows/ci.yml`'s `build` job (it invokes `npm run test:a11y`).

Problem: `e2e/a11y.spec.ts` (real-browser axe-core accessibility scan) and
`e2e/poem-link-gestures.spec.ts` are the only two Playwright specs in the
repo, and both are scoped only to signed-out routes (`/`, `/poems`) — each
file's own comments state this is because reaching a signed-in state or the
`/share/<id>` page needs a live Supabase project the suite currently cannot
reach (no live project exists right now — see issues #418/#422). This
leaves the signed-in dashboard (save-status, the account "Danger Zone"
delete/export dialog in `src/components/AccountDangerZone.tsx`) and the
public share page (`src/components/SharedPoemView.tsx`, rendered via
`src/app/share/[share_id]/page.tsx`) with zero real-browser accessibility or
interaction coverage — including zero colour-contrast coverage on
`/share/<id>`, the project's most publicly exposed, no-sign-in-required
surface.

Goal / acceptance criteria:
1. Stand up a way for the Playwright suite to reach a signed-in state and a
   real shared poem without a live production Supabase project — e.g. a
   local Supabase instance seeded with a test account and a saved, shared
   poem (the repo already supports `supabase start` for local dev and
   `supabase test db` for pgTAP; investigate whether CI can run a local
   Supabase instance for this suite, or whether a lighter stub/mock of the
   auth and data layer is more practical given Playwright's real-browser
   requirement).
2. Extend `e2e/a11y.spec.ts` to also scan `/share/<id>` (against a real
   shared poem) and at least one signed-in dashboard state (e.g. with the
   Danger Zone dialog open).
3. Both new scans must exercise the real axe-core `color-contrast` rule
   (confirm it "reported something" the way the existing spec already
   guards against jsdom's silent no-op, per its existing comment pattern).

Constraints: do not weaken or remove the existing signed-out coverage. Do
not depend on a live production Supabase project — this must run
deterministically in CI against ephemeral/local/test infrastructure. Follow
the existing Playwright spec style and `docs/CSP-REVIEW-CHECKLIST.md`'s
list of CSP-sensitive files if your fixture touches request/response
headers.

Verification: `npm run test:a11y` passes locally and in CI against the new
fixture; manually break a contrast value in `globals.css` temporarily and
confirm the new share-page scan fails, then revert.

Work cost-consciously. Designing the test-fixture/seeding strategy is the
hard, judgment-heavy part of this task and deserves a high-capability tier;
writing the additional axe-core assertions once the fixture exists is
mechanical and suits a mid-cost tier. Verify all delegated work before
integrating it.

Deliverable: a PR adding the fixture and the extended `e2e/a11y.spec.ts`
coverage, with a short note in the PR description on how the fixture avoids
depending on a live production backend.
```

## Prompt for R-06 — Close the stalled, maintainer-flagged-obsolete PR #510

**Bundles:** R-06 only · **Run after:** no prerequisites

```text
Repository: Poetic-Poems/poetic-fiddle.

Problem: PR #510 has been open since 2026-10-07. The maintainer applied the
`obsolete` label on 2026-10-11. Two separate automated pipeline comments
(2026-10-11 and 2026-10-17) record the PR as void with no work remaining and
state the pipeline's own void-closing sweep will close it — it has not been
closed, and as of this review it is also `mergeStateStatus: DIRTY` /
`mergeable: CONFLICTING`. Issue #485 ("close-void-github-items.sh silently
drops every void candidate after one whose evidence is the structured
{ref,path,expect,pattern} object") is the most likely root cause already
tracked in this repository's issue history — do not re-diagnose that bug as
part of this task; it has its own fix path.

Goal: PR #510 is closed.

Task: run `gh pr view 510 --repo Poetic-Poems/poetic-fiddle` to confirm it
is still open, `obsolete`-labelled, and that both pipeline comments still
read as void verdicts (i.e. nothing has changed since this review). If so,
close it: `gh pr close 510 --repo Poetic-Poems/poetic-fiddle --comment
"Closing per the maintainer's obsolete label and the pipeline's own void
verdicts of 2026-10-11 and 2026-10-17 (see issue #485 for the likely reason
this didn't happen automatically)."` Do not delete its branch unless you
have confirmed (as the existing comments on the PR should show) that
nothing else depends on it.

Constraints: this is a one-time GitHub housekeeping action, not a code
change — do not open a PR for it. Do not also attempt to fix issue #485 as
part of this task.

Verification: `gh pr view 510 --repo Poetic-Poems/poetic-fiddle --json
state` reports `CLOSED`.

Work cost-consciously — this is a single, mechanical `gh` command, fully
suited to a low-cost tier.

Deliverable: confirmation (the `gh pr view` output) that PR #510 is closed.
```

## Prompt for R-07 — Fix the Privacy Policy's cookie-vs-localStorage wording

**Bundles:** R-07 only · **Run after:** no prerequisites

```text
Repository: Poetic-Poems/poetic-fiddle.

Problem: `src/app/privacy/page.tsx`'s "Cookies and tracking" section (around
line 107) states: "We set only the essential cookie our authentication
provider (Supabase) uses to keep you signed in." But `src/lib/supabase-client.ts`
calls `createClient(...)` with no `auth.storage` option configured, and
there is no `@supabase/ssr`, `createBrowserClient`, or cookie-based storage
adapter anywhere in the codebase (confirm this yourself with `grep -rn
"supabase/ssr\|createBrowserClient\|createServerClient\|auth.storage" src/`
— it should return nothing). `@supabase/auth-js`'s `GoTrueClient` (which
`@supabase/supabase-js` wraps) defaults to `globalThis.localStorage` when no
`storage` option is given — the session is actually kept in the browser's
`localStorage`, not a cookie.

Goal: the Privacy Policy's description of where the session is stored
matches what the code actually does.

Task: edit `src/app/privacy/page.tsx`'s "Cookies and tracking" section (or
rename it if "Cookies" no longer fits) to state that signing in stores a
session token in the browser's local storage rather than a cookie. Keep the
rest of the section's meaning intact (no third-party tracking, no
analytics) — only the storage-mechanism sentence needs to change.

Constraints: do not change the actual auth implementation (do not add a
cookie-based storage adapter) — fix the documentation to match the code, not
the other way around, unless you have a separate, explicit instruction to
migrate to cookie-based storage (you do not here).

Verification: `npm run test` (there may be a snapshot or content test
against this page — check `src/app/privacy/*.test.tsx` if it exists and
update it to match); `npm run format:check` and `npm run lint` pass.

Work cost-consciously — this is a one-paragraph copy fix, fully suited to a
low-cost model tier.

Deliverable: a small PR with the copy fix; `## Changelog` noting the
correction under `### Fixed` (it's a user-facing privacy disclosure, so
treat it as notable even though it's not a `fix`-typed PR by Conventional
Commits rules — use `docs:` as the commit type).
```

## Prompt for R-08 — Reduce small type/validation duplication in `src/lib`

**Bundles:** R-08 only (two independent small refactors in the same directory, same "stop restating a shared shape" class of cleanup, no shared files between them but no reason to split into separate review cycles either) · **Run after:** no prerequisites

```text
Repository: Poetic-Poems/poetic-fiddle, a TypeScript/React codebase.

Problem 1: `src/lib/supabase-server.ts` has three functions —
`getSupabaseServer`, `getSupabaseAdmin`, and `getSupabaseForToken` — that
each hand-roll their own near-identical `if (!x || !y) throw new
Error(...)` check validating the same Supabase env vars, with inline
message strings that have already drifted from each other in wording.
`src/lib/supabase-client.ts` validates the client-side equivalent via a
shared `MISSING_SUPABASE_ENV_MESSAGE` constant in `src/lib/env-errors.ts` —
`supabase-server.ts`'s three factories don't reuse it or an equivalent.

Problem 2: `src/lib/use-poem-crud.ts`'s `UsePoemCrudResult` interface
(lines 26-68) and `src/lib/use-poem-persistence.ts`'s
`UsePoemPersistenceResult` interface (lines 27-61) are independently
declared but identical except that the latter adds a `session` field and
omits `migrateFromDraft`/`forgetSavedPoem` — roughly 35 lines of
near-verbatim duplicated type declaration.

Goal / acceptance criteria:
1. `supabase-server.ts`'s three factories share one validation
   helper/constant per missing-var combination instead of three
   independently-worded inline checks (follow `env-errors.ts`'s existing
   pattern, or extend it if the server-side message needs different
   wording than the client-side one).
2. `UsePoemPersistenceResult` is derived from `UsePoemCrudResult`, e.g. via
   `Omit<UsePoemCrudResult, "migrateFromDraft" | "forgetSavedPoem"> &
   { session: Session | null }`, rather than restated field-by-field.

Constraints: no behavioural change — error messages may be reworded for
consistency but must still clearly identify which env vars are missing;
every call site's return shape must remain assignable exactly as before.

Verification: `npm run typecheck` and the full `npm run test` suite pass
unchanged in behaviour; `npm run lint` and `npm run format:check` pass.

Work cost-consciously. This whole task is mechanical, well-specified
refactoring against clear acceptance criteria — suited to a mid-cost tier,
with no need to delegate further given its small size.

Deliverable: a small PR with both refactors; `## Changelog: None.`
(internal refactor, no user-visible behaviour change).
```

## Prompt for R-09 — Repo polish: README onboarding notes + suppress the justified lint warning

**Bundles:** R-09 only (three trivial, no-risk, same-effort edits; bundled to avoid three near-empty PRs for single-line changes) · **Run after:** no prerequisites

```text
Repository: Poetic-Poems/poetic-fiddle.

Problem 1: `package.json` pins `"engines": { "node": "22.x" }` and
`.npmrc` sets `engine-strict=true`, so installing with any other Node
version fails with `EBADENGINE`. `README.md` says "Requires Node.js 22.x"
but gives no guidance for what to do if a contributor's installed Node
differs.

Problem 2: the repo's local-development path (`supabase start`, documented
in `README.md`) shells out to Docker, but neither `README.md` nor
`CONTRIBUTING.md` states that Docker must be running first.

Problem 3: `npm run lint` reports one warning —
`@next/next/no-location-assign-relative-destination` at
`src/components/AccountDangerZone.tsx:93` — against a deliberate full-page
navigation (already explained in a comment at that line) after account
deletion. It is correctly justified, but has no explicit suppression, so
`npm run lint`'s output is never actually clean, making a second, genuinely
accidental warning easy to miss.

Goal / acceptance criteria:
1. `README.md` names `nvm install 22 && nvm use` (or equivalent) as the fix
   for an `EBADENGINE` error, near its existing Node-version requirement.
2. `README.md`'s (or `CONTRIBUTING.md`'s) local-Supabase-development section
   states that Docker must be running before `supabase start` will work.
3. `src/components/AccountDangerZone.tsx:93` gets a targeted
   `// eslint-disable-next-line @next/next/no-location-assign-relative-destination`
   comment (referencing the existing rationale already in the surrounding
   comment) so `npm run lint` reports zero warnings.

Constraints: do not change the actual navigation behaviour in
`AccountDangerZone.tsx` — only add the suppression comment. Keep the README
additions to one or two sentences each.

Verification: `npm run lint` reports 0 errors and 0 warnings; re-read the
two README additions for accuracy.

Work cost-consciously. This whole task is mechanical, low-risk polish —
entirely suited to a low-cost model tier.

Deliverable: a small PR with all three edits; `## Changelog: None.`
(internal tooling polish, not user-visible).
```

## Prompt for R-10 — Add test coverage for `scripts/*.mjs` CLI entry points

**Bundles:** R-10 only · **Run after:** no prerequisites

```text
Repository: Poetic-Poems/poetic-fiddle. `scripts/export-poet-data.mjs` is
the maintainer-run CLI tool that fulfils a poet's data-export request per
`docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md`. It has a co-located test file,
`scripts/export-poet-data.test.mjs`, following the pattern every other
script in `scripts/` uses (each `*.mjs` has a matching `*.test.mjs`).

Problem: per this session's `npm run coverage` output,
`export-poet-data.mjs` sits at 76.4% statements / 64.28% branches, well
below the ~96%/90% the rest of `src/lib` achieves. The uncovered lines
(175-213, 220-222 in the coverage report's line-number output — re-run
`npm run coverage` to get current exact line numbers, since the file may
have changed slightly since this review) are `buildAdminClient()`'s
env-var-presence check, `defaultOutputPath()`, and `main()`'s argument
parsing, the `0o600`-mode file write, and the `import.meta.url ===
process.argv[1]`-style module-execution guard.

Goal: those specific functions/branches gain test coverage in the existing
`scripts/export-poet-data.test.mjs`, following that file's existing
patterns (it already injects fakes for `execFileSync`/filesystem calls
elsewhere in the same file — follow the same injection style rather than
introducing a new mocking approach).

Constraints: do not change `export-poet-data.mjs`'s actual behaviour unless
you find a genuine bug while writing tests for it (if you do, fix it and
call it out explicitly in the PR description as a separate, named change
from the coverage work). Match the existing test file's structure and
naming conventions exactly.

Verification: `npm run coverage` shows `export-poet-data.mjs` at parity
with (or close to) the rest of `scripts/`'s improved files; the full test
suite still passes (`npm run test`).

Work cost-consciously. This is well-specified test-writing against an
existing pattern — suited to a low-to-mid-cost tier.

Deliverable: a small PR adding the tests; `## Changelog: None.` (test-only
change, unless a genuine bug fix is bundled in, in which case note that
fix specifically).
```

## Prompt for R-11 — Add pagination/limit to `listPoems`

**Bundles:** R-11 only · **Run after:** no prerequisites

```text
Repository: Poetic-Poems/poetic-fiddle.

Problem: `src/lib/poems-store.ts`'s `listPoems(ownerId)` function (around
lines 170-176) selects every row matching the caller's `owner_id` with no
`.limit()` or range applied, and `src/components/PoemsDashboard.tsx` renders
the full result. This is low-risk today given the project's small, single-
poet-per-account scale (row-level security already confines the query to
one account), but is flagged as the kind of unbounded-read pattern that
becomes a real cost/latency concern if usage assumptions change, per this
project's explicit goal of a minimal-cost architecture (`AGENTS.md`,
"Development approach" section).

Goal: `listPoems` does not unconditionally fetch an unbounded number of
rows.

Task: add a reasonable page size (or at minimum a sane hard cap, e.g. a few
hundred rows) to `listPoems`'s Supabase query, using Supabase's `.range()`
or `.limit()`. Decide, with the existing dashboard UX in mind, whether
`PoemsDashboard.tsx` needs to actually paginate (e.g. a "load more" control)
or whether a generous hard cap alone is sufficient for now — a hard cap
alone is an acceptable, smaller first step if full pagination UI would be
disproportionate to the current problem size.

Constraints: do not change the function's return type or the shape of data
`PoemsDashboard.tsx` consumes unless you're also updating the dashboard to
match. Preserve the existing `order("updated_at", { ascending: false })`
behaviour.

Verification: existing tests in `src/lib/poems-store.test.ts` and
`src/components/PoemsDashboard.test.tsx` still pass; add a test confirming
the limit/cap is actually applied in the Supabase query builder call.

Work cost-consciously. This is ordinary, well-specified implementation work
against a clear acceptance criterion — suited to a mid-cost tier.

Deliverable: a small PR with the change; `## Changelog: None.` (internal
safeguard, not user-visible at current scale).
```
