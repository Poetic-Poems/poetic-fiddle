# Recommendations

Ordered by severity first, then effort (quick wins before long campaigns at equal severity). Every Critical and High finding is covered below; two Low findings (F-PERF-01, F-GOV-02) carry no recommendation because their own evidence concludes no action is warranted now, and F-TOOL-03 is not a defect.

| ID | Recommendation | Severity | Effort | Addresses |
|---|---|---|---|---|
| R-01 | Require the `register` (tech-debt-register) check before merge | High | Small | F-CI-01 |
| R-02 | Add focus management & Escape dismissal to delete-poem confirmation | Medium | Small | F-UX-01 |
| R-03 | Re-sync vendored tech-debt scripts; harden `td-tooling-drift.yml` | Medium | Small | F-GOV-01, F-CI-03 |
| R-04 | Decompose `use-poem-persistence.ts`'s flat state; dedupe the save-guard | Medium | Medium | F-ARCH-01, F-CODE-01 |
| R-05 | Guard against a new workflow shipping without required-check wiring | Medium | Medium | F-CI-02 |
| R-06 | Fold PR #129's eslint blocker into TD26072429 | Low | Small | F-SEC-01, F-DEPS-01 |
| R-07 | Add `Referrer-Policy`/`X-Content-Type-Options`/`Permissions-Policy` headers | Low | Small | F-SEC-02 |
| R-08 | Add a CI `npm audit` gate and local `engine-strict` enforcement | Low | Small | F-TOOL-02, F-TOOL-04, F-DEPS-02 |
| R-09 | Test-tooling quick wins: coverage, watch-mode, tokenizer test, timer teardown | Low | Small | F-TEST-01, F-TEST-02, F-TEST-03, F-TEST-04 |
| R-10 | Build an account-data export mechanism; write the backup/export/delete runbook | Low | Medium | F-DATA-01, F-OPS-01 |
| R-11 | README/tooling polish | Low | Small | F-TOOL-01 |
| R-12 | Documentation accuracy pass | Low | Small | F-DOC-01, F-DOC-02, F-DOC-03, F-DOC-04, F-OPS-02 |
| R-13 | Extract a second `PageHeader` variant; align loading/error state idiom | Low | Small | F-CODE-02, F-CODE-03 |
| R-14 | Move `wireAnalysisToggles` to `lib/` | Low | Small | F-ARCH-02 |
| R-15 | Extend pending-state feedback fix to remix controls | Low | Small | F-UX-02 |

## R-01 — Require the `register` check before merge

**Severity:** High · **Effort:** Small · **Addresses:** F-CI-01

**Current state:** `tech-debt-register.yml`'s `register` job checks `TECH-DEBT.md`'s internal consistency on every PR, but the branch-protection ruleset's `required_status_checks` lists only `commit-format` and `CI` — `register` can fail red without blocking a merge.

**Intended end state:** The ruleset's `required_status_checks` includes `register` alongside `commit-format` and `CI`, verified by `gh api repos/Poetic-Poems/poetic-fiddle/rulesets/18828479` showing all three contexts, and by a test PR that deliberately desyncs the Ledger from Current Items being blocked from merging until fixed.

**Approach:** A ruleset/settings change via the GitHub UI or `gh api`, not a code change. No dependency on other recommendations, though R-05 addresses preventing this class of gap from recurring.

## R-02 — Add focus management & Escape dismissal to delete-poem confirmation

**Severity:** Medium · **Effort:** Small · **Addresses:** F-UX-01

**Current state:** `PoemsDashboard.tsx`'s delete confirmation swaps the "Delete" button for a confirmation `<div>` at the same DOM position with no focus management; the removed button was the focused element, so focus silently drops to `<body>`. No Escape-to-cancel exists, unlike every other dismissible surface in the app.

**Intended end state:** On opening the confirmation, focus moves onto it (default target: "Cancel"). An Escape keypress while the confirmation is open acts as Cancel. On both cancel and successful delete, focus returns to a sensible target (the row's own "Delete" trigger on cancel; the next/previous row's Delete button, or the "My poems" heading if the list becomes empty, on successful delete). New tests in `PoemsDashboard.test.tsx` cover focus placement and Escape dismissal alongside the existing click-based delete suite.

