# Recommendations

Ordered by severity first, then by effort within a severity band (quick wins
before longer campaigns). This review found no Critical or High-severity
findings, so every recommendation below addresses a Medium or Low finding;
every Medium finding is covered. A handful of Low/informational findings
(F-CODE-02, F-PERF-01, F-TEST-04, F-TOOL-02, F-DEPS-03, F-OPS-01) have no
recommendation — each dimension reviewer judged them not worth scheduled
action at this project's current scale, and that judgement is recorded in
`02-findings.md` rather than silently dropped.

| ID | Recommendation | Severity | Effort | Addresses |
|---|---|---|---|---|
| R-01 | Align Terms of Service with the Privacy Policy's self-service account deletion | Medium | Small | F-UX-02, F-DOC-01 |
| R-02 | Close the two security-adjacent test-coverage gaps | Medium | Small | F-TEST-01, F-TEST-02, F-TEST-03 |
| R-03 | Establish a working release/rollback story | Medium | Small–Medium | F-CI-01 |
| R-04 | Fix the orphan-branch sweeper's stale-resurrection gap (cross-repo) | Medium | Medium | F-GOV-01 |
| R-05 | Dependabot hygiene: eslint ignore rule, merge the stale Actions bump | Low | Small | F-DEPS-01, F-CI-03, F-DEPS-02, F-GOV-04 |
| R-06 | Add axe coverage for the two destructive-action confirmation dialogs | Low | Small | F-UX-01 |
| R-07 | Extend the Supabase auth-drift allowlist to rate-limit/CAPTCHA | Low | Small | F-SEC-01 |
| R-08 | Add a unit test for `sync-poetic-css.mjs` | Low | Small | F-TOOL-01 |
| R-09 | Extract a shared page-heading component | Low | Small | F-CODE-01 |
| R-10 | Move the pure DOM-toggle helpers out of `components/` | Low | Small | F-ARCH-02 |
| R-11 | Documentation polish: two stale references | Low | Small | F-ARCH-01, F-DOC-02 |
| R-12 | Add retry/backoff to the `npm audit` CI gate | Low | Small | F-CI-02 |

## R-01 — Align Terms of Service with the Privacy Policy's self-service account deletion

**Severity:** Medium · **Effort:** Small · **Addresses:** F-UX-02, F-DOC-01

**Current state:** `src/app/terms/page.tsx`'s "Termination" section says account deletion requires emailing the maintainer. `src/app/privacy/page.tsx`'s equivalent section was updated (PR #193, 2026-08-03) to describe the self-service "Danger zone" flow that shipped the same day (W13), with the mailto kept only as a fallback for a poet who can't sign in. The Terms page never received the equivalent update.

**Intended end state:** Both legal pages describe account deletion identically: self-service via the "My poems" dashboard's Danger Zone first, with emailing the maintainer as the documented fallback for someone who can't sign in. The Terms page's `lastUpdated` date reflects the edit.

**Approach:** A single small copy edit to `src/app/terms/page.tsx`'s Termination section, matching the Privacy Policy's current wording. No code/logic changes. Tech-debt item: `TD-PPpfid-26080901`.

## R-02 — Close the two security-adjacent test-coverage gaps

**Severity:** Medium · **Effort:** Small · **Addresses:** F-TEST-01, F-TEST-02, F-TEST-03

**Current state:** `render-share.ts`'s `renderSharedPoemHtml` catch path (the public share page's parse-failure fallback) and `supabase-server.ts`'s `getSupabaseAdmin()`/`getSupabaseServer()` (the sole RLS-bypass code path) are both exercised only through mocks in existing tests, leaving their real behaviour unverified. `Editor.share.test.tsx` also lacks the `afterEach(() => vi.useRealTimers())` safety net three sibling files already have.

**Intended end state:** `render-share.test.ts` has a case that calls the real `renderSharedPoemHtml` with genuinely unparseable `.poem` source and asserts `{ html: "", error: true }` plus that `reportSwallowedError` fires. A new, unmocked test for `supabase-server.ts` asserts both getters throw when their env var is unset and construct successfully when set. `Editor.share.test.tsx` gains the same `afterEach` pattern as its siblings.

**Approach:** Three small, independent test additions in the same problem area (coverage of code paths that mocks currently hide); bundled into one recommendation because they were found together and are trivial to land as one PR, not because one depends on another. Tech-debt item: `TD-PPpfid-26080902`.

## R-03 — Establish a working release/rollback story

**Severity:** Medium · **Effort:** Small–Medium · **Addresses:** F-CI-01

