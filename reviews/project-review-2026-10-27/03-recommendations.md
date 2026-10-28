# Recommendations

Ordered by severity first, then by effort at equal severity (quick wins before longer campaigns). Every Critical and High finding is covered below. No recommendation is written for a finding whose own evidence concluded "no action needed now," for findings already tracked by an existing issue/tech-debt record, or for a purely informational/strength note — these are listed in the footnote at the end instead.

| ID | Recommendation | Severity | Effort | Addresses |
|---|---|---|---|---|
| R-01 | Land the in-flight dependency-advisory fix; prioritise the durable CI audit-gate redesign | Critical | Small–Medium | F-SEC-01, F-CI-01, F-GOV-03, F-TEST-01 |
| R-02 | Keep the no-backend operational state visible; prepare for backup/PITR reinstatement | High | Small | F-OPS-01, F-OPS-02, F-DATA-01 |
| R-03 | Correct stale MVP-status documentation, fix the release-title bug, cut a release | Medium | Small | F-DOC-01, F-DOC-02, F-TOOL-02 |
| R-04 | Reconcile the disabled migration-deploy job with docs that still describe it as automatic | Medium | Small | F-CI-02 |
| R-05 | Extend real-browser e2e coverage to signed-in states and the public share page | Medium | Medium | F-UX-01, F-TEST-02 |
| R-06 | Close the stalled, maintainer-flagged-obsolete PR #510 | Low | Small | F-GOV-02 |
| R-07 | Fix the Privacy Policy's cookie-vs-localStorage wording | Low | Small | F-SEC-02 |
| R-08 | Reduce small type/validation duplication in `src/lib` | Low | Small | F-ARCH-03, F-CODE-01, F-CODE-02 |
| R-09 | Repo polish: README onboarding notes + suppress the justified lint warning | Low | Small | F-TOOL-01, F-TOOL-03, F-TOOL-04 |
| R-10 | Add test coverage for `scripts/*.mjs` CLI entry points | Low | Small | F-TEST-03 |
| R-11 | Add pagination/limit to `listPoems` | Low | Small | F-PERF-01 |

## R-01 — Land the in-flight dependency-advisory fix; prioritise the durable CI audit-gate redesign

**Severity:** Critical · **Effort:** Small (immediate unblock) / Medium (durable fix) · **Addresses:** F-SEC-01, F-CI-01, F-GOV-03, F-TEST-01

**Current state:** `main` carries 5 unpatched advisories (2 critical in `next`/`dompurify`, 3 high in `dompurify`/`markdown-it`/`vite`/`zod`). `CI`'s required `Audit dependencies` job audits the whole dependency tree with no baseline against `main`, so no single-package fix PR can go green while any other package's advisory remains outstanding — a structural deadlock that has frozen `main` for 9 days and blocked at least 4 unrelated PRs, including a pure test-coverage PR (#537).

**Intended end state:** All 5 advisories are cleared from `main`. The required audit gate no longer blocks a PR on advisories it did not introduce — a PR only fails the gate for advisories newly present relative to `main`'s own baseline.

**Approach:** This is already fully diagnosed and in flight by the repository's own autonomous pipeline — do not re-derive a fix. PR #546 (branch `agent/541`) bundles all five package bumps and is `mergeStateStatus: CLEAN` / `mergeable: MERGEABLE` as of this review; merge it. Issue #542 tracks the durable redesign (diff the advisory set against `main`'s own baseline rather than auditing the whole tree unconditionally) — prioritise it once #546 lands, since the same gridlock will recur on the next overlapping advisory otherwise.

## R-02 — Keep the no-backend operational state visible; prepare for backup/PITR reinstatement

**Severity:** High · **Effort:** Small · **Addresses:** F-OPS-01, F-OPS-02, F-DATA-01