**Approach:** A small `onKeyDown` handler plus `.focus()` calls in the relevant state transitions; no new dependency needed for a confirmation this simple.

## R-03 — Re-sync vendored tech-debt scripts; harden `td-tooling-drift.yml`

**Severity:** Medium · **Effort:** Small · **Addresses:** F-GOV-01, F-CI-03

**Current state:** Three of the four vendored tech-debt scripts (`get-tech-debt-record.pl`, `next-tech-debt-id.pl`, `td-check.pl`) have drifted from `Poetic-Poems/poetic`'s current `main` since PR #145, and `td-tooling-drift.yml` hasn't run against the current versions. Separately, that workflow has no issue-filing on failure, unlike its sibling `check-poetic-release.yml`.

**Intended end state:** The vendored scripts match `poetic` main's legacy-format behaviour (a no-functional-change sync, since poetic's adaptive dual-format code stays backward-compatible with this repo's single-file `TECH-DEBT.md`). A manually triggered run of `td-tooling-drift.yml` passes cleanly against the re-synced scripts. The workflow files a durable GitHub issue on future drift detection, matching `check-poetic-release.yml`'s dedup pattern — or, if that's judged unnecessary, its header comment explicitly states why a bare failed run is sufficient here.

**Approach:** Pull the current scripts from `Poetic-Poems/poetic`'s `main`, diff against this repo's copies, and replace; confirm `perl scripts/td-check.pl TECH-DEBT.md` still passes locally afterward. Add the issue-filing step (or the explicit rationale) to `td-tooling-drift.yml`.

## R-04 — Decompose `use-poem-persistence.ts`'s flat state; dedupe the save-guard

**Severity:** Medium · **Effort:** Medium · **Addresses:** F-ARCH-01, F-CODE-01

**Current state:** The hook returns an ungrouped 24-field object across six independent async flows, and `handleShare`/`handleAllowRemixChange` duplicate the same eight-line "save if unsaved, then act" block verbatim.

**Intended end state:** The hook's return value is grouped by concern (e.g. `{ save: {...}, share: {...}, remix: {...} }`) rather than 24 flat fields, and `Editor.tsx`'s destructuring is updated to match. A small `ensureSaved(): Promise<string>` helper replaces the duplicated block in both call sites. All existing tests in `use-poem-persistence.test.ts` and `Editor.share.test.tsx`/`Editor.remix-permission.test.tsx` continue to pass unmodified in behaviour (only their setup/assertions may need updating for the new return shape).

**Approach:** This is a refactor, not a behaviour change — do it in one pass since both findings live in the same file and touching it twice would duplicate review effort. No dependency on other recommendations.

## R-05 — Guard against a new workflow shipping without required-check wiring

**Severity:** Medium · **Effort:** Medium · **Addresses:** F-CI-02

**Current state:** `ci.yml`'s header comment documents the discipline of adding new conditional jobs to its `needs` list, but nothing automated checks that discipline holds — and the cross-workflow version of the same gap (a new workflow not added to the branch-protection ruleset's required checks) already happened once, producing F-CI-01.

**Intended end state:** An automated check — in the spirit of `scripts/td-check.pl` — that parses `.github/workflows/*.yml`, lists every job triggered on `pull_request`, and fails if any isn't reachable from `ci.yml`'s `needs` graph or from a checked-in snapshot of the ruleset's `required_status_checks` (compared via `gh api` in CI, similar to how `td-tooling-drift.yml` compares against an external source). If a full automated check is judged disproportionate, a documented checklist step in whatever process adds a new workflow is an acceptable lower-cost alternative — state which was chosen and why.

**Approach:** Run after R-01 (fixing the concrete instance first makes the guard's initial state green). This is genuinely open-ended design work — plan the check's shape before implementing.

## R-06 — Fold PR #129's eslint blocker into TD26072429

**Severity:** Low · **Effort:** Small · **Addresses:** F-SEC-01, F-DEPS-01

**Current state:** TD26072429 already tracks the undocumented ESLint/TypeScript major-version holds, but doesn't record the specific upstream blocker: `eslint-config-next@16.2.12` bundles `eslint-plugin-react@7.37.5`, which still calls the ESLint-10-removed `context.getFilename()` API, confirmed by a maintainer comment on Dependabot PR #129.

**Intended end state:** TD26072429's body records this root cause (so a future agent doesn't rediscover it) and either the `typescript` major bump has been re-trialled and merged, or a dated rationale entry matching the jsdom/eslint precedent explains why it's still held.

