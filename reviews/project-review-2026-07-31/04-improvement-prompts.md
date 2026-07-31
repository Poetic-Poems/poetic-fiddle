# Improvement prompts

One prompt per recommendation, in priority order (severity, then effort at equal severity). Each is self-contained — paste into a fresh agent session with no other context. Ordering dependencies are noted in both the preamble here and inside the dependent prompt.

**Dependency:** R-05's prompt assumes R-01 has landed (it verifies the ruleset already includes `register` before building a guard against future drift). Run R-01 first.

## Prompt for R-01 — Require the `register` check before merge

**Bundles:** R-01 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle (Next.js/TypeScript, GitHub-hosted) enforces branch
protection on `main` via a repo ruleset. `.github/workflows/tech-debt-register.yml`
runs a job named `register` on every pull request, checking that
TECH-DEBT.md's Ledger table and "Current Items" section stay consistent — but
that check is not currently required before merge.

The problem: query the live ruleset with
`gh api repos/Poetic-Poems/poetic-fiddle/rulesets/18828479` and confirm its
`required_status_checks` rule currently lists only `commit-format` and `CI`
(not `register`). This means a pull request that desyncs TECH-DEBT.md's
Ledger from its Current Items section gets a red `register` check that a
code-owner can approve and merge anyway — defeating the guard's purpose.

Goal: add `register` to that ruleset's required_status_checks, so a PR
cannot merge while `register` is failing. Verify by re-querying the ruleset
via `gh api` and confirming all three contexts (`commit-format`, `CI`,
`register`) are listed.

Constraints: this is a GitHub configuration change (via `gh api` PATCH or the
repo Settings UI), not a code change — do not add or modify any workflow
YAML. Do not touch any other rule in the ruleset (review requirements,
CodeQL, Copilot code-quality) — only the required_status_checks list.

Verification: after the change, `gh api repos/Poetic-Poems/poetic-fiddle/rulesets/18828479`
must show `register` in `required_status_checks.parameters.required_status_checks[].context`.
As a positive-control check (optional but recommended if you have time),
confirm on an existing closed PR's status-check rollup
(`gh pr view <n> --json statusCheckRollup`) that `register`'s context name is
exactly `register` (no different casing/prefix) so the ruleset entry matches.

Cost policy: this is an administrative/configuration task, not code — suited
to a low-cost tier. If verification via `gh api` requires interpreting JSON
output, that's still mechanical; escalate only if the ruleset's structure is
unexpectedly different from what's described here.

