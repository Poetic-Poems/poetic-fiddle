# Findings

This review found no Critical or High-severity findings. The Medium findings
are two genuine, concrete gaps that emerged since the previous review
(2026-07-31), and this pass also caught two paired findings (UX/DOC and
DEPS/CI/GOV) surfaced independently by different dimension reviewers, which
are consolidated below rather than double-counted. Every finding is checked
against the two prior reviews' `02-findings.md`; where a prior finding is
resolved, that is stated in the dimension's introduction rather than re-filed.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 6 |
| Low | 19 |

## Architecture and design (ARCH)

**Strengths:** The `app/` → `components/` → `lib/` layering remains
consistently followed. The sanitisation seam structurally improved since the
last review — both the client and server DOMPurify call sites now import one
shared `POEM_SANITIZE_CONFIG` object, closing a drift risk the previous
review could only verify was *currently* consistent. The `poetic` cross-repo
rendering seam is genuinely exercised end-to-end by tests, not assumed. The
previous review's god-object concern in `use-poem-persistence.ts` is
concretely resolved (grouped return shape, a shared `ensureSaved()` helper).

### F-ARCH-01 — `docs/IMPLEMENTATION-PLAN.md`'s M8/M9 work list has gone stale on two items it commits to keeping current · **Low**

**Evidence:** W10 ("breach-handling... nothing user-facing today") is done — `src/app/privacy/page.tsx:169-179` has a "Privacy breach notification" section since PR #180. W14 ("no export flow exists") is now partially addressed — `scripts/export-poet-data.mjs` plus `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md` shipped in PR #191, though what shipped is a maintainer-run admin script, not the self-service flow W14 describes.

**Impact:** Low — the doc is explicitly living/non-authoritative — but an agent scanning the W-list for unclaimed work would read W10/W14 as open and duplicate already-shipped work.

**Direction:** Addressed by R-11.

### F-ARCH-02 — Pure DOM-manipulation helpers still live in a `components/` file and are imported cross-component · **Low**

**Evidence:** `wirePoemToggles`/`evaluatePostscriptPreviews` (`src/components/PoemPreview.tsx:24-159`) have no JSX/React dependency; `src/components/SharedPoemView.tsx:4-8` imports both cross-component. The 2026-07-31 review recommended moving these to `src/lib/` (R-14) but that recommendation was never converted into a tracked tech-debt item, so it dropped off the register even though both call sites were touched again since.

**Impact:** Low, purely organisational — it works and both call sites document the coupling.

**Direction:** Addressed by R-10.

## Code quality and maintainability (CODE)

**Strengths:** `npm run lint`/`typecheck`/`format:check` are clean; a fresh sweep of `src/` found zero `any`/`eslint-disable`/`@ts-ignore`/`TODO`/`FIXME`/`HACK`/stray `console.*`/bare `catch {}`. Error handling is a genuine, consistent idiom (nine dedicated `Error` subclasses, all deliberately-swallowed paths routed through `reportSwallowedError`). The previous review's flat 24-field hook-return-shape finding is concretely fixed, not just relabelled.

### F-CODE-01 — The route-heading JSX pattern is still duplicated across four pages; the prior review's fix recommendation was never tracked · **Low**

**Evidence:** `PageHeader.tsx` exists and is used by the three legal pages, but `src/app/page.tsx:8-13`, `src/app/poems/[id]/page.tsx:14-19`, `src/app/poems/page.tsx:9-20`, and `src/app/remix/[share_id]/page.tsx:41-50` still hand-roll the identical `<h1>`+`<p>` block inline. This is unchanged since the 2026-07-31 review's F-CODE-02 (R-13); like F-ARCH-02 above, that recommendation was never registered.

**Impact:** Cosmetic today, but the four instances have already begun to diverge (`poems/page.tsx` gained `id`/`tabIndex` the other three lack) and a future style tweak needs four synchronised edits.