**Current state:** `package.json`'s version and the only GitHub release both predate the MVP; `CHANGELOG.md`'s `[Unreleased]` section has never been renamed. `release.yml`/`docs/RELEASE-RUNBOOK.md` are well-designed but unexercised past the initial scaffold. `main` deploys continuously to Vercel with no documented rollback path in the repository.

**Intended end state:** Either the release mechanism is exercised (a real tag/GitHub release exists reflecting current `main`, and `CHANGELOG.md` has at least one dated, released section), or the repository explicitly documents — in `docs/RELEASE-RUNBOOK.md` or `README.md` — that Fiddle doesn't use tags as its deployment/rollback mechanism, and names what does (Vercel's deployment-history/rollback UI), so a reader isn't left assuming the tag history is the rollback story when it isn't.

**Approach:** This is a judgement call for the maintainer (cut a release now vs. document the actual mechanism) — the receiving agent should present both options rather than unilaterally picking one, unless instructed. Tech-debt item: `TD-PPpfid-26080903`.

## R-04 — Fix the orphan-branch sweeper's stale-resurrection gap (cross-repo)

**Severity:** Medium · **Effort:** Medium (cross-repo) · **Addresses:** F-GOV-01

**Current state:** `scripts/sweep-orphan-branches.sh` — pipeline/orchestration infrastructure that does **not** live in the `poetic-fiddle` repository — resurrects a branch with no open PR purely from that absence, without checking whether the tech-debt item(s) or code the branch touches are already resolved/superseded on `main`. This fired twice within the review window (PRs #223 and #229), each time costing an escalation issue and maintainer toil.

**Intended end state:** Before opening a "resume orphaned branch" PR, the sweeper checks whether the orphaned commit's changes are already reflected in the state the commit was trying to reach on the current `main` (e.g., for a tech-debt-flip commit: is the item already in the target status?) — and skips/closes rather than reopens if so.

**Approach:** **This recommendation cannot be actioned inside the `poetic-fiddle` repository** — the script it concerns is not part of this repo's tree, and this review could not identify which repository owns it. No tech-debt item is filed in `poetic-fiddle`'s register for it (filing one here would misrepresent the register's own `PPpfid` scope for a fix that could never land in this repo). The improvement prompt for this recommendation (`04-improvement-prompts.md`) instructs the receiving agent to first locate the sweeper's actual repository before attempting any fix.

## R-05 — Dependabot hygiene: eslint ignore rule, merge the stale Actions bump

**Severity:** Low · **Effort:** Small · **Addresses:** F-DEPS-01, F-CI-03, F-DEPS-02, F-GOV-04

**Current state:** PR #129 (`eslint` 9→10) is permanently conflicting with no `dependabot.yml` `ignore` rule to suppress the recurring noise, unlike the two other documented major-version holds (`jsdom`, `typescript`). PR #170 (`codeql-action` 4→4.37.3) is clean and mergeable but has sat 7+ days unmerged.

**Intended end state:** `dependabot.yml` has an `eslint` `semver-major` `ignore` rule (referencing `tech-debt/TD-PPpfid-26072429.md`, matching the existing entries' style) and PR #129 is closed. PR #170 is merged (after a rebase) or the reason it's an outlier in an otherwise prompt merge cadence is understood and documented.

**Approach:** Two small, independent, low-risk actions found together in the same review pass; bundle into one PR/session for efficiency. Tech-debt item: `TD-PPpfid-26080904`.

## R-06 — Add axe coverage for the two destructive-action confirmation dialogs

**Severity:** Low · **Effort:** Small · **Addresses:** F-UX-01

**Current state:** `PoemsDashboard.a11y.test.tsx` never opens the delete-poem confirmation or the account-deletion `<dialog>` before running `axe()` — both surfaces' open states are unscanned by the automated accessibility regression net, even though their keyboard/focus behaviour is separately, thoroughly tested elsewhere.

**Intended end state:** `PoemsDashboard.a11y.test.tsx` (or a sibling test) opens each confirmation (via the same interactions the existing focus-management tests already use) and asserts `axe()` finds no violations in that state.

**Approach:** Small, mechanical addition to an existing test file; no production code change expected. Tech-debt item: `TD-PPpfid-26080905`.

## R-07 — Extend the Supabase auth-drift allowlist to rate-limit/CAPTCHA

**Severity:** Low · **Effort:** Small · **Addresses:** F-SEC-01

**Current state:** `scripts/check-supabase-auth-drift.mjs`'s `ALLOWLIST` covers password/MFA/JWT/OTP settings but has no entry for `[auth.rate_limit]` or `[auth.captcha]` in `supabase/config.toml` — a live drift in either would go undetected by the daily guard.

**Intended end state:** The allowlist covers the `[auth.rate_limit]` fields, each individually verified against its Management API counterpart per the script's existing methodology. If CAPTCHA is a deliberate "not yet," that decision is recorded in `docs/REQUIREMENTS.md`/`docs/IMPLEMENTATION-PLAN.md` rather than left silent.

**Approach:** Extend the existing allowlist pattern; no new mechanism needed. Tech-debt item: `TD-PPpfid-26080906`.

## R-08 — Add a unit test for `sync-poetic-css.mjs`

**Severity:** Low · **Effort:** Small · **Addresses:** F-TOOL-01

**Current state:** Every other `.mjs` utility in `scripts/` has a matching `*.test.mjs`; `sync-poetic-css.mjs` — which runs on every `npm install` and guards a real upstream-drift scenario — doesn't.

**Intended end state:** `scripts/sync-poetic-css.test.mjs` exists and covers at least the `require.resolve` failure path (mocking/stubbing resolution to throw, asserting the wrapped error's message).

**Approach:** Mirror the test structure of a sibling script (e.g. `check-changelog-rename.test.mjs`). Tech-debt item: `TD-PPpfid-26080907`.

## R-09 — Extract a shared page-heading component

**Severity:** Low · **Effort:** Small · **Addresses:** F-CODE-01

**Current state:** Four route files hand-roll an identical `<h1>`+description-`<p>` block that `PageHeader.tsx` doesn't cover (it's shaped for the legal pages' `{title, lastUpdated}`, not this simpler shape). Recommended once already (2026-07-31 review, R-13) but never tracked, so it dropped.

**Intended end state:** A `PageHeader`-sibling component (e.g. `{title, description}`) exists and all four call sites (`page.tsx`, `poems/[id]/page.tsx`, `poems/page.tsx`, `remix/[share_id]/page.tsx`) use it, preserving `poems/page.tsx`'s existing `id`/`tabIndex` attributes.

**Approach:** Small, mechanical extraction; run the full test suite after, since several of these pages have dedicated tests referencing the current markup. Tech-debt item: `TD-PPpfid-26080908`.

## R-10 — Move the pure DOM-toggle helpers out of `components/`

**Severity:** Low · **Effort:** Small · **Addresses:** F-ARCH-02

**Current state:** `wirePoemToggles`/`evaluatePostscriptPreviews` in `src/components/PoemPreview.tsx` have no JSX/React dependency but live in a `"use client"` component file, imported cross-component by `SharedPoemView.tsx`. Recommended once already (2026-07-31 review, R-14) but never tracked, so it dropped.

**Intended end state:** Both functions live in `src/lib/poem-toggles.ts` (or similarly named); `PoemPreview.tsx` and `SharedPoemView.tsx` both import from there instead of from each other.

**Approach:** Mechanical move; carry the existing test coverage for these functions across to the new location. Tech-debt item: `TD-PPpfid-26080909`.

## R-11 — Documentation polish: two stale references

**Severity:** Low · **Effort:** Small · **Addresses:** F-ARCH-01, F-DOC-02

**Current state:** `docs/IMPLEMENTATION-PLAN.md`'s W10 and W14 entries are stale against shipped code (W10 is done; W14 is partially addressed by an admin-only script, not the self-service flow it describes). `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md` references a nonexistent "account settings" UI location instead of the actual "My poems" dashboard's Danger Zone.

**Intended end state:** W10 reads "done (PR #180)"; W14 accurately describes the current admin-run export mechanism and either narrows its remaining scope or closes with a pointer to the runbook. The runbook's UI-location reference matches its own later, correct usage ("Danger zone").

**Approach:** Two small, unrelated text edits found in the same review pass; bundled for efficiency, not because they're related. Tech-debt item: `TD-PPpfid-26080910`.

## R-12 — Add retry/backoff to the `npm audit` CI gate

**Severity:** Low · **Effort:** Small · **Addresses:** F-CI-02

**Current state:** `npm run audit` has no retry/backoff; the advisory database it queries moves independently of the repo's tree, causing occasional false-red `CI` runs on an unchanged commit. This flakiness was the documented proximate trigger of the F-GOV-01 register-hygiene incident.

**Intended end state:** Either the `audit` job retries once after a short delay before failing, or the project has a documented norm (e.g. in `CONTRIBUTING.md` or the workflow's own comment) that a red audit-only run on an otherwise-clean PR gets manually re-run before concluding the branch needs rework.

**Approach:** Optional, proportionate to project scale — smallest fix is a documented norm; a retry step in `ci.yml`'s `audit` job is the more thorough option. Tech-debt item: `TD-PPpfid-26080911`.