**Current state:** No live Supabase project backs production (deliberately, since #418/#422) — sign-in, save, share, and remix are all non-functional for real users, degrading gracefully. This is accurately documented in `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md` and `docs/IMPLEMENTATION-PLAN.md` §6.3, but only in dedicated sections, not in either document's top-level summary — and there is currently no backup/PITR coverage of any kind, by necessity.

**Intended end state:** A reader skimming `README.md`'s or `docs/TRIAGE.md`'s opening summary (not just the dedicated backup section) immediately sees that production currently has no live backend, so a "production error" report is read in that light. When the Supabase project is eventually reinstated, the restoration includes a deliberate backup/PITR choice (at minimum the plan's default daily backups) rather than defaulting silently.

**Approach:** Add a one-line pointer to the top of `README.md` and/or `docs/TRIAGE.md` noting the current no-backend state and linking to the existing detailed section. No code change. Whether and when to restore a live Supabase project (and what backup/PITR tier to pick) is a decision for the maintainer alone, tied to cost and usage, and is explicitly out of scope for this recommendation — the only ask here is that `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md`'s existing backup section already commits to making that choice deliberately when the time comes; verify the wording is explicit and leave it otherwise untouched.

## R-03 — Correct stale MVP-status documentation, fix the release-title bug, cut a release

**Severity:** Medium · **Effort:** Small · **Addresses:** F-DOC-01, F-DOC-02, F-TOOL-02

**Current state:** `AGENTS.md`'s status line says M8/M9 work "remains" when `docs/IMPLEMENTATION-PLAN.md` §4 shows every W-item delivered. The only GitHub release (`v0.1.0`, tagged 2026-07-12) predates nearly the entire feature set (313 commits since). `.github/workflows/release.yml` titles every release "Poetic", not "Poetic Fiddle".

**Intended end state:** `AGENTS.md` and `IMPLEMENTATION-PLAN.md`'s headline status both say M0–M9 are delivered. `release.yml`'s title literal reads `"Poetic Fiddle ${{ steps.version.outputs.tag }}"`. A new release (e.g. `v1.0.0`) is cut reflecting the delivered MVP, with the corrected title.

**Approach:** Three small, same-spirit edits bundled into one PR: update both docs' status paragraphs, fix the one-line title string, and run the existing `docs/RELEASE-RUNBOOK.md` procedure to cut the release. No code behaviour changes.

## R-04 — Reconcile the disabled migration-deploy job with docs that still describe it as automatic

**Severity:** Medium · **Effort:** Small · **Addresses:** F-CI-02

**Current state:** `.github/workflows/ci.yml`'s `deploy` job carries `if: false` (disabled since the Supabase project was dropped), but `docs/IMPLEMENTATION-PLAN.md` §6.2 still states in the present tense that a (non-existent) `database.yml` workflow's `deploy` job "runs that push against the live project automatically."

**Intended end state:** `IMPLEMENTATION-PLAN.md` §6.2 describes the current, disabled, manual-push state as-built, naming the actual job location (`ci.yml`), and names the manual `supabase db push` step a maintainer would need to run until the job is re-enabled.

**Approach:** Doc-only edit; no code change. Depends on nothing else in this list.

## R-05 — Extend real-browser e2e coverage to signed-in states and the public share page

**Severity:** Medium · **Effort:** Medium · **Addresses:** F-UX-01, F-TEST-02

**Current state:** `e2e/a11y.spec.ts` and `e2e/poem-link-gestures.spec.ts` are the only two Playwright specs, both scoped to signed-out routes (`/`, `/poems`) because reaching signed-in states or `/share/<id>` needs a live Supabase project the suite currently cannot reach. This leaves the save/share/remix/export/delete flows — and the public share page, the project's most exposed surface — with zero real-browser accessibility or interaction coverage.

**Intended end state:** `e2e/a11y.spec.ts` also scans `/share/<id>` and at least one signed-in dashboard state (e.g. the Danger Zone dialog), catching both colour-contrast and structural a11y regressions on those surfaces in CI.

**Approach:** Does not need to wait for a live production Supabase project — build a local/CI-seeded Supabase fixture (the repo already supports `supabase start` for local development and `supabase test db` for pgTAP) that the Playwright run can sign into and create a shareable poem against. This is the most involved recommendation in this set; budget real engineering time for the fixture, not just the new assertions.

## R-06 — Close the stalled, maintainer-flagged-obsolete PR #510

**Severity:** Low · **Effort:** Small · **Addresses:** F-GOV-02

**Current state:** PR #510 has been open since 2026-10-07, labelled `obsolete` by the maintainer on 2026-10-11, and recorded as void by two separate pipeline comments since — it remains open and is now `mergeStateStatus: DIRTY`. Issue #485 ("close-void-github-items.sh silently drops every void candidate...") is the most likely root cause already tracked in this repository's issue history.

**Intended end state:** PR #510 is closed.

**Approach:** A one-command manual close (`gh pr close 510`); no code change. Not filed as new tech debt — the likely root cause is already tracked as #485.

## R-07 — Fix the Privacy Policy's cookie-vs-localStorage wording

**Severity:** Low · **Effort:** Small · **Addresses:** F-SEC-02

**Current state:** `src/app/privacy/page.tsx` tells poets Supabase sets "the essential cookie" to keep them signed in; the code actually stores the session in `localStorage` via `@supabase/auth-js`'s default.

**Intended end state:** The Privacy Policy's "Cookies and tracking" section accurately describes the session as stored in the browser's local storage.

**Approach:** A one-paragraph copy edit in `src/app/privacy/page.tsx`. No code or behaviour change.

## R-08 — Reduce small type/validation duplication in `src/lib`

**Severity:** Low · **Effort:** Small · **Addresses:** F-ARCH-03, F-CODE-01, F-CODE-02

**Current state:** `src/lib/supabase-server.ts`'s three client factories each hand-roll the same env-var-presence check with independently-drifted wording instead of reusing `src/lib/env-errors.ts`'s shared constant. Separately, `src/lib/use-poem-crud.ts` and `use-poem-persistence.ts` declare two independent, ~35-line-overlapping return-type interfaces by hand.

**Intended end state:** `supabase-server.ts`'s three factories share one validation helper/constant per key-pair. `UsePoemPersistenceResult` is derived from `UsePoemCrudResult` via `Omit<...> & { session: ... }` rather than restated.

**Approach:** Two small, independent refactors bundled into one PR since both touch `src/lib` and are the same class of "stop restating a shared shape" cleanup; no behaviour change, verify via the existing test suite.

## R-09 — Repo polish: README onboarding notes + suppress the justified lint warning

**Severity:** Low · **Effort:** Small · **Addresses:** F-TOOL-01, F-TOOL-03, F-TOOL-04

**Current state:** README doesn't tell a contributor on the wrong Node version what to do about it, or that local Supabase dev needs Docker running. `AccountDangerZone.tsx:93`'s one lint warning has no suppression, so it's easy to stop noticing among future warnings.

**Intended end state:** README names `nvm install 22 && nvm use` as the fix for an `EBADENGINE` error and notes the Docker prerequisite for `supabase start`. The lint warning is suppressed with a targeted `eslint-disable-next-line` so `npm run lint`'s output is empty again.

**Approach:** Three trivial, no-risk edits (two in README, one in a component file) bundled into a single small PR.

## R-10 — Add test coverage for `scripts/*.mjs` CLI entry points

**Severity:** Low · **Effort:** Small · **Addresses:** F-TEST-03

**Current state:** `scripts/export-poet-data.mjs` — the privacy-fulfilment export tool — has untested branches in `buildAdminClient()`'s env-var check, `defaultOutputPath()`, and `main()`'s arg parsing/file-write/module-execution guard (lines 175-213, 220-222).

**Intended end state:** Those branches are covered in the existing co-located `scripts/export-poet-data.test.mjs`, following the same test pattern already used for the script's other functions.

**Approach:** Standard unit testing against the existing test file's conventions; no production code change expected.

## R-11 — Add pagination/limit to `listPoems`

**Severity:** Low · **Effort:** Small · **Addresses:** F-PERF-01

**Current state:** `src/lib/poems-store.ts:170-176`'s `listPoems(ownerId)` selects every row matching `owner_id` with no `.limit()`/range.

**Intended end state:** `listPoems` accepts a page size/offset (or at minimum a sane hard cap), and `PoemsDashboard.tsx` either paginates or at least won't blow past a reasonable row count unbounded.

**Approach:** Small, low-risk addition; not urgent given today's scale, but cheap to do now before poem counts per account grow.

---

**No recommendation was written for:**
- F-ARCH-01 and F-ARCH-02 — already tracked (tech debt `TD26071401`/`TD26071602`; parked issue #457).
- F-SEC-03, F-OPS-03, F-UX-02 — informational strengths/non-defects, nothing to remedy.
- F-GOV-01 — a disclosed, accepted single-maintainer/no-succession-plan risk with no proposed remedy at this project's current scale.
- F-GOV-04 — a cross-repository observation about the Pullwright pipeline's own issue-tracker footprint, not a Poetic Fiddle-specific action.
- F-DEPS-01, F-DEPS-02, F-DEPS-03 — each finding's own direction concluded "no action needed now."
- F-DOC-03 — its own finding concludes the fix is "not worth a standalone edit."
- F-CI-03 — moot once R-01's durable fix (#542) lands; no standalone action recommended.