**Direction:** Addressed by R-09.

### F-CODE-02 — Two incompatible idioms model the same "loading/loaded/error" shape · **Low**

**Evidence:** `PoemsDashboard.tsx:17-25` uses discriminated unions; `use-poem-persistence.ts` uses independent boolean/string pairs for the same shape across six async flows (e.g. `saving`/`saveError`), so an impossible state (`saving === true && saveError !== null`) is representable even though never intended. Unchanged since the 2026-07-31 review's F-CODE-03.

**Impact:** Low — both files are well-tested and the impossible states aren't reachable in practice — but the file most recently restructured (`use-poem-persistence.ts`, PR #187) didn't pick this up.

**Direction:** No recommendation scheduled — opportunistic only, next time any of the six flows is substantially touched. Not filed to the tech-debt register given its low, non-urgent nature.

## Security (SEC)

**Strengths:** No secrets found anywhere in the working tree or full git history (targeted pattern sweep). Account deletion authenticates via a verified bearer token, never a client-supplied id. CSP is unchanged and now carries the headers (`Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`) the previous review asked for. The `poetic` tarball dependency carries a real `sha512` integrity hash. `npm audit`'s CI gate now covers the full dependency tree unconditionally, backed by a weekly scheduled scan with issue-filing.

### F-SEC-01 — The Supabase auth-config drift check doesn't cover rate-limit or CAPTCHA settings · **Low**

**Evidence:** `scripts/check-supabase-auth-drift.mjs`'s `ALLOWLIST` (lines 85-169) checks password/MFA/JWT/OTP settings but has no entry for `supabase/config.toml`'s `[auth.rate_limit]` or `[auth.captcha]` sections. A live drift in either would produce no red run and no issue, unlike every other allowlisted auth control.

**Impact:** Rate limiting and CAPTCHA blunt credential-stuffing/OTP-guessing against sign-in/sign-up and the account-delete flow — a monitoring gap, not a confirmed live misconfiguration.

**Direction:** Addressed by R-07.

## Testing and quality assurance (TEST)

**Strengths:** 454/454 tests pass across 47 files; coverage is 88.97%/82.46%/90.26%/90.85% (stmt/branch/func/line). Zero snapshot tests, zero `.only`/`.skip`. The `poetic` renderer seam is tested against genuine upstream output in two separate files, not mocked assumptions. Both prior reviews' test gaps (CodeMirror tokenizer, `use-session.ts`) are now filled with real coverage. Permission-sensitive mutations (remix, account deletion, share visibility) are tested at three independent layers each (UI, route, database/pgTAP).

### F-TEST-01 — The share page's render-failure path has zero real-implementation coverage · **Medium**

**Evidence:** `src/lib/render-share.ts:106-119`'s `renderSharedPoemHtml` try/catch — the mechanism that turns an unparseable saved `.poem` into a friendly degrade instead of a public 500 — is never called by any test; `render-share.test.ts` only exercises the inner `sanitizeSharedPoemHtml`, and `page.test.tsx` fully mocks the wrapper. Coverage: 78.37%/73.33%/66.66%/82.85%, with the catch body uncovered. The client-side equivalent (`tryRenderPoem`) *is* tested against a real parse failure — this is an asymmetry, not a project-wide gap.