Deliverable: a one-line report confirming the ruleset now requires `register`,
with the `gh api` output as evidence. No PR is needed for a ruleset-only change
unless your access requires opening one against a settings-as-code file — if
this repo manages rulesets as committed JSON, find that file first and edit it
there instead of calling `gh api` directly.
```

## Prompt for R-02 — Add focus management & Escape dismissal to delete-poem confirmation

**Bundles:** R-02 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js/TypeScript poem editor. Its dashboard
(`src/components/PoemsDashboard.tsx`) lets a poet delete a saved poem via a
"Delete" button that, on click, swaps into an inline confirmation with
"Delete forever" and "Cancel" buttons (around lines 218-247).

The problem: clicking "Delete" removes the very button that had keyboard
focus and replaces it with a different DOM element (a `<div>` with two new
buttons) at the same position, without ever moving focus onto the new
element. Browsers drop focus to `<body>` when the focused element is
removed, so a keyboard or screen-reader user gets no indication the
confirmation appeared. There is also no Escape-to-cancel, unlike every other
dismissible surface in this app (`SignInPrompt.tsx` uses a native `<dialog>`,
which gets focus-trapping and Escape for free via `showModal()`). Both
"Cancel" and a successful delete repeat the same focus-loss on the way back
out.

Goal (acceptance criteria):
1. Opening the confirmation moves focus onto it — default to the "Cancel"
   button (the safer default for a destructive action).
2. Pressing Escape while the confirmation is open acts exactly like clicking
   "Cancel" (closes it, no deletion).
3. On Cancel, focus returns to that row's original "Delete" button.
4. On a successful delete, focus moves to a sensible next target: the next
   row's "Delete" button if one exists, else the previous row's, else (if the
   list is now empty) the dashboard's main heading.
5. `PoemsDashboard.test.tsx` gains test cases covering all four points above
   (Escape via `fireEvent.keyDown`, focus assertions via
   `document.activeElement`), alongside the existing click-based delete
   suite (`describe("delete (TD26072414)"`).

Constraints: do not change the confirmation's visual design, copy, or the
existing click-based flows' behaviour — only add focus/keyboard handling.
Follow the codebase's existing conventions (see `SignInPrompt.tsx` for how
this app handles a comparable interaction, though you do not need to switch
to a native `<dialog>` — a plain focus-management approach is fine and
smaller in scope).

Verification: run `npm run lint`, `npm run typecheck`, `npm test` — all must
pass. Manually trace (or, if you can run the dev server and a browser tool,
verify live) that Tab, Escape, and click all behave as described.

Cost policy: this is well-specified UI work against clear acceptance
criteria — suited to a mid-cost tier. If you delegate the test-writing to a
subagent, keep the focus-management implementation itself in the primary
session so acceptance criteria 1-4 are verified end-to-end by whoever wrote
them.

Deliverable: a PR (or diff + summary) implementing the above, with updated
tests, `npm run lint`/`typecheck`/`test` all green, and TECH-DEBT.md's
TD26080102 entry (filed by this review) removed from Current Items and its
Ledger row flipped to resolved, per this repo's tech-debt workflow in
TECH-DEBT.md's own instructions.
```

## Prompt for R-03 — Re-sync vendored tech-debt scripts; harden `td-tooling-drift.yml`

**Bundles:** R-03 only (F-GOV-01 + F-CI-03 — same workflow file, one pass) · **Run after:** no prerequisites

```text
Context: poetic-fiddle vendors a copy of tech-debt tooling
(`scripts/get-tech-debt-record.pl`, `scripts/next-tech-debt-id.pl`,
`scripts/td-check.pl`, `scripts/drop-sections.pl`) whose canonical version
lives in the `Poetic-Poems/poetic` repository (poetic-fiddle does not
framework-sync, per its own CLAUDE.md). `.github/workflows/td-tooling-drift.yml`
runs weekly (plus on-demand via workflow_dispatch) to detect drift between
this repo's copies and poetic's current `main`.

The problem: as of this review, three of the four vendored scripts
(everything except `drop-sections.pl`) have already drifted from
`Poetic-Poems/poetic`'s current `main` — poetic added an adaptive per-item
`tech-debt/` register format alongside its legacy single-file format, and
this repo's copies only implement the legacy format (which is fine, since
this repo's own TECH-DEBT.md is single-file — but the scripts themselves
differ from upstream). The drift-detection workflow's last two runs both
predate the PR that introduced the current script versions, so nothing has
verified the guard still fires correctly. Separately, `td-tooling-drift.yml`
has no issue-filing step on detecting drift — it just fails the run — unlike
its sibling `.github/workflows/check-poetic-release.yml`, which files a
deduplicated GitHub issue.

Goal (acceptance criteria):
1. Clone or fetch `Poetic-Poems/poetic`'s current `main` and diff its
   `scripts/get-tech-debt-record.pl`, `scripts/next-tech-debt-id.pl`, and
   `scripts/td-check.pl` against this repo's copies.
2. Re-sync poetic-fiddle's copies to match, preserving this repo's ability to
   run them against a single-file TECH-DEBT.md (poetic's adaptive format is
   backward-compatible with the legacy shape — verify this by running
   `perl scripts/td-check.pl TECH-DEBT.md` after the sync and confirming it
   still reports the same open/resolved counts as before your change).
3. Manually trigger `.github/workflows/td-tooling-drift.yml` (or reason
   through its diff logic) to confirm it now passes cleanly against the
   re-synced scripts.
4. Either add an issue-filing step to `td-tooling-drift.yml` matching
   `check-poetic-release.yml`'s dedup pattern (title-based, so a repeat
   drift-detection doesn't spam duplicate issues), or add a comment to the
   workflow's header explicitly stating why a bare failed run is judged
   sufficient here — pick one and state which.

Constraints: do not change TECH-DEBT.md's own file format or this repo's
tech-debt claiming workflow. Do not pull in poetic's adaptive-format *code
paths* if they're not needed for this repo's single-file usage — only sync
what's needed to eliminate the diff in behaviour this repo actually
exercises; note any deliberate remaining differences in a code comment.

Verification: `perl scripts/td-check.pl TECH-DEBT.md` passes with unchanged
output; `npm run lint`/`typecheck` pass (the scripts are Perl, so these gate
the workflow YAML changes, not the scripts themselves); a manual or CI
dispatch of `td-tooling-drift.yml` completes without a drift failure.

Cost policy: the diff-and-resync is mechanical (suited to a low-cost tier);
deciding the issue-filing-vs-comment question and reviewing the final diff
for behavioural equivalence suits a mid-cost tier.

Deliverable: a PR syncing the three scripts, updating `td-tooling-drift.yml`
per point 4, and resolving TECH-DEBT.md's TD26080103 entry (filed by this
review) per this repo's tech-debt workflow.
```

## Prompt for R-04 — Decompose `use-poem-persistence.ts`'s flat state; dedupe the save-guard

**Bundles:** R-04 only (F-ARCH-01 + F-CODE-01 — same file, one refactor pass) · **Run after:** no prerequisites

```text
Context: poetic-fiddle's editor persistence logic lives in
`src/lib/use-poem-persistence.ts` (395 lines), a React hook consumed by
`src/components/Editor.tsx`. The hook owns 15 `useState`/`useRef` hooks
across six async flows (open, save, share, unshare, allow-remix-change,
copy-link) and returns one flat object of 24 fields with no exported
return-type interface.

The problem: (1) the flat, ungrouped return shape means any future feature
touching save/share/session will most plausibly bolt onto this same flat
structure rather than prompt further decomposition — there's no internal
grouping to extend into. (2) `handleShare` (lines ~253-263) and
`handleAllowRemixChange` (lines ~311-321) contain an identical eight-line
"save if unsaved, then act" block (check `poemId === null ||
hasUnsavedChanges`, call `savePoem(...)`, update `poemId`/`savedSource`),
differing only in one local variable's name — a duplicated data-mutation
block with no structural pressure keeping the two copies in sync if one is
later fixed.

Goal (acceptance criteria):
1. The hook's return value is grouped by concern instead of 24 flat fields —
   e.g. `{ source, rendered, save: {...}, share: {...}, remix: {...}, ... }`
   (choose a grouping that reads naturally against the six async flows;
   document the shape with an exported TypeScript interface).
2. `Editor.tsx`'s destructuring is updated to match the new shape.
3. A single `ensureSaved(): Promise<string>` (or equivalent) helper replaces
   the duplicated eight-line block in both `handleShare` and
   `handleAllowRemixChange`.
4. No behavioural change: every existing test in
   `src/lib/use-poem-persistence.test.ts`, `src/components/Editor.share.test.tsx`,
   and `src/components/Editor.remix-permission.test.tsx` passes, with only
   setup/access-path updates for the new return shape (no assertion should
   need to change what it expects the *behaviour* to be).

Constraints: this is a refactor — do not change any user-visible behaviour,
error messages, or the timing of debounced saves/renders (PR #152's shared
200ms debounce must remain exactly as it is). Keep the six async flows
semantically the same; only regroup their state/return shape and extract the
shared helper.

Verification: `npm run lint`, `npm run typecheck`, `npm test` all pass with
no test assertions changed in a way that alters expected behaviour (only
access-path/shape updates). Diff the test files to confirm this.

Cost policy: this is ordinary implementation work against clear acceptance
criteria, suited to a mid-cost tier — but because it touches this app's core
persistence orchestration (save/share correctness is the site of past real
incidents in this repo's history, per TECH-DEBT.md), keep the final
refactor's correctness review at a mid-to-high-cost tier rather than
delegating it away; test-writing/updating for the new shape can be delegated
to a low-cost tier once the new shape is fixed.

Deliverable: a PR with the regrouped hook, the extracted helper, updated
call sites, and TECH-DEBT.md's TD26080104 entry (filed by this review)
resolved per this repo's tech-debt workflow.
```

## Prompt for R-05 — Guard against a new workflow shipping without required-check wiring

**Bundles:** R-05 only · **Run after:** R-01 (verify `register` is already a required check before building a guard against this class of drift recurring)

```text
Context: poetic-fiddle (Next.js/TypeScript) gates merges to `main` via a
GitHub ruleset's `required_status_checks` plus `.github/workflows/ci.yml`'s
own internal `needs` graph (which aggregates several conditional jobs into
one always-reporting `CI` check). This task assumes R-01 has already been
completed — verify first that `gh api repos/Poetic-Poems/poetic-fiddle/rulesets/18828479`
lists `register` in `required_status_checks` before starting; if it doesn't,
stop and complete R-01's prompt first.

The problem: `.github/workflows/tech-debt-register.yml` (a whole new
workflow, not a job inside `ci.yml`) shipped in PR #145 without a matching
update to the branch-protection ruleset's required checks — a real instance
of "a new workflow can land without being wired into what actually blocks a
merge." `ci.yml`'s own header comment documents an equivalent discipline for
jobs *within* that file ("adding a conditional job later means adding it to
`ci`'s `needs` list") — that one's manual too, just not yet caught drifting.

Goal (acceptance criteria): build an automated check that fails CI (or a
scheduled workflow, your choice, matching the pattern `td-tooling-drift.yml`
already uses for a different kind of drift) when either of these is true:
(a) a job in `.github/workflows/*.yml` triggers on `pull_request` but is not
reachable from `ci.yml`'s `needs` graph nor present in a checked-in snapshot
of the ruleset's required checks; (b) the checked-in snapshot of the
ruleset's required checks (if you introduce one) has drifted from the live
ruleset, detected via `gh api` in a scheduled job. If a full automated check
of this shape is more machinery than the project's current size warrants,
document that judgement explicitly instead and implement the lower-cost
alternative: a checklist item added to `CONTRIBUTING.md` (or wherever new
workflows are documented as being added) that a human/agent must follow when
adding a new `pull_request`-triggered workflow.

Constraints: do not change any existing workflow's actual gating behaviour —
this is a new guard, not a change to what's currently required. Follow this
repo's existing pattern of well-commented workflow files (see `ci.yml` and
`tech-debt-register.yml`'s own header comments for the house style).

Verification: if you build the automated check, demonstrate it catches the
class of drift it's meant to by testing it against a deliberately
introduced (then reverted) new workflow file missing the required wiring.
If you choose the checklist alternative, verify the checklist item is
discoverable from wherever a contributor would naturally look when adding a
workflow.

Cost policy: this is ambiguous, cross-cutting design work — deciding between
the automated-check and checklist approaches, and the automated check's
exact shape if chosen, should be done at a high-capability tier. Once the
approach is chosen, implementation (the parsing/diffing script, or the
checklist wording) can be delegated to a mid-cost tier.

Deliverable: a PR with the chosen guard (script + workflow wiring, or
documented checklist item) and TECH-DEBT.md's TD26080105 entry (filed by
this review) resolved per this repo's tech-debt workflow.
```

## Prompt for R-06 — Fold PR #129's eslint blocker into TD26072429

**Bundles:** R-06 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle (Next.js/TypeScript) holds `eslint` at `^9` and
`typescript` at `^5`, both at least one major version behind, tracked as
tech-debt item TD26072429 in TECH-DEBT.md ("Undocumented TypeScript/ESLint
major-version holds"). `npm audit` reports 9 high-severity advisories, all
tracing to one chain — `eslint@9.39.5`'s own `minimatch@3.1.5` ->
`brace-expansion@1.1.16` (GHSA-mh99-v99m-4gvg) — fixed only by the ESLint 10
major bump this same tech-debt item already covers.

The problem: TD26072429's current body doesn't record *why* the ESLint bump
is blocked. A closed Dependabot PR (#129, "Bump eslint from 9.39.5 to
10.8.0") has a maintainer comment dated 2026-07-27 giving the specific
reason: `eslint-config-next@16.2.12` (the current latest stable) bundles
`eslint-plugin-react@7.37.5`, which still calls `context.getFilename()`, an
API ESLint 10 removed — so CI's lint step fails with a `TypeError`, and no
newer `eslint-config-next` release exists yet to fix it. Separately, the
parallel `typescript` hold has *no* recorded rationale at all — Dependabot's
closed PR #9 has only its generic auto-close message.

Goal: (1) update TD26072429's body in TECH-DEBT.md to record the
eslint-config-next/eslint-plugin-react root cause above, so a future agent
checking this bump doesn't have to rediscover it via `gh pr view 129
--comments`. (2) Re-trial the `typescript` major bump in a scratch branch
(`npm install typescript@latest`, run `npm run typecheck` and `npm run
lint`) — if it's now clean, open a small bump PR; if it still fails, add a
dated rationale entry to TD26072429 describing the specific failure,
matching the style of the jsdom hold (TD26071901) and the eslint entry
you're adding in this same task.

Constraints: do not force either major bump to "succeed" by suppressing
errors (no blanket `eslint-disable`, no `// @ts-expect-error` sweep) — if a
bump doesn't work cleanly, document why, don't paper over it.

Verification: `npm run lint`, `npm run typecheck`, `npm test` all still pass
against whatever combination of versions you land on. If you did merge a
`typescript` bump, `npm audit` and the new typecheck output are your
evidence; if you didn't, the updated TECH-DEBT.md entry is.

Cost policy: this is mostly investigation and documentation — suited to a
low-to-mid-cost tier. Trialling the typescript bump is mechanical
(low-cost); interpreting a real breakage if one occurs may need a slightly
higher tier to characterize accurately.

Deliverable: an updated TD26072429 entry in TECH-DEBT.md (and, if the
typescript bump succeeded, a small separate PR bumping it) — this task does
not create a new tech-debt ID, it enriches an existing one.
```

## Prompt for R-07 — Add `Referrer-Policy`/`X-Content-Type-Options`/`Permissions-Policy` headers

**Bundles:** R-07 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle (Next.js/TypeScript) sets its Content-Security-Policy
and a per-request nonce in `src/proxy.ts` (the app's middleware-equivalent
request handler), which every response passes through.

The problem: `src/proxy.ts` sets only `x-nonce` and `Content-Security-Policy`
response headers (lines ~14-20) — no `Referrer-Policy`,
`X-Content-Type-Options`, or `Permissions-Policy` header is set anywhere,
and `next.config.ts` has no `headers()` block adding them either. This is a
defense-in-depth gap, not an exploitable one today (CSP's `frame-ancestors
'none'` already subsumes `X-Frame-Options`, and modern browsers default to a
reasonable referrer policy) — but `/share/[share_id]` URLs embed the share
token itself in the path, so an explicit `Referrer-Policy` closes a
currently-theoretical leak path cheaply.

Goal: add, in the same place `Content-Security-Policy` is set in
`src/proxy.ts`: `Referrer-Policy: strict-origin-when-cross-origin` (or
stricter, e.g. `no-referrer`, if it doesn't break any legitimate
cross-origin referrer this app relies on — check first, this app has none
that need it), `X-Content-Type-Options: nosniff`, and a `Permissions-Policy`
that denies browser features this app doesn't use (at minimum `camera=()`,
`microphone=()`, `geolocation=()`).

Constraints: do not weaken the existing CSP in any way. Do not add
`X-Frame-Options` (redundant with `frame-ancestors 'none'`, and the project
has already chosen CSP over the legacy header per its own CSP comments).

Verification: add or extend a test asserting the new headers are present on
a representative response (follow the pattern of any existing CSP-header
test, if one exists — search for how `Content-Security-Policy` is currently
tested). `npm run lint`, `npm run typecheck`, `npm test` all pass. Manually
load the app (or a preview deployment) and confirm via browser devtools'
Network tab that all headers appear on the response.

Cost policy: small, well-specified, low-risk config change — suited to a
low-cost tier entirely, including the test.

Deliverable: a PR adding the headers and a test, with TECH-DEBT.md's
TD26080106 entry (filed by this review) resolved per this repo's tech-debt
workflow.
```

## Prompt for R-08 — Add a CI `npm audit` gate and local `engine-strict` enforcement

**Bundles:** R-08 only (F-TOOL-02 + F-TOOL-04 + F-DEPS-02 — same "advisory becomes enforced" theme) · **Run after:** no prerequisites

```text
Context: poetic-fiddle (Next.js/TypeScript) relies entirely on Dependabot's
own alerting for dependency-vulnerability awareness — no CI job runs `npm
audit`. Separately, `package.json` pins `engines.node: "22.x"`, but nothing
locally enforces it (`.npmrc` has no `engine-strict`), so `npm ci` on a
mismatched Node version only prints an `EBADENGINE` warning and proceeds.

The problem: (1) the previous project review (`reviews/project-review-2026-07-23/`,
finding F-DEPS-01) found a real case where Dependabot itself stayed silent
on a live high-severity `next` advisory — a CI-level audit gate is
independent of whether Dependabot notices. (2) A contributor or agent on a
Node version other than 22.x gets a working install today and only
discovers a runtime-specific incompatibility after it manifests (this repo
has had exactly one such incident: TD26071901, jsdom's `ERR_REQUIRE_ESM`).

Goal: (1) add an `npm audit --audit-level=high` step to `.github/workflows/ci.yml`'s
`build` job. As of this review, `npm audit` reports 9 high-severity
advisories, all via one already-tracked, dev-only chain (TECH-DEBT.md
TD26072429 — `eslint`'s own `minimatch`/`brace-expansion`); scope the new
check so it doesn't immediately fail CI on this known, tracked issue — e.g.
`npm audit --omit=dev --audit-level=high` if that excludes the eslint chain
cleanly (verify it does), or an explicit `.audit-ci.json`/similar allowlist
referencing TD26072429 with a comment explaining why. (2) add
`engine-strict=true` to `.npmrc` — first verify this doesn't break Vercel's
deployment build (check what Node version Vercel actually runs; if it's a
22.x patch version different from what `.nvmrc`/CI use, confirm the range
`"22.x"` still matches it).

Constraints: the new CI step must not fail on the already-tracked eslint
chain (that's TD26072429's problem, being worked separately per R-06) — a
new PR shouldn't go red for pre-existing, tracked debt. Do not change
`engines.node`'s actual version pin, only enforce it.

Verification: push a test commit with the new CI job to confirm it runs and
currently passes (correctly excluding/allowing the tracked eslint findings);
locally run `npm ci` on both a matching and a deliberately mismatched Node
version (if feasible via `nvm`/`fnm`) to confirm `engine-strict` now hard-fails
the mismatch case.

Cost policy: two small, independent, well-specified config changes — suited
to a low-cost tier.

Deliverable: a PR with both changes and TECH-DEBT.md's TD26080107 entry
(filed by this review) resolved per this repo's tech-debt workflow.
```

## Prompt for R-09 — Test-tooling quick wins: coverage, watch-mode, tokenizer test, timer teardown

**Bundles:** R-09 only (F-TEST-01 + F-TEST-02 + F-TEST-03 + F-TEST-04 — same test-tooling area, four small independent additions) · **Run after:** no prerequisites

```text
Context: poetic-fiddle (Next.js/TypeScript) uses Vitest for its 35-file,
248-test suite (`npm test` = `vitest run`, single-shot). This task covers
four independent, small gaps in the test-tooling area, already partly
tracked as TECH-DEBT.md's TD26072428 (no coverage tool, no watch-mode
script) and newly found by this review (an untested tokenizer, a
fake-timer-teardown gap).

The problems, and what "done" looks like for each:

1. **No coverage tool.** Add `@vitest/coverage-v8` as a devDependency and a
   `coverage` script (e.g. `"coverage": "vitest run --coverage"`) to
   `package.json`. Configure `vitest.config.ts`'s `test.coverage` block with
   a sensible provider (`v8`) and reporter set (at least `text` and `html`).
   No specific coverage threshold is required by this task — just make
   coverage measurable.
2. **No watch-mode script.** Add a `"test:watch": "vitest"` script to
   `package.json` (Vitest's default mode is watch; `"test"` already
   overrides to `run` for CI/one-shot use).
3. **`src/lib/poem-syntax.ts` (145 lines, a hand-written CodeMirror
   `StreamLanguage` token-stream state machine) has zero test coverage.**
   Add `src/lib/poem-syntax.test.ts` driving the exported tokenizer function
   (`poemStreamParser.token`, or however it's exported — read the file
   first) over representative input for each token-stream branch: comment
   open/close (`<<#`/`#>>`), literal block open/close/unclosed (`<<<`/`>>>`),
   section markers (`----`/`====`), headings (`{{...}}`/`{...}`), keywords,
   labels, definitions, variables, emphasis/strong, links — plus at least
   one adjacency case (e.g. a literal block immediately followed by a
   comment) to catch state-transition bugs a single-branch test would miss.
4. **No global fake-timer teardown.** `src/lib/use-poem-persistence.test.ts`'s
   fake-timer tests each call `vi.useFakeTimers()`/`vi.useRealTimers()`
   manually with no safety net if an assertion throws in between. Add
   `afterEach(() => { vi.useRealTimers(); })` — either scoped to that test
   file, or globally in `vitest.setup.ts` (preferred, since
   `vi.useRealTimers()` is a safe no-op when real timers are already
   active, and it protects any future fake-timer test in any file).

Constraints: do not change any existing test's assertions or the code under
test — this task only adds tooling and new tests. Match the existing test
files' style (see `src/lib/render-share.test.ts` or
`src/lib/use-poem-persistence.test.ts` for conventions — `describe`/`it`
structure, assertion style).

Verification: `npm run coverage` runs and produces a report; `npm run
test:watch` starts in watch mode (manually confirm, then exit — don't leave
it running); the new `poem-syntax.test.ts` passes and genuinely exercises
each branch (check it actually fails if you temporarily break one branch,
then revert); `npm test` (full suite) still passes at 248+ tests.

Cost policy: this whole task is mechanical, well-specified, low-risk work —
suited entirely to a low-cost tier, including the new tokenizer test, since
the tokenizer's branches are enumerable from reading the source once.

Deliverable: a PR with all four changes and TECH-DEBT.md's TD26072428 entry
resolved (it's superseded by this task's scope) per this repo's tech-debt
workflow.
```

## Prompt for R-10 — Build an account-data export mechanism; write the backup/export/delete runbook

**Bundles:** R-10 only (F-DATA-01 + F-OPS-01 — the runbook needs the export mechanism to exist first) · **Run after:** no prerequisites

```text
Context: poetic-fiddle (Next.js/TypeScript, Supabase-backed) publishes a
Privacy Policy (`src/app/privacy/page.tsx`) promising poets can "ask us to
export or delete your data" by emailing the maintainer. Self-service
per-poem deletion is already live (`src/lib/poems-store.ts`'s `deletePoem`).
Account-level deletion works today via a database foreign-key `on delete
cascade` from `auth.users` to `poems`/`profiles` (verified by
`supabase/tests/rls_test.sql`) — a maintainer deleting a user's `auth.users`
row via the Supabase dashboard correctly removes everything downstream. No
export mechanism of any kind exists — no script, no Admin API call, nothing
in `scripts/` or `docs/`. `SUPABASE_SERVICE_ROLE_KEY` is documented in
`.env.example` as deliberately unset "until a milestone genuinely requires
it," and no code path currently uses it.

The problem: the Privacy Policy's export promise has zero backing
implementation — not merely undocumented, as TECH-DEBT.md's TD26072433
originally framed it, but actually nonexistent for the export half. And even
though deletion's underlying mechanism does exist, no runbook tells the
maintainer how to actually invoke it.

Goal (acceptance criteria):
1. A script (e.g. `scripts/export-poet-data.mjs` or similar, run manually by
   the maintainer with the service-role key — not a self-service in-app
   feature, this task is about giving the maintainer a repeatable tool, not
   building poet-facing UI) that, given a poet's email or user ID, queries
   `poems` and `profiles` for that `owner_id`/`id` and outputs their data
   (e.g. as JSON) — using `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS, since
   this is an administrative operation.
2. A short internal runbook (a new doc, e.g. `docs/DATA-REQUESTS.md`,
   mirroring `docs/TRIAGE.md`'s style and tone) documenting: how to run the
   export script; how to delete an account (the existing dashboard-based
   `auth.users` row deletion, cascading automatically); and Supabase's
   actual backup/PITR coverage for this project's plan tier (check the
   Supabase dashboard or plan documentation — do not guess).
3. Cross-reference the runbook from `docs/TRIAGE.md` or wherever an agent
   handling a real data-subject request would naturally look.

Constraints: this is explicitly a maintainer-run manual tool, not a
self-service export feature for poets — do not build any new UI or route
poets can trigger themselves; that would be a materially larger scope than
this task and a different product decision. Do not commit the service-role
key anywhere; the script must read it from environment variables only, same
as every other secret in this codebase.

Verification: run the export script locally against a local/test Supabase
instance (`supabase start`) with a seeded test poet and confirm it returns
that poet's data correctly and no one else's. `npm run lint`/`typecheck`
pass on the new script if it's TypeScript, or confirm it runs cleanly if
plain Node/JS. Read the finished runbook aloud against reality — does each
step actually work as written?

Cost policy: the export script is well-specified implementation work
(mid-cost tier); writing accurate documentation about Supabase's actual
backup guarantees requires checking real platform state, not guessing — keep
that part at a tier that will actually go verify rather than assume.

Deliverable: a PR with the export script, the new runbook doc, and
TECH-DEBT.md's TD26072433 entry resolved (mark it done, referencing this
PR) per this repo's tech-debt workflow.
```

## Prompt for R-11 — README/tooling polish

**Bundles:** R-11 only (identical in scope to existing TECH-DEBT.md item TD26072430) · **Run after:** no prerequisites

```text
Context: poetic-fiddle (Next.js/TypeScript) documents its development
commands in README.md's "Development" section as a table, and has a
Linux/WSL setup helper at `scripts/setup-linux.sh`, and a postinstall hook
`scripts/sync-poetic-css.mjs` that regenerates a CSS file from the `poetic`
package dependency.

The problem (tracked as TECH-DEBT.md's TD26072430 — read that entry in full
before starting, it's the authoritative scope for this task): README's
Development table omits the `start` and `test:db` npm scripts, both of which
are real, working commands in `package.json`. Nothing outside
`scripts/setup-linux.sh`'s own header comment (and an agent-only skill file)
documents the WSL npm-shadowing workaround it exists for. And
`scripts/sync-poetic-css.mjs`'s `require.resolve(...)` call (used to locate
the `poetic` package's CSS export) throws a raw, unguarded Node stack trace
if it fails (e.g. the pinned `poetic` version's export path changed), giving
no pointer to what actually went wrong.

Goal (acceptance criteria):
1. README's Development table gains rows for `start` and `test:db`, matching
   the existing rows' format and style.
2. A WSL pointer exists somewhere a new contributor would find it —
   CONTRIBUTING.md is the natural home now that it exists (it didn't when
   this item was originally filed) — linking to `scripts/setup-linux.sh`.
3. `scripts/sync-poetic-css.mjs`'s `require.resolve` call is wrapped in
   `try`/`catch`, and the catch produces an actionable error message naming
   the pinned `poetic` version (from `package.json`) and suggesting the
   likely fix (e.g. "the poetic package's CSS export path may have changed
   in this version — check package.json's poetic entry and poetic's own
   browser/ export").

Constraints: do not change the actual behaviour of any script beyond adding
the error handling in point 3 — the happy path must work identically.

Verification: `npm run lint`/`typecheck`/`format:check` pass. Manually
break `sync-poetic-css.mjs`'s resolve path temporarily (e.g. point it at a
nonexistent export) and confirm the new error message is clear, then revert.

Cost policy: this whole task is small, mechanical documentation and
error-handling work — suited entirely to a low-cost tier.

Deliverable: a PR with all three changes, and TECH-DEBT.md's TD26072430
entry resolved per this repo's tech-debt workflow.
```

## Prompt for R-12 — Documentation accuracy pass

**Bundles:** R-12 only (five small, independent text-accuracy fixes — none warrants its own PR) · **Run after:** no prerequisites

```text
Context: poetic-fiddle (Next.js/TypeScript) maintains several living
planning/reference docs under `docs/` plus inline code comments, governed by
a CLAUDE.md rule that non-CHANGELOG documentation should describe current
state only (no "previously"/"used to be" narration).

The problems, and what "done" looks like for each (all independent, small
text edits):

1. `docs/IMPLEMENTATION-PLAN.md`'s "W9" item (search for "Takedown address")
   still describes the takedown contact as "not published," but
   `src/app/privacy/page.tsx` and `src/app/aup/page.tsx` already publish it
   (landed in PR #138). Other done items in the same list (W5, W7, W12) are
   marked "— done (PR #...)" — add the same marker to W9, referencing PR
   #138.
2. `docs/TRIAGE.md` and `docs/SENTRY-AGENT-ACCESS.md` each contain a
   passage narrating a rejected alternative approach ("was trialled and
   dropped/removed/abandoned" — search both files for "trialled"). Trim each
   to a one-line statement of the current approach and why (an ADR-style
   one-liner is fine — e.g. "X is not used because Y" — without the
   narrative of what was tried and discarded).
3. README.md never links the live deployed app, though CHANGELOG.md's
   `[Unreleased]` section states it's live at
   `https://www.poeticfiddle.com/`. Add a "Live at..." link near the top of
   README.md.
4. `src/lib/revalidate-share.ts`'s doc comment (search for "The three call
   sites in Editor.tsx") is stale: after PR #144 extracted
   `use-poem-persistence.ts` from `Editor.tsx`, the actual call sites are
   three in `use-poem-persistence.ts` plus one in
   `src/components/PoemsDashboard.tsx` (added by PR #124) — four total, not
   three, and not in `Editor.tsx`. Update the comment to name the correct
   files and count, or simplify it to "every call site" to avoid the comment
   going stale again on the next refactor.

Constraints: these are documentation/comment-only changes — no code
behaviour should change. Do not remove genuinely useful rationale while
trimming point 2's narration; keep the "why," cut the "what was tried and
discarded" narrative.

Verification: `npm run lint`/`typecheck`/`format:check` pass (comment/doc
changes shouldn't affect these, but confirm nothing else broke). Grep each
file after editing to confirm the specific stale phrases are gone.

Cost policy: entirely mechanical text edits against a clear, enumerated
list — suited entirely to a low-cost tier.

Deliverable: a single PR with all five text fixes (four points above, one
of which — point 4 — also touches OPS-relevant code path documentation),
and TECH-DEBT.md's TD26072432 entry resolved (covers points 2 and 3) per
this repo's tech-debt workflow. Points 1 and 4 don't have a dedicated
tech-debt entry — no register change needed for those two.
```

## Prompt for R-13 — Extract a second `PageHeader` variant; align loading/error state idiom

**Bundles:** R-13 only (F-CODE-02 + F-CODE-03 — both are echoes of the same "shared shape, no shared abstraction" issue in different files) · **Run after:** ideally after R-04, if the idiom-alignment half is attempted (see below)

```text
Context: poetic-fiddle (Next.js/TypeScript) has an existing `PageHeader`
component (`src/components/PageHeader.tsx`, added in PR #148) used by its
three legal pages (terms, privacy, AUP), which share a title + "last
updated" layout.

The problem: a different, simpler header pattern (a `<h1
className="font-serif text-2xl font-semibold tracking-tight">` plus an
optional description paragraph, no "last updated" line) is duplicated,
unextracted, across at least six files: `src/app/page.tsx`,
`src/app/poems/[id]/page.tsx`, `src/app/poems/page.tsx`,
`src/app/remix/[share_id]/page.tsx`, `src/app/share/[share_id]/not-found.tsx`,
and `src/app/remix/[share_id]/not-found.tsx`. This pattern is different from
what `PageHeader.tsx` already handles, so extending that component isn't
the right fix — a second, simpler component is.

Goal (acceptance criteria): create a second header component (e.g.
`PageTitle.tsx` or similar — pick a name that's clearly distinct from
`PageHeader`) taking a title and optional description (as children or a
prop), and replace the duplicated markup in all six files listed above with
it. Confirm no visual change results (same classes, same DOM structure
modulo the extraction itself).

Optional second half (only attempt if R-04 has already landed, since it
touches the same file `use-poem-persistence.ts` that R-04 restructures —
otherwise skip and leave for whoever does R-04): align
`use-poem-persistence.ts`'s per-flow loading/error state (currently
independent boolean/string pairs like `saving`/`saveError`) with
`PoemsDashboard.tsx`'s discriminated-union idiom for the same kind of
"loading/loaded/error" shape, so both files use one consistent pattern for
this recurring state shape.

Constraints: the header extraction must not change any page's visible
output — verify by comparing rendered DOM/snapshot before and after for
each of the six files. Do not attempt the idiom-alignment half if R-04
hasn't landed — that would risk conflicting with R-04's own restructuring
of the same file.

Verification: `npm run lint`/`typecheck`/`format:check`/`test` all pass.
For the header extraction, visually diff (or DOM-diff) each of the six
affected pages before/after.

Cost policy: the header extraction is small, mechanical, well-specified
work — suited to a low-cost tier. The optional idiom-alignment half (if
attempted) is a larger, more judgment-dependent refactor of already-tested
code — suited to a mid-cost tier, with the result reviewed against
`use-poem-persistence.test.ts`'s existing coverage.

Deliverable: a PR with the header extraction (and, if attempted, the idiom
alignment) — this task doesn't have a dedicated tech-debt entry to resolve;
note completion in the PR description referencing this review's F-CODE-02
and F-CODE-03.
```

## Prompt for R-14 — Move `wireAnalysisToggles` to `lib/`

**Bundles:** R-14 only · **Run after:** no prerequisites (but see note below — do opportunistically, not urgently)

```text
Context: poetic-fiddle (Next.js/TypeScript) shares a function
`wireAnalysisToggles` — pure DOM manipulation, no JSX or React dependency —
between its live preview (`src/components/PoemPreview.tsx`, where it's
defined) and its share page (`src/components/SharedPoemView.tsx`, which
imports it cross-component: `import { wireAnalysisToggles } from
"@/components/PoemPreview"`).

The problem: every other piece of shared, non-presentational logic in this
codebase lives in `src/lib/`, not in a `components/` file imported by
another `components/` file — this is the one exception to that boundary.

Goal: move `wireAnalysisToggles` (and any types/helpers it depends on that
aren't PoemPreview-specific) into `src/lib/` — pick a location that makes
sense alongside its natural pairing (e.g. near `render-share.ts`, since that
file already documents the seam `wireAnalysisToggles` is the client-side
half of). Update both `PoemPreview.tsx` and `SharedPoemView.tsx` to import
it from its new location.

Constraints: this must be a pure move with import updates — no behavioural
change whatsoever. Do not rename the function or change its signature
unless strictly necessary for the move.

Verification: `npm run lint`/`typecheck`/`test` all pass, with
`src/components/PoemPreview.test.tsx` and any test exercising
`SharedPoemView`'s toggle wiring passing unchanged (only import paths in the
test files themselves may need updating, not their assertions).

Cost policy: this is a pure mechanical move — suited entirely to a low-cost
tier.

Deliverable: a small PR with the move and updated imports; no tech-debt
entry to resolve (this finding wasn't filed as a standalone tech-debt item
given its low priority — note completion referencing F-ARCH-02 in the PR
description). Not urgent — fine to bundle into a future PR that already
touches either file, rather than opening a dedicated one.
```

## Prompt for R-15 — Extend pending-state feedback fix to remix controls

**Bundles:** R-15 only (extends the scope of existing TECH-DEBT.md item TD26072431 — do not implement standalone until that item is picked up) · **Run after:** whichever agent implements TD26072431

```text
Context: poetic-fiddle (Next.js/TypeScript) has an existing tech-debt item,
TD26072431 in TECH-DEBT.md, covering pending-state feedback gaps —
originally scoped to `SignInPrompt.tsx`'s buttons, which disable during an
async action but show no accompanying text/status change (unlike the rest
of the app's Save/Share/Delete actions, which do: "Saving…", "Sharing…",
"Deleting…", etc.).

The problem: this review found the same "disable-only, no status text"
pattern on two further controls not covered by TD26072431's original scope:
`PoemsDashboard.tsx`'s remix-default checkbox (`disabled={remixDefaultSaving}`)
and `Editor.tsx`'s per-poem "Remixing this poem" `<select>`
(`disabled={allowRemixSaving}`). Both go silent mid-save for a screen-reader
or low-vision user relying on this app's otherwise-consistent `role="status"`
feedback pattern.

Goal: when implementing TD26072431 (read its full entry in TECH-DEBT.md
first for the original SignInPrompt scope and any component/pattern it
introduces), extend whatever fix or shared component results to also cover
these two remix controls — giving both a visible pending-state indication
consistent with the rest of the app's async actions.

Constraints: match whatever pattern TD26072431's fix establishes for
SignInPrompt — don't invent a third, different feedback style for these two
controls.

Verification: `npm run lint`/`typecheck`/`test` pass; add or extend tests in
`PoemsDashboard.test.tsx` and the relevant `Editor.*.test.tsx` file asserting
the pending-state indication appears during an in-flight save for both
controls.

Cost policy: small, well-specified UI work extending an already-decided
pattern — suited to a low-cost tier once TD26072431's own fix has
established what pattern to follow.

Deliverable: include this scope in the same PR that resolves TD26072431 (do
not open a separate PR for just these two controls) — this task has no
independent tech-debt entry; it's explicitly filed as an extension of
TD26072431's existing scope.
```