**Approach:** Edit `TECH-DEBT.md` in place; trial `npm install typescript@latest` in a scratch branch to see if it's still blocked, and record the result either way.

## R-07 — Add `Referrer-Policy`/`X-Content-Type-Options`/`Permissions-Policy` headers

**Severity:** Low · **Effort:** Small · **Addresses:** F-SEC-02

**Current state:** `src/proxy.ts` sets only `x-nonce` and `Content-Security-Policy`.

**Intended end state:** The same response also carries `Referrer-Policy: strict-origin-when-cross-origin` (or stricter), `X-Content-Type-Options: nosniff`, and a `Permissions-Policy` disabling unused browser features (camera, microphone, geolocation at minimum). A test asserts all headers are present on a representative response.

**Approach:** Extend the existing `response.headers.set(...)` block in `src/proxy.ts`; no new dependency needed.

## R-08 — Add a CI `npm audit` gate and local `engine-strict` enforcement

**Severity:** Low · **Effort:** Small · **Addresses:** F-TOOL-02, F-TOOL-04, F-DEPS-02

**Current state:** No `npm audit` step exists in any CI workflow (relying entirely on out-of-band Dependabot alerts), and `.npmrc` has no `engine-strict`, so a Node-version mismatch produces only a warning locally.

**Intended end state:** `ci.yml`'s `build` job runs `npm audit --audit-level=high` (tuned to not fail on the already-tracked, dev-only eslint chain — e.g. via `--omit=dev` or an documented `.audit-ci.json` allowlist referencing TD26072429). `.npmrc` gains `engine-strict=true`, verified not to break the Vercel build (check Vercel's configured Node version matches `engines.node`'s `22.x` range first).

**Approach:** Two small, independent config changes; land together since both are "turn an advisory signal into an enforced one" in the same area.

## R-09 — Test-tooling quick wins: coverage, watch-mode, tokenizer test, timer teardown

**Severity:** Low · **Effort:** Small · **Addresses:** F-TEST-01, F-TEST-02, F-TEST-03, F-TEST-04

**Current state:** No coverage tool or watch-mode script exists (TD26072428); `poem-syntax.ts`'s tokenizer has no test coverage; the debounce tests' fake-timer cleanup relies on every test body reaching its own `vi.useRealTimers()` call with no `afterEach` safety net.

**Intended end state:** `@vitest/coverage-v8` (or equivalent) is added with a `coverage` script; a `test:watch` script exists; a new `poem-syntax.test.ts` drives `poemStreamParser.token` over each token-stream branch plus one adjacency case; an `afterEach(() => vi.useRealTimers())` is added (to the affected file or globally in `vitest.setup.ts`).

**Approach:** Four small, independent additions to the test-tooling area; land together since they're all quick, low-risk changes to the same configuration/test surface. Bundles TD26072428's existing scope with the two new findings from this review.

## R-10 — Build an account-data export mechanism; write the backup/export/delete runbook

**Severity:** Low · **Effort:** Medium · **Addresses:** F-DATA-01, F-OPS-01

**Current state:** The Privacy Policy promises poets can "ask us to export or delete your data," but no script, Admin-API call, or documented procedure exists to actually pull a poet's data out; account-level deletion is technically sound (FK cascade, pgTAP-tested) but entirely manual and undocumented; there is no repo-side backup/restore or export/delete runbook of any kind, and `SUPABASE_SERVICE_ROLE_KEY` is unused anywhere in the codebase.

**Intended end state:** A short, maintainer-run SQL script or Admin-API call exists (even if manually invoked, not automated) to export a poet's `poems`/`profiles` rows joined with their `auth.users` email. A short internal runbook (mirroring `docs/TRIAGE.md`'s style) documents both the export mechanism and the existing FK-cascade-based deletion path, plus states Supabase's actual PITR/backup coverage for this project's tier.

**Approach:** Both pieces belong in the same PR since the runbook needs the export mechanism to exist first to document it accurately.

## R-11 — README/tooling polish