**Impact:** This is the exact mechanism intended to prevent the class of public-facing 500 this project has hit before (issue #52). A regression here would only be caught by breaking in production.

**Direction:** Addressed by R-02.

### F-TEST-02 — `supabase-server.ts`'s real implementation has 0% coverage · **Medium**

**Evidence:** `src/lib/supabase-server.ts` is 0%/0%/0%/0% across the board; both consumers mock the module entirely. `getSupabaseAdmin()` is, by its own doc comment, "the only place [in the codebase] that can bypass RLS," and backs the account-deletion route. Its fail-closed guard (throw if `SUPABASE_SERVICE_ROLE_KEY` is unset) is currently asserted only by reading the code.

**Impact:** A regression that weakened this guard (e.g. swallowing the missing-env-var case) would ship unnoticed by the suite. Rated Medium, not High: the actual blast radius is bounded by Vercel's own env-var provisioning, and no code path currently calls this with attacker-controlled input.

**Direction:** Addressed by R-02.

### F-TEST-03 — One fake-timer test file lacks the teardown safety net added elsewhere · **Low**

**Evidence:** `src/components/Editor.share.test.tsx` has one `vi.useFakeTimers()` test with a manual (not `afterEach`) real-timer restore; three sibling files already have the `afterEach(() => vi.useRealTimers())` net the 2026-07-31 review asked for (F-TEST-02).

**Impact:** A failing assertion between the fake-timer call and the manual restore would leak fake timers into the next test in the file.

**Direction:** Addressed by R-02 (bundled).

### F-TEST-04 — Coverage tooling exists but is not gated or thresholded · **Low**

**Evidence:** `vitest.config.ts`'s `coverage` block sets no `thresholds`; no CI workflow invokes `npm run coverage`.

**Impact:** The tool now exists (resolving the prior review's "no tool configured" finding) but nothing stops the current numbers from silently drifting down.

**Direction:** No recommendation scheduled — optional given project scale, proportionate to a solo-maintainer project. Not filed to the tech-debt register.

## Dependencies and supply chain (DEPS)

**Strengths:** 13 direct runtime / 19 dev dependencies, all justified by a named feature; no trivial or abandoned dependencies found. `package-lock.json` is committed and the non-registry `poetic` dependency carries a real integrity hash. The `poetic` pin (6.4.0) is current against upstream's latest release, and the freshness-check workflow has a verified successful run. A full licence-checker scan found no incompatible licences for the shipped MIT project. Two independent audit channels (`ci.yml`'s job, plus a new weekly `dependency-audit.yml`) both currently report 0 high-severity advisories.

### F-DEPS-01 — No Dependabot `ignore` rule for the blocked `eslint` major bump · **Low**

**Evidence:** PR #129 (`eslint` 9→10) is permanently conflicting — `eslint-config-next` doesn't yet support ESLint 10 (documented in `tech-debt/TD-PPpfid-26072429.md`). `.github/dependabot.yml` has `ignore` rules for the two other documented, blocked majors (`jsdom`, `typescript`) but not for `eslint`.

**Impact:** Cosmetic/process only, but produces recurring Dependabot noise until the ignore rule is added or upstream ships support.

**Direction:** Addressed by R-05.

### F-DEPS-02 — A clean, mergeable Dependabot PR (#170, `codeql-action`) sat unmerged 7+ days · **Low**

**Evidence:** `gh pr view 170` → `mergeable: MERGEABLE`, all checks green, opened 2026-08-01, still open at review time — the one outlier against an otherwise same-day merge cadence for `npm`-ecosystem Dependabot PRs.

**Impact:** Low, CI-only dependency, but the one visible triage gap found. (Same observation as `findings-CI.md`'s F-CI-03 and `findings-GOV.md`'s F-GOV-04 — consolidated, not triple-counted.)

**Direction:** Addressed by R-05 (bundled).

### F-DEPS-03 — `TD-PPpfid-26072429`'s resolution status is under live, unresolved human debate · **Informational**

**Evidence:** GitHub issue #228 asks the maintainer to judge whether the item's "undocumented" filing reason is now satisfied (both holds are now dated and root-caused) even though the `eslint` bump itself hasn't landed. This review found the underlying facts (typescript bump merged, eslint bump genuinely blocked) accurate on both sides of the debate.

**Impact:** None on code or supply-chain risk — register bookkeeping only, already in front of the maintainer.

**Direction:** No action — this review defers to the maintainer's pending decision on issue #228, not this review's call to make.

## Tooling and developer experience (TOOL)

**Strengths:** README traces cleanly to the actual install/dev experience — no undocumented steps needed to reach a clean `build`/`lint`/`typecheck`. All prior High/Medium TOOL findings (`.nvmrc`, `engine-strict`, WSL docs, on-screen missing-env-var messages, local-Supabase docs) are resolved with real artefacts. The `postinstall` code-generation step (`sync-poetic-css.mjs`) is well-engineered: it fails loudly and specifically in CI, before `main`, if `poetic`'s CSS export path moves. Editor/tooling config is consistent and complete.

### F-TOOL-01 — `sync-poetic-css.mjs` is the one `scripts/` utility with no unit test · **Low**

**Evidence:** Every other `.mjs` script in `scripts/` has a matching `*.test.mjs`; this one — which runs unconditionally on every `npm install` and guards a specific upstream-drift scenario — doesn't.

**Impact:** Low; the failure path is human-readable if it fires, but the guard's own correctness is currently unverified by any test.

**Direction:** Addressed by R-08.

### F-TOOL-02 — `dependency-audit.yml` has no run history yet · **Informational**

**Evidence:** Added 2026-08-04; its weekly Monday cron hasn't fired yet as of this review.

**Impact:** None — will self-resolve by next Monday.

**Direction:** No action needed.

## CI/CD and release engineering (CI)

**Strengths:** The conditional-job-plus-required-gate design in `ci.yml` holds under live inspection (branch protection verified via `gh api`, not just docs); its newest addition, `workflow-wiring`, closes the previous review's headline finding. Two independently scheduled drift guards now both file deduplicated issues on failure. CI is fast (a full app-touching PR run completes in under two minutes).

### F-CI-01 — Release/tag process dormant for a month against continuous deployment; no documented rollback anchor · **Medium**

**Evidence:** `package.json`'s version is still `0.1.0`; the only GitHub release predates the MVP by a week. `CHANGELOG.md`'s `[Unreleased]` section is 400 of 410 lines and has never been renamed. `main` deploys continuously to Vercel, independent of `release.yml`. No rollback runbook exists in the repository.

**Impact:** The release mechanism is well-engineered but unexercised in practice — a usage gap, not a design gap. If a bad deploy needed a documented rollback target, the only repo-recorded checkpoint predates nearly every shipped feature.

**Direction:** Addressed by R-03.

### F-CI-02 — The `npm audit` CI gate is flaky by design, and that flakiness was the proximate trigger of a real process incident · **Low**

**Evidence:** 2 of the last 19 `CI` runs on `main` failed solely on `Audit dependencies`; on the identical commit `a6647036`, the 23:13 run correctly reported two live advisories (GHSA-2v37-7h3g-55p8, nanoid, HIGH; GHSA-55q2-fjhq-7xh7, dompurify, MODERATE) and exited 1, and the 03:53 run on the same unchanged tree reported "found 0 vulnerabilities" and exited 0 — the first run was correct, the second was the flake. This is the documented proximate cause of the PR #221→#223 register-hygiene incident (see F-GOV-01). See #336 for the defect.

**Impact:** Low as a correctness matter, but its downstream cost (two escalation issues, a stuck draft PR, real maintainer toil) was not.

**Direction:** Addressed by R-12.

### F-CI-03 — A clean, mergeable Dependabot PR has sat unmerged 7+ days · **Low**

Same finding as F-DEPS-02; see that entry. **Direction:** Addressed by R-05.

## Performance and scalability (PERF)

**Strengths:** The live-preview/draft-autosave debounce unification (fixed in a prior review, PR #152) remains correct and is the standout PERF-relevant decision in the codebase. Every reviewed Supabase query selects named columns, never `select("*")`; the one query that scales with a user's data is matched by a purpose-built composite index. `shared-poem-cache.ts` is a correct, bounded cache with real tag-based invalidation. Outbound-call timeout/retry semantics are uniform and correct.

### F-PERF-01 — `listPoems` has no `LIMIT`/pagination; the dashboard renders every row unvirtualised · **Low**

**Evidence:** `src/lib/poems-store.ts:204-220`'s dashboard query has no `.limit()`/`.range()`; `PoemsDashboard.tsx:284` renders the full result set with no windowing.

**Impact:** Genuinely low risk at this project's current scale (a solo poet's saved-poem count) — flagged for the record before a bulk-import or multi-account-merge feature could make it matter sooner.

**Direction:** No recommendation scheduled — revisit opportunistically if/when row counts grow. Not filed to the tech-debt register.

## Usability and accessibility (UX)

**Strengths:** The 2026-07-31 review's delete-confirmation focus-management fix is genuinely thorough (focus-on-open, Escape-to-cancel, sensible focus-return, five dedicated passing tests). W5 (320px/200% reflow) and W6 (mobile Source/Preview toggle) hold up against direct code reading. The newly-added account-deletion flow reuses established, effective patterns (native `<dialog>`, type-to-confirm). No i18n scaffolding exists — confirmed a deliberate, explicit single-locale scope choice, not an abandoned half-build. `contrast.test.ts` (90 tests) and both component-level axe suites pass cleanly when re-run directly.

### F-UX-01 — Component-level axe suites never exercise either "open dialog/confirmation" state · **Low**

**Evidence:** `PoemsDashboard.a11y.test.tsx` never opens the delete-poem confirmation or the account-deletion `<dialog>` before running `axe()`.

**Impact:** Both surfaces were manually verified sound this pass, but a future regression to either open-state's markup would ship past `npm test` undetected, on the app's two most destructive actions.

**Direction:** Addressed by R-06.

### F-UX-02 — Terms of Service still tells poets account deletion requires emailing the maintainer, contradicting the Privacy Policy and the shipped self-service flow · **Medium**

**Evidence:** `src/app/terms/page.tsx:147-163`'s Termination section still says deletion requires emailing the maintainer. The Privacy Policy's equivalent section was fixed by PR #193 (2026-08-03) to describe the self-service Danger Zone flow that shipped the same day (W13); the Terms fix never happened — its last touch (PR #143, 2026-07-28) predates W13 by five days.

**Impact:** No data-loss risk, but actively steers a non-technical poet — this project's audience — away from the one-click self-service flow and toward a slower, maintainer-dependent path, on the one page whose purpose is explaining account termination.

**Direction:** Addressed by R-01.

## Documentation (DOC)

**Strengths:** A fresh sweep for banned historical-narrative phrasing (`previously`, `used to`, `now uses`, etc.) across all policy/legal docs found nothing new. README's live-app link and command table are complete and accurate. `CHANGELOG.md` discipline remains selective and accurate, not mechanical. `docs/REQUIREMENTS.md`/`IMPLEMENTATION-PLAN.md` correctly self-declare their exemption from the as-built rule.

### F-DOC-01 — Terms of Service has the same stale account-deletion claim the Privacy Policy fix was scoped to leave behind · **Medium**

Same finding as F-UX-02; see that entry — `TD-PPpfid-26080302`'s fix explicitly scoped itself to the Privacy Policy page alone. **Direction:** Addressed by R-01.

### F-DOC-02 — `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md` describes a UI location ("account settings") that doesn't exist · **Low**

**Evidence:** Line 17 says the account-deletion route is "reachable from the app's account settings"; no settings route exists. The feature is the "Danger zone" section of the "My poems" dashboard, which the same document correctly names two paragraphs later.

**Impact:** Low, internal-only, but this is the document meant to be followed quickly and correctly under a live privacy request.

**Direction:** Addressed by R-11 (bundled).

## Governance and project health (GOV)

**Strengths:** Issue/PR triage is fast and issue accumulation is essentially zero. The tech-debt register is demonstrably consistent (75 of 77 pre-existing items resolved) and is the mechanism actually driving remediation, not a passive log. When the automated pipeline hit a genuinely ambiguous state, it escalated with a careful, evidenced account rather than guessing — the correct failure mode for a disclosed single-maintainer, multi-agent project. `docs/IMPLEMENTATION-PLAN.md`'s W-series is largely current (two staleness exceptions covered in F-ARCH-01). The CODEOWNERS two-account arrangement is a documented, intentional single-maintainer setup, not an oversight, and is not treated as a finding.

### F-GOV-01 — The orphan-branch sweeper's "resume orphaned branch" recovery has no check for whether the underlying work already landed by another route — illustrated twice, not once · **Medium**

**Evidence:** Two independent, concurrent live instances in the review window: PR #223 (recovering a branch whose intended register-flip partly landed via merged PR #225, leaving #223 conflicting on the exact file, plus a second hunk PR #225 deliberately declined) and PR #229 (resurrecting a branch for `TD-PPpfid-26072401`, which was already resolved on `main` a week before, via PR #146). `scripts/sweep-orphan-branches.sh` resurrects a branch purely from "no open PR exists," without checking whether the underlying work is already superseded on `main`.

**Impact:** Not a one-off — the same structural gap fired twice within the review window, each time consuming two escalation issues, a stuck draft PR, and real maintainer toil. The pipeline's own handling was correct (it escalated rather than guessed), but the underlying cause is mechanical and will recur. This script does not live in the `poetic-fiddle` repository — it is external pipeline/orchestration infrastructure — so the fix is a cross-repo process recommendation, not a `poetic-fiddle` code change; no tech-debt item is filed in this repo's register for it (see `03-recommendations.md` R-04 for why).

**Direction:** Addressed by R-04 (no tech-debt item — see R-04's note).

### F-GOV-04 — A clean, mergeable Dependabot PR (#170) has sat unmerged 7+ days · **Low**

Same finding as F-DEPS-02/F-CI-03; see those entries. **Direction:** Addressed by R-05.

## Observability and operations (OPS)

**Strengths:** `td-tooling-drift.yml` and `supabase-auth-drift.yml` both file deduplicated issues on drift, confirmed by direct reading. `check-supabase-auth-drift.mjs` is defence-in-depth engineered (asserts rather than pushes, strips its own access token from issue bodies even though Actions already masks it). `supabase-fetch.ts`'s timeout/retry design correctly distinguishes idempotent-read retry from non-idempotent-write no-retry. `docs/TRIAGE.md` accurately documents the one class of failure that escapes Sentry's hooks, with a concrete worked example.

### F-OPS-01 — Backup restore is documented but not evidenced as ever having been drilled · **Low** (informational)

**Evidence:** `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md`'s "Backup / PITR coverage" section documents the mechanism and current coverage in precise, dated detail, but nothing records an actual restore having been exercised.

**Impact:** Very low — the restore path is entirely Supabase-managed infrastructure this project could not drill without risking downtime on its only environment.

**Direction:** No action recommended; not worth a tech-debt item at this project's stage.

## Data handling and privacy (DATA)

**Strengths:** Data minimisation holds at the schema level — real PII lives entirely in Supabase's managed `auth.users`. `src/app/privacy/page.tsx`'s "What we collect" section is itemised and accurate. No real personal data anywhere in the repository (git grep swept, pgTAP fixtures are synthetic). Sentry's data-minimisation code (`sendDefaultPii: false`, payload scrubbing/truncation) is unchanged and genuine, not merely a policy claim. Both prior reviews' DATA gaps (no export mechanism, no documented backup/restore) are now closed — `scripts/export-poet-data.mjs` and `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md`'s dated, sourced backup/PITR facts.

No findings this dimension beyond the informational backup-drill note recorded once, from the OPS angle, as F-OPS-01 (not duplicated here).
