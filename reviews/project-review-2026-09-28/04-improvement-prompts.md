# Improvement prompts

One prompt per recommendation, in priority order (R-01 through R-07, matching `03-recommendations.md`). Each is self-contained and may be pasted into a fresh AI agent session. R-02 is not a coding task — it names the two owner-only actions and the issues that already fully specify them; no agent in the target repository's own pipeline may execute it (see the prompt for why), so it is included for completeness rather than as something to hand to an agent. There are no ordering dependencies between the remaining prompts; each may be run independently, in any order, or in parallel.

## Prompt for R-01 — Group peer-locked npm dependency pairs in Dependabot config

**Bundles:** R-01 only · **Run after:** no prerequisites

```text
You are working in the poetic-fiddle repository (Next.js/TypeScript web app,
GitHub: Poetic-Poems/poetic-fiddle). Its dependency updates are managed by
Dependabot via .github/dependabot.yml.

The problem: .github/dependabot.yml's npm `updates:` block has no `groups:`
stanza. Two package pairs are version-locked (one requires the other at an
exact matching version) but Dependabot currently opens them as independent
PRs, each of which is unmergeable alone:

- `react` and `react-dom` must be on the exact same version. PR #426 bumped
  only `react` to 19.3.0, leaving `react-dom` at 19.2.8; the build now fails
  at test time with "Incompatible React versions."
- `@vitest/coverage-v8@4.1.11` peer-depends on exactly `vitest@4.1.11`. PR
  #442 bumped only `vitest` to 5.0.1; PR #424 bumped only
  `@vitest/coverage-v8` to 5.0.1. Either alone makes `npm ci` fail outright
  with an ERESOLVE peer-dependency conflict.

All three PRs have been open and CI-red for over a week as a direct result.

The goal: add a `groups:` entry to dependabot.yml's npm `updates:` block so
that `react`+`react-dom` bump together in one PR, and `vitest`+
`@vitest/coverage-v8` bump together in one PR. Use Dependabot's documented
grouped-updates syntax
(https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#groups).
Check whether any other dependency pairs in package.json have the same
version-lock relationship (grep peerDependencies in node_modules for exact
version pins, or check package.json's own pairs like `@testing-library/*`)
and group those too if you find any — but don't invent groups beyond what
you can verify is actually version-locked.

Constraints: this is a config-only change. Do not touch package.json,
package-lock.json, or any application code. Do not attempt to fix PRs
#424/#426/#442 yourself — once the config change merges, close those three
PRs (`gh pr close 424 426 442 --repo Poetic-Poems/poetic-fiddle` with a
one-line comment pointing at your PR) and let Dependabot regenerate them
grouped on its next run; don't wait for that regeneration before opening
your own PR.

Verification: there is no automated test for dependabot.yml's syntax beyond
GitHub accepting it — validate the YAML is well-formed
(`python3 -c "import yaml,sys; yaml.safe_load(open('.github/dependabot.yml'))"`
or equivalent) and diff your grouped config against Dependabot's documented
example to confirm the syntax matches.

Work cost-consciously. This whole task suits a low-cost model tier — it is
a small, well-specified YAML edit with a documented syntax to follow
exactly. If your environment supports subagents, you likely don't need one
for this; if you do delegate any part, verify the result before including
it.

Deliverable: a pull request against poetic-fiddle titled per Conventional
Commits (e.g. `ci(deps): group react/react-dom and vitest/coverage-v8 in
dependabot config`), following this repo's branch/PR workflow described in
its AGENTS.md, with a `## Changelog` section reading `None.` (this is a
`ci`-type change, not `feat`/`fix`/`perf`, so the section is optional but
harmless to include as `None.`). Reference this tech-debt issue in the PR
body: https://github.com/Poetic-Poems/poetic-fiddle/issues/447 (close it
with `Fixes #447`).
```

## Prompt for R-02 — Clear the two stalled owner-only GitHub escalations

**Bundles:** R-02 only (both items are two-step owner-only GitHub actions blocked on the same structural cause: repo-admin permission) · **Run after:** no prerequisites

```text
This is not a coding task, and it cannot be completed by an autonomous
agent in the poetic-fiddle repository's own pipeline — it requires GitHub
repository-admin permission, which no agent in that pipeline holds by
design. It is included here only because a full project review of
poetic-fiddle (Poetic-Poems/poetic-fiddle) surfaced it as a real,
currently-unresolved cost, and it needs a human with admin access to the
repository.

Two small, fully-specified actions are blocked, each already explained in
detail in an open GitHub issue on the repository:

1. Close pull request #421 (a stale, empty recovery draft) and delete its
   branch `agent/failed-run-check-supabase-auth-drift`. Full context and
   exact commands: https://github.com/Poetic-Poems/poetic-fiddle/issues/432
   Both steps matter — closing the PR without deleting the branch has
   previously caused an identical draft to regenerate (see the incident the
   issue cites).

2. Add the `changelog-section` GitHub Actions check to the repository's
   `default` branch-protection ruleset's required status checks. Full
   context and exact commands (including the exact ruleset URL and which
   `integration_id` to pin):
   https://github.com/Poetic-Poems/poetic-fiddle/issues/437

If you have repo-admin access to Poetic-Poems/poetic-fiddle: follow each
issue's own instructions exactly (they include the precise `gh`/GitHub UI
steps and a verification command), then close that issue per its own
"When you're done" section. If you do not have that access, hand this
prompt to whoever does — there is nothing else to prepare first.

No cost-tier guidance applies; this is not model work.
```

## Prompt for R-03 — Reconcile documentation with the current no-backend production state

**Bundles:** R-03 only · **Run after:** no prerequisites

```text
You are working in the poetic-fiddle repository (Next.js/TypeScript web
app, GitHub: Poetic-Poems/poetic-fiddle) — a `.poem` editor with
Supabase-backed accounts/save/share. Since 2026-09-19, production has run
with no live Supabase project backing it (the org dropped to Supabase's
free plan for cost reasons and deleted the project — see closed issues
#418 and #422 on the repository for the full history). The app degrades
gracefully: editing/preview/local drafts work, sign-in/save/share show an
"unavailable right now" state. This is accurately described in
docs/IMPLEMENTATION-PLAN.md §6.3, but two other places have not caught up:

1. README.md's "CI (GitHub Actions)" section (around line 43-48) states,
   as current behaviour: "`.github/workflows/ci.yml`'s `deploy` job pushes
   `supabase/migrations/` to the live project on every merge to `main`
   that touches them." This is false right now: read
   .github/workflows/ci.yml's `deploy` job — it carries `if: false`, with
   a comment explaining it was disabled for exactly this reason (citing
   issues #422, #418). README's own "Environment & secrets" section,
   directly above the CI section, already correctly notes the backend is
   absent — the CI section just wasn't updated to match.

2. docs/REQUIREMENTS.md's AC93 (under "12.6 Reliability & availability")
   states "The Supabase organisation is currently on the Pro plan" — this
   is now false (it's on the free plan, with no project for poetic-fiddle
   at all). docs/IMPLEMENTATION-PLAN.md §6.3 has the accurate, current
   description — use its wording as your source of truth for what AC93
   should now say.

3. Nothing in the repository records whether this no-backend state is
   expected to be temporary or indefinite. Add one line wherever it fits
   most naturally (docs/IMPLEMENTATION-PLAN.md §6.3 or the REQUIREMENTS.md
   entry you're already editing) — even "indefinite, revisit if
   usage/cost changes" removes real ambiguity for the next reader.

Goal / acceptance criteria: README.md's CI section and its "Environment &
secrets" section no longer contradict each other about whether migrations
currently auto-deploy; docs/REQUIREMENTS.md AC93 and
docs/IMPLEMENTATION-PLAN.md §6.3 no longer disagree about the org's
current plan; a one-line status note about restoration exists somewhere
natural.

Constraints: this repository's docs follow an "as-built" convention (see
its AGENTS.md, "Documentation principles") — describe the current state
plainly, no "previously"/"used to be" phrasing beyond what's needed to
explain *why* (a brief parenthetical citing the issue number is fine,
matching the existing style in IMPLEMENTATION-PLAN.md §6.3). Do not touch
any code — this is a docs-only change.

Verification: read both edited files start to finish afterward and confirm
internal consistency (no doc anywhere in the repo should now claim the
Supabase Pro plan or an active migration-deploy job as fact). Run
`npm run format:check` (this repo lints Markdown formatting) before
opening the PR.

Work cost-consciously. This whole task suits a low-cost model tier — it is
three small, well-scoped text edits with the correct wording already
given above.

Deliverable: a pull request against poetic-fiddle titled per Conventional
Commits (e.g. `docs: reconcile README and REQUIREMENTS.md with the
no-backend production state`), with a `## Changelog` section reading
`None.` (this is a `docs`-type PR). Reference and close the tracking
issue: https://github.com/Poetic-Poems/poetic-fiddle/issues/448 (`Fixes
#448`).
```

## Prompt for R-04 — Add regression coverage for the mobile resize/postscript-clamp fix

**Bundles:** R-04 only · **Run after:** no prerequisites

```text
You are working in the poetic-fiddle repository (Next.js/TypeScript web
app, GitHub: Poetic-Poems/poetic-fiddle), which uses Vitest + Testing
Library for unit/component tests.

The problem: src/components/PoemPreview.tsx (around lines 59-78) and
src/components/SharedPoemView.tsx (around lines 85-100+) each contain a
`ResizeObserver`/`window.resize`-driven debounce that re-runs
`evaluatePostscriptPreviews`. Read the surrounding comments — this exists
to fix a previously-shipped bug (referenced as TD-PPpfid-26080108):
postscript clamping breaks when the editor's mobile source/preview toggle
flips a pane from `display:none` to visible, because the clamping
calculation needs real layout dimensions that don't exist while hidden.
Neither PoemPreview.test.tsx nor SharedPoemView.test.tsx currently
exercises this path — run `npm run coverage` and confirm these specific
line ranges show as uncovered.

The goal: add a test to each of PoemPreview.test.tsx and
SharedPoemView.test.tsx that proves this fix still works — i.e., that
resizing (or the equivalent visibility-change event the component listens
for) triggers `evaluatePostscriptPreviews` (or its observable DOM effect)
after the debounce interval. jsdom (this project's test environment) does
not implement `ResizeObserver` natively, so you'll need a minimal
test-double: a fake class that captures the callback the component
registers, assigned to `global.ResizeObserver` before the component
mounts, which you can then invoke manually in the test to simulate a
resize. Check whether any other test file in this repo already has such a
mock (grep the test suite for "ResizeObserver") and reuse that pattern if
one exists, for consistency, rather than inventing a second one.

Constraints: do not change the behaviour of PoemPreview.tsx or
SharedPoemView.tsx themselves — this is a test-only addition. Match the
existing test files' style (they use Testing Library's `render`/`screen`
and Vitest's `vi.useFakeTimers()` pattern for the debounce — check how
existing tests in these same files already handle the debounce timing, and
reuse that approach).

Verification: `npm test -- PoemPreview SharedPoemView` must pass, and
`npm run coverage` must show the previously-uncovered lines in both files
now covered. Run `npm run lint` and `npm run typecheck` before finishing.

Work cost-consciously. This whole task suits a low-cost-to-mid-cost model
tier — the pattern to follow is well-established elsewhere in the test
suite; a low-cost tier can likely handle it if it first locates and copies
an existing `ResizeObserver`-mocking pattern from this codebase rather
than inventing one from scratch.

Deliverable: a pull request against poetic-fiddle titled per Conventional
Commits (e.g. `test(preview): cover the mobile resize postscript-clamp
fix`), with a `## Changelog` section reading `None.` (test-only, not
user-visible). Reference and close the tracking issue:
https://github.com/Poetic-Poems/poetic-fiddle/issues/449 (`Fixes #449`).
```

## Prompt for R-05 — Backfill small targeted unit-test gaps

**Bundles:** R-05 only (four small, independent test additions bundled because they are all mechanical coverage backfill of the same shape, in the same PR's natural size) · **Run after:** no prerequisites

```text
You are working in the poetic-fiddle repository (Next.js/TypeScript web
app, GitHub: Poetic-Poems/poetic-fiddle), which uses Vitest + Testing
Library.

The problem: four small, unrelated test-coverage gaps were identified by a
project review. Run `npm run coverage` first to see the current baseline
before you start.

1. src/lib/draft-storage.ts, lines 6-11 (inside `getStorage()`) and 19-23
   (inside `saveDraft()`) each have a `catch` block handling
   private-browsing-mode/disabled-storage and quota-exceeded errors
   respectively (this is the app's AC98 graceful-degradation behaviour —
   read the surrounding comments). Neither is exercised by
   draft-storage.test.ts. Add a test per function that makes
   `window.localStorage` throw (mock it) and asserts the function degrades
   as the code comments describe, rather than throwing out to the caller.

2. src/lib/poem-title.ts, lines 13-19: a ternary's false branch (input is
   not a string) is untested. Add one test case passing a non-string title
   and asserting the documented fallback behaviour.

3. src/components/SignInPrompt.tsx and src/components/AccountDangerZone.tsx
   both use the native `<dialog>` element (`showModal()`/`close()`) for
   their modal UI. Add a test per component asserting that focus moves
   inside the dialog when it opens (e.g. onto its first focusable element
   or the dialog itself) and returns to the button that triggered it when
   it closes.

4. scripts/sync-poetic-css.mjs, scripts/check-dependency-audit.mjs, and
   scripts/extract-changelog-notes.mjs have branch/function coverage well
   below the project's ~90% average (50%, 57-69%, and 57.69% lines
   respectively as of this review). Read each script's existing test file
   (they exist — this is about extending them, not starting from zero),
   identify which branches are untested via `npm run coverage`'s per-file
   report, and add targeted test cases for the highest-value gaps (error
   paths and edge cases, not just happy-path duplication). Do NOT add
   tests for scripts/generate-favicons.mjs — its own header comment states
   it is deliberately excluded from CI/automated testing; leave it alone.

Constraints: test-only changes — do not modify the behaviour of any of the
six files being tested. Match each file's existing test style exactly.

Verification: `npm test` must pass in full; `npm run coverage` must show
improved coverage on all six files without regressing any other file's
coverage. Run `npm run lint` and `npm run typecheck` before finishing.

Work cost-consciously. This whole task suits a low-cost model tier — four
independent, mechanical, well-specified test additions following
established patterns already present in the codebase. If your environment
supports subagents, these four items can be delegated as four
self-contained, parallel low-cost-tier subtasks (item 1, item 2, item 3,
item 4) with no interaction between them; verify each before combining
into one PR.

Deliverable: a single pull request against poetic-fiddle titled per
Conventional Commits (e.g. `test: backfill coverage gaps in
draft-storage, poem-title, dialog focus, and tooling scripts`), with a
`## Changelog` section reading `None.` (test-only). Reference and close
the tracking issue: https://github.com/Poetic-Poems/poetic-fiddle/issues/450
(`Fixes #450`).
```

## Prompt for R-06 — Reduce duplication and complexity in the persistence and orchestration layer

**Bundles:** R-06 only (three refactors bundled because they are all non-functional maintainability changes in the same layer, best reviewed and landed together rather than as three tiny PRs touching overlapping files) · **Run after:** no prerequisites

```text
You are working in the poetic-fiddle repository (Next.js/TypeScript web
app, GitHub: Poetic-Poems/poetic-fiddle). This is a pure refactor — no
observable behaviour may change. The existing test suite is your safety
net; do not weaken or delete any existing test to make this easier.

Three related maintainability items, all optional to include together —
do whichever subset you can complete safely and correctly rather than
forcing all three if time/context runs short, since none is urgent:

1. src/lib/use-poem-persistence.ts (438 lines) is a single React hook
   mixing two concerns: session-driven draft migration (roughly lines
   132-229 — read the surrounding comments carefully, this logic is
   subtle and guards against re-migrating a draft twice) and save/share/
   unshare/remix-override CRUD (roughly lines 244-365). Split these into
   two smaller hooks that `use-poem-persistence.ts` (or `Editor.tsx`
   directly) composes together, preserving the exact same external API
   surface that `Editor.tsx` currently consumes.

2. src/lib/poems-store.ts (lines 18-132) defines nine domain error classes
   sharing an identical shape: `constructor(cause: unknown) {
   super("<message>"); this.name = "<Name>"; this.cause = cause; }`.
   src/lib/account.ts repeats the same shape for two more. Replace this
   with a small factory function (e.g. `function domainError(name:
   string, message: string) { return class extends Error { constructor
   (cause: unknown) { super(message); this.name = name; this.cause =
   cause; } }; }` — adjust to fit the codebase's exact TypeScript
   conventions) and use it to define all eleven error classes in one line
   each. Every existing `instanceof` check against these classes (grep for
   each class name) must keep working identically — verify this
   specifically, since a factory-returned class can behave subtly
   differently under `instanceof` if not written carefully.

3. src/components/PoemsDashboard.tsx (376 lines) inlines data-loading
   effects, an imperative focus-management subsystem, and delete/
   remix-default handlers, unlike its sibling Editor.tsx, which delegates
   equivalent orchestration to the `usePoemPersistence` hook. Extract a
   `usePoemsDashboard` hook following that same pattern, moving state and
   handlers out of the component while leaving it presentation-focused.

Constraints: no behaviour change of any kind — not even a different error
message string unless item 2 requires touching the message text (it
shouldn't). Do not change any public API, exported type, or test
assertion about behaviour. If splitting a hook changes re-render timing in
a way a test's `act()`/effect-ordering assumptions depend on, fix the
test's mechanics without changing what it asserts.

Verification: `npm test` must pass in full with zero test changes beyond
what's strictly required by internal restructuring (not behaviour
changes) — if you must touch a test file, explain exactly why in your
PR description. `npm run typecheck` must pass, particularly for item 2's
`instanceof` behaviour. `npm run build` must succeed.

Work cost-consciously. Item 2 (the error-class factory) is
well-specified and mechanical — suitable for a mid-cost tier. Items 1 and
3 touch subtle, already-commented state-management logic (the migration
guard in particular) and are cross-cutting enough to warrant a
high-capability tier doing the split itself, even if test-writing around
it is delegated more cheaply. Verify all delegated work before
integrating it — in particular, re-read the migration-guard comments in
use-poem-persistence.ts yourself before accepting any split of that
section.

Deliverable: a pull request against poetic-fiddle titled per Conventional
Commits (e.g. `refactor(persistence): split concerns and de-duplicate
domain error classes`), with a `## Changelog` section reading `None.`
(pure refactor, not user-visible). Reference and close the tracking issue:
https://github.com/Poetic-Poems/poetic-fiddle/issues/451 (`Fixes #451`).
If you only complete a subset of the three items, say so explicitly in
the PR description and leave the remainder for a follow-up rather than
claiming the issue fully resolved — only close #451 if all three are
done; otherwise reference it without a closing keyword and note what
remains.
```

## Prompt for R-07 — Small documentation-accuracy fixes

**Bundles:** R-07 only (two unrelated one-line doc fixes bundled purely because each is too small to warrant its own PR) · **Run after:** no prerequisites

```text
You are working in the poetic-fiddle repository (Next.js/TypeScript web
app, GitHub: Poetic-Poems/poetic-fiddle). Two small, independent
documentation fixes:

1. No `Access-Control-Allow-Origin` header is set anywhere in this app's
   API routes — they correctly rely on the browser's same-origin default,
   but this isn't noted anywhere. Add a one-line note stating this is
   deliberate to docs/CSP-REVIEW-CHECKLIST.md (or wherever you judge it
   fits best after reading that file and any other security-posture docs
   in docs/) so a future contributor adding a public API doesn't assume
   CORS is already handled.

2. CONTRIBUTING.md, line 7, states: "For tech-debt items, use `td/<id>`"
   as the recommended branch-naming convention. Read AGENTS.md's "Tech
   debt" section — it explicitly states this workflow is retired ("do not
   resurrect the `td/<id>` claim-branch workflow — both belong to the
   frozen format, not the current policy") in favour of GitHub issues
   labelled `pw::type:tech-debt`. Remove the `td/<id>` line from
   CONTRIBUTING.md's branch-naming guidance, or replace it with a pointer
   to AGENTS.md's current tech-debt section — whichever reads more
   naturally in context.

Constraints: docs-only, no code changes. Follow this repo's "as-built"
documentation convention (see AGENTS.md, "Documentation principles") —
state the current policy plainly, don't narrate what changed or when.

Verification: re-read CONTRIBUTING.md's branch-naming guidance and confirm
it no longer contradicts AGENTS.md on the same topic. Run
`npm run format:check`.

Work cost-consciously. This whole task suits a low-cost model tier — two
independent one-line text edits with the exact fix already specified
above.

Deliverable: a pull request against poetic-fiddle titled per Conventional
Commits (e.g. `docs: fix CORS note and retired branch-naming reference`),
with a `## Changelog` section reading `None.`. Reference and close the
tracking issue: https://github.com/Poetic-Poems/poetic-fiddle/issues/452
(`Fixes #452`).
```
