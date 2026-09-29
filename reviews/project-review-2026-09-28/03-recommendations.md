# Recommendations

Ordered by severity first, then by effort at equal severity (quick wins before longer campaigns). No Critical or High findings exist this pass, so nothing is urgent; the four Medium-severity recommendations (R-01 through R-04) are all Small effort and worth doing soon regardless of order among themselves. R-05 through R-07 are Low-severity polish.

| ID | Recommendation | Severity | Effort | Addresses |
|---|---|---|---|---|
| R-01 | Group peer-locked npm dependency pairs in Dependabot config | Medium | Small | F-DEPS-01 |
| R-02 | Clear the two stalled owner-only GitHub escalations | Medium | Small | F-GOV-01, F-GOV-02 |
| R-03 | Reconcile documentation with the current no-backend production state | Medium | Small | F-GOV-03, F-OPS-01, F-DOC-01 |
| R-04 | Add regression coverage for the mobile resize/postscript-clamp fix | Medium | Small | F-TEST-03 |
| R-05 | Backfill small targeted unit-test gaps | Low | Small | F-TEST-01, F-TEST-02, F-UX-02, F-TEST-04 |
| R-06 | Reduce duplication/complexity in the persistence and orchestration layer | Low | Medium | F-ARCH-02, F-CODE-01, F-CODE-02 |
| R-07 | Small documentation-accuracy fixes | Low | Small | F-SEC-01, F-DOC-02 |