**Severity:** Low · **Effort:** Small · **Addresses:** F-TOOL-01

**Current state:** Already fully described by TD26072430 — README's Development table omits `start`/`test:db`; no WSL pointer outside the setup script's own header; `sync-poetic-css.mjs`'s `require.resolve` throws a raw stack trace on failure.

**Intended end state:** As TD26072430 states — the two README rows added, a WSL pointer added (to `CONTRIBUTING.md`, which didn't exist when TD26072430 was filed), and the `require.resolve` wrapped in `try`/`catch` with an actionable message naming the pinned `poetic` version.

**Approach:** No new tech-debt entry needed — this recommendation's end state is identical to TD26072430's existing one; implement directly against that item.

## R-12 — Documentation accuracy pass

**Severity:** Low · **Effort:** Small · **Addresses:** F-DOC-01, F-DOC-02, F-DOC-03, F-DOC-04, F-OPS-02

**Current state:** `docs/IMPLEMENTATION-PLAN.md`'s W9 item wasn't marked done after its PR (#138) landed; `docs/TRIAGE.md`/`docs/SENTRY-AGENT-ACCESS.md` still narrate rejected alternatives; README never links the live app; `src/lib/revalidate-share.ts`'s doc comment names the wrong file and undercounts its call sites (now four, in two files, not three in `Editor.tsx`).

**Intended end state:** W9 is marked "— done (PR #138)," matching the pattern already used elsewhere in that document. The three "trialled and dropped/removed/abandoned" passages are trimmed to one-liners. README gains a "Live at..." link. The stale comment in `revalidate-share.ts` is corrected to name `use-poem-persistence.ts` and `PoemsDashboard.tsx` (or dropped in favour of "every call site").

**Approach:** All four are small, independent text edits across different files; bundle into one PR since none warrants its own review cycle. No code behaviour changes.

## R-13 — Extract a second `PageHeader` variant; align loading/error state idiom

**Severity:** Low · **Effort:** Small · **Addresses:** F-CODE-02, F-CODE-03

**Current state:** The page-header JSX pattern (title + description, no "last updated" line) is now duplicated across six files, since PR #148's `PageHeader` component was shaped only for the three legal pages' different layout. Separately, `PoemsDashboard.tsx` and `use-poem-persistence.ts` model the same "loading/loaded/error" shape with incompatible idioms (discriminated union vs. independent boolean/string pairs).

**Intended end state:** A second, simpler header component (title + optional description children) replaces the duplicated block in all six identified files. If R-04's hook restructuring hasn't already happened, note the idiom-alignment recommendation for whenever it does, rather than doing it here in isolation.

**Approach:** The header extraction is a small, independent, low-risk markup change — do it now. The idiom alignment is lower priority and explicitly deferred to R-04's work to avoid touching `use-poem-persistence.ts` twice.

## R-14 — Move `wireAnalysisToggles` to `lib/`

**Severity:** Low · **Effort:** Small · **Addresses:** F-ARCH-02

**Current state:** `wireAnalysisToggles`, pure DOM logic shared by `PoemPreview.tsx` and `SharedPoemView.tsx`, lives in a `"use client"` component file rather than `src/lib/`.

**Intended end state:** The function (and its associated types) live in `src/lib/`, imported by both `PoemPreview.tsx` and `SharedPoemView.tsx` the same way every other cross-cutting non-presentational function in the codebase is shared.

**Approach:** A pure move-and-reimport; no behaviour change. Low priority — do opportunistically next time either caller is touched, per the finding's own direction, rather than as a standalone PR.

## R-15 — Extend pending-state feedback fix to remix controls

**Severity:** Low · **Effort:** Small · **Addresses:** F-UX-02

**Current state:** TD26072431 already covers `SignInPrompt.tsx`'s disable-only feedback gap; the same pattern exists, unaddressed, on `PoemsDashboard.tsx`'s remix-default checkbox and `Editor.tsx`'s "Remixing this poem" select.

**Intended end state:** When TD26072431 is implemented, its fix (or the shared component/pattern it introduces) extends to these two controls as well, not just `SignInPrompt.tsx`.

**Approach:** No new tech-debt entry needed — implement as an expanded scope on TD26072431 when that item is picked up.