No recommendation was written for F-ARCH-01 (issue #446 already covers it fully), F-TOOL-01 (an environmental caveat of this review's own sandbox, not a repository defect), or F-UX-01 (informational — no defect to fix).

## R-01 — Group peer-locked npm dependency pairs in Dependabot config

**Severity:** Medium · **Effort:** Small · **Addresses:** F-DEPS-01

**Current state:** `.github/dependabot.yml`'s npm block has no `groups:` stanza. `react`/`react-dom` and `vitest`/`@vitest/coverage-v8` are version-locked pairs, but Dependabot opens them as independent PRs. All three currently-open Dependabot PRs (#426, #442, #424) are CI-red and blocked as a direct result, and have been for 8+ days.

**Intended end state:** `.github/dependabot.yml` groups `react`+`react-dom` and `vitest`+`@vitest/coverage-v8` (and any other peer-locked pairs found, e.g. `@testing-library/*` if applicable) so Dependabot bumps each pair together in one PR. PRs #424/#426/#442 are closed and Dependabot regenerates them as grouped, green PRs.

**Approach:** Add a `groups:` entry under the npm `updates:` block per [Dependabot's grouped-updates syntax](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#groups). No code change needed beyond the YAML edit; verify by observing the next Dependabot run opens one combined PR per pair instead of two independent ones.

## R-02 — Clear the two stalled owner-only GitHub escalations

**Severity:** Medium · **Effort:** Small (owner action, not a code change) · **Addresses:** F-GOV-01, F-GOV-02

**Current state:** Two mechanical, owner-only GitHub actions have been escalated and sat unresolved: issue #432 (close PR #421, delete branch `agent/failed-run-check-supabase-auth-drift`) since 2026-09-22, and issue #437 (add `changelog-section` to the `default` ruleset's required status checks) since 2026-09-24. Both are fully specified — no ambiguity, no code to write — and both are blocked purely because they require repo-admin permission that no pipeline agent holds.

**Intended end state:** PR #421 is closed and its branch deleted; the `default` ruleset's required status checks include `changelog-section` alongside `commit-format` and `CI`; `.github/required-checks.yml`'s `changelog-section` entry moves from `exempt:` to `required:` (ordinary follow-up agent work once the ruleset carries the check); issues #431, #432 and #437 are closed.

**Approach:** This is not a coding task — the commands are already given verbatim in issues #432 and #437. This recommendation exists to surface, in one place, that two small owner actions are the only thing blocking both items, and that leaving them unresolved has a real (if small) recurring cost: a stuck draft PR with a live branch risks regenerating itself if mishandled (per the precedent #369/#368 both issues cite), and the changelog-section gate stays advisory rather than enforced in the meantime.

## R-03 — Reconcile documentation with the current no-backend production state

**Severity:** Medium · **Effort:** Small · **Addresses:** F-GOV-03, F-OPS-01, F-DOC-01

**Current state:** Since 2026-09-19 (issue #418), production has run with no live Supabase project: sign-in, save and share are down for real users, degraded gracefully by design. `docs/IMPLEMENTATION-PLAN.md` §6.3 correctly reflects this, but two other places don't: `README.md`'s "CI (GitHub Actions)" section still describes the `deploy` job as actively pushing migrations on every merge (it has `if: false` since PR #428), and `docs/REQUIREMENTS.md` AC93 still states the Supabase organisation "is currently on the Pro plan" (false since the same event). Nothing records whether the no-backend state is temporary or indefinite.

**Intended end state:** README's CI section notes the `deploy` job is currently disabled and why (mirroring the framing already used in README's "Environment & secrets" section above it); `docs/REQUIREMENTS.md` AC93 is updated to match `docs/IMPLEMENTATION-PLAN.md` §6.3's accurate description; a one-line status note (even "indefinite, revisit if usage/cost changes") exists somewhere natural so a reader doesn't have to reconstruct the timeline from three closed issues to know whether restoration is planned.

**Approach:** Three small, independent text edits, no code changes. Verify by re-reading README top-to-bottom for internal consistency and confirming REQUIREMENTS.md and IMPLEMENTATION-PLAN.md no longer disagree about the org's current plan.

## R-04 — Add regression coverage for the mobile resize/postscript-clamp fix

**Severity:** Medium · **Effort:** Small · **Addresses:** F-TEST-03

**Current state:** `PoemPreview.tsx` and `SharedPoemView.tsx` both contain a `ResizeObserver`-driven debounce fixing a previously-shipped bug (`TD-PPpfid-26080108`: postscript clamping breaking when a pane toggles from `display:none` to visible on mobile). Neither has a test exercising this path (branch coverage 62.5%/66.66% respectively on the relevant lines).

**Intended end state:** A test in each of `PoemPreview.test.tsx` and `SharedPoemView.test.tsx` that mocks/polyfills `ResizeObserver`, triggers a resize, and asserts `evaluatePostscriptPreviews` (or its observable effect) fires after the debounce — so a future regression to this specific, previously-shipped bug is caught by CI rather than requiring a human to notice on a phone.

**Approach:** jsdom doesn't implement `ResizeObserver`; use a minimal test-double (a fake class capturing its callback, assigned to `global.ResizeObserver`) consistent with however the rest of the suite already mocks browser APIs jsdom lacks. Verify with `npm test -- PoemPreview SharedPoemView` and confirm the previously-uncovered lines now show as covered in `npm run coverage`.

## R-05 — Backfill small targeted unit-test gaps

**Severity:** Low · **Effort:** Small · **Addresses:** F-TEST-01, F-TEST-02, F-UX-02, F-TEST-04

**Current state:** Four small, unrelated coverage gaps: `draft-storage.ts`'s private-browsing/quota-exceeded catch blocks are untested; `poem-title.ts`'s non-string-title branch is untested; neither `SignInPrompt.tsx` nor `AccountDangerZone.tsx`'s native-`<dialog>` focus behaviour is asserted by a test; and a few `scripts/*.mjs` tooling files (`sync-poetic-css.mjs`, `check-dependency-audit.mjs`, `extract-changelog-notes.mjs`) sit well below the project's ~90% average coverage.

**Intended end state:** Each gap has at least one test exercising it: a mocked-throwing `window.localStorage` test per `draft-storage.ts` function; a non-string-title case for `poem-title.ts`; a focus-assertion test for each dialog component; and targeted tests raising the three named scripts closer to the project's typical coverage level (not `generate-favicons.mjs`, which is deliberately excluded from CI per its own header comment — leave it alone).

**Approach:** These are independent, mechanical additions in well-established test patterns already used elsewhere in the suite — good candidates for a lower-cost tier, one gap at a time. Verify with `npm run coverage` and confirm each named file's coverage improves without any existing test breaking.

## R-06 — Reduce duplication and complexity in the persistence and orchestration layer

**Severity:** Low · **Effort:** Medium · **Addresses:** F-ARCH-02, F-CODE-01, F-CODE-02

**Current state:** Three related maintainability observations, none a current defect: `use-poem-persistence.ts` (438 lines) is the project's highest-fan-out unit, mixing session-migration and save/share/remix CRUD concerns in one hook; `poems-store.ts` and `account.ts` together repeat an identical 6-line domain-error-class shape nine-plus times; `PoemsDashboard.tsx` inlines orchestration that its sibling `Editor.tsx` extracts to a hook.

**Intended end state:** `use-poem-persistence.ts`'s session-migration concern (roughly lines 132-229) is split from its save/share/remix CRUD concern (roughly lines 244-365) into two composed hooks; the repeated error-class boilerplate is replaced by a small factory function; if `PoemsDashboard.tsx` grows further, its orchestration is extracted into a `usePoemsDashboard` hook mirroring `usePoemPersistence`'s pattern. None of this changes observable behaviour.

**Approach:** This is a pure refactor with existing test coverage as the safety net (`use-poem-persistence.test.ts` is 546 lines; `poems-store.test.ts` is 418 lines). Best done opportunistically alongside the next feature change that touches each area, rather than as a standalone effort, to avoid refactor-only PRs with no functional payoff. Verify with the existing test suites (`npm test`) passing unchanged, plus `npm run typecheck` to confirm `instanceof` checks against the refactored error classes still narrow correctly.

## R-07 — Small documentation-accuracy fixes

**Severity:** Low · **Effort:** Small · **Addresses:** F-SEC-01, F-DOC-02

**Current state:** Two small, unrelated documentation gaps: the app's correct same-origin CORS default isn't noted anywhere, and `CONTRIBUTING.md` still documents the retired `td/<id>` branch-naming convention that `AGENTS.md`'s current policy explicitly retires.

**Intended end state:** A one-line CORS note exists somewhere natural (e.g. `docs/CSP-REVIEW-CHECKLIST.md`); `CONTRIBUTING.md`'s branch-naming guidance either drops the `td/<id>` line or points to `AGENTS.md`'s current tech-debt section instead.

**Approach:** Two independent one-line text edits. Verify by re-reading `CONTRIBUTING.md` and confirming it no longer contradicts `AGENTS.md` on the same procedure.
