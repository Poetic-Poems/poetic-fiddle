# Findings

This review re-examined `poetic-fiddle` five weeks after its first full review (2026-07-23), across ~30 merged pull requests. Most findings below are new — the previous review's High-severity items are, with one exception, verifiably resolved (checked against `TECH-DEBT.md`'s Ledger and, where practical, against the live artefact: a fresh `gh api` query of the branch-protection ruleset, a direct diff against `poetic`'s upstream tooling, a hand-run of `scripts/td-check.pl`). No Critical or new High-severity findings were surfaced in application code; the one High finding is a process gap in the project's own CI-governance layer.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 5 |
| Low | 25 |

## Architecture and design (ARCH)

**Strengths:** The `app/` → `components/` → `lib/` layering is real and consistently followed. The `poetic` package boundary is genuinely treated as a black box — exactly three files import from it, all through one ambient shim, with generated CSS as the only vendored artefact. PR #144's extraction of `use-poem-persistence.ts` is a real architectural win: `Editor.tsx` is now purely presentational (294 lines, no non-UI state), resolving the previous review's F-ARCH-02/F-CODE-01. The share-page/embed cross-tool seam is tested against real `poetic` output, not a hand-authored fixture; the one seam that still relies on a hand-authored fixture (`wireAnalysisToggles`) is already tracked as TD26072424 and was re-verified as still accurate, not re-filed.

### F-ARCH-01 — `use-poem-persistence.ts` relocated Editor.tsx's god-object risk rather than decomposing it · **Medium**

**Evidence:** `src/lib/use-poem-persistence.ts` is 395 lines and owns 15 `useState`/`useRef` hooks (lines 64–93), six independent async flows each with its own loading/error state pair, plus the render-time draft-migration state machine the previous review singled out (lines 160–182). It returns a single flat, ungrouped object of 24 fields (lines 368–394) with no exported return-type interface; `Editor.tsx` destructures all 24 by name.

**Impact:** Testability and presentation/logic separation are genuinely better than before (a dedicated 527-line test file, organised by concern), so this is a lower-severity echo of the earlier finding, not a reopening of it. But the concerns (draft-vs-account reconciliation, four Supabase write flows, session-migration) still live together in one module with no internal grouping — the next feature touching save/share/session (Phase 2a) will most plausibly extend this same flat hook rather than prompt a further split.

**Direction:** If a further concern is added, group the return value by concern (e.g. `{ save: {...}, share: {...} }`) rather than extending the flat shape. Addressed by R-04.

### F-ARCH-02 — Shared DOM-wiring logic lives in a component module rather than `lib/` · **Low**

**Evidence:** `wireAnalysisToggles` (`src/components/PoemPreview.tsx:18-63`) is pure DOM manipulation with no JSX/React dependency, yet lives in a `"use client"` component file; `src/components/SharedPoemView.tsx:4` imports it cross-component rather than from `lib/`, making it the one Fiddle-authored function shared between two rendering surfaces that sits outside the `lib/` layer used for everything else of this kind.

**Impact:** Minor — it works, and both call sites already document the coupling — but it's the one place a `components/` file depends on another `components/` file.

**Direction:** Move to `src/lib/` next time either caller is touched. Addressed by R-14.

## Code quality and maintainability (CODE)

**Strengths:** `npm run lint`/`typecheck`/`format:check` are all clean; a full-text sweep of `src/` found zero `any` escape hatches, zero `eslint-disable`/`@ts-ignore`, zero `TODO`/`FIXME`/`HACK` markers, zero stray `console.*` calls. The previous review's F-CODE-02 (auth errors bypassing the safe-message convention), F-CODE-03 (duplicated test mock boilerplate), and F-CODE-04 (duplicated `errorMessage` expression) are all verifiably fixed.

### F-CODE-01 — The "save if unsaved, then act" sub-pattern is copy-pasted between `handleShare` and `handleAllowRemixChange` · **Medium**

**Evidence:** `src/lib/use-poem-persistence.ts:253-263` and `:311-321` contain the same eight-line block verbatim except one variable name: check `poemId === null || hasUnsavedChanges`, call `savePoem(...)`, then update `poemId`/`savedSource` from the result.

**Impact:** This is data-mutation logic — the class of code the checklist flags as worth the most duplication scrutiny. It hasn't diverged yet, and both call sites are covered by dedicated tests, which lowers the risk, but a future fix to one flow's save-guard has no structural pressure to also reach the other.

**Direction:** Extract a small `ensureSaved()` helper both handlers call. Addressed by R-04.

### F-CODE-02 — The page-header JSX pattern the previous review flagged is now duplicated in more places than when it was first raised · **Low**

**Evidence:** The previous review's F-CODE-05 named three files sharing an inline `<h1>` + description-paragraph block. `TECH-DEBT.md` records this resolved via PR #148's `PageHeader.tsx` — but that component's props (`title`, `lastUpdated`) were shaped only for the three legal pages, which have a different header shape (no description paragraph). The original pattern is now duplicated, unextracted, across at least six files: `src/app/page.tsx:8-13`, `src/app/poems/[id]/page.tsx:14-19`, `src/app/poems/page.tsx:7-12`, `src/app/remix/[share_id]/page.tsx:41-50`, `src/app/share/[share_id]/not-found.tsx:6-11`, `src/app/remix/[share_id]/not-found.tsx:6-11`.

**Impact:** Cosmetic today, but the "fourth file" threshold the previous review set as its own trigger has been passed several times over. A future visual change now needs six synchronised edits.

**Direction:** Extract a second, simpler `PageHeader`-style component for this pattern. Addressed by R-13.

### F-CODE-03 — Two incompatible idioms model the same "loading / loaded / error" shape · **Low**

**Evidence:** `src/components/PoemsDashboard.tsx:16-24` models its async loads as discriminated unions; `src/lib/use-poem-persistence.ts` instead uses independent boolean/string pairs (`saving`/`saveError`, etc.) for the same shape of state, so an unintended combination (e.g. `saving === true` and `saveError !== null`) is representable even though never intended.

**Impact:** Low risk in practice (both files are well tested and currently consistent), but a reader moving between the two files holds two different mental models for the same kind of state.

**Direction:** If `use-poem-persistence.ts` is next restructured (see F-ARCH-01), migrate to the discriminated-union shape. Addressed by R-13.

## Security (SEC)

**Strengths:** RLS is default-deny and precisely scoped, with an explicit `revoke all` before every `grant`; the pgTAP suite proves cross-user access is refused with `42501`, not just empty results, and covers share-id immutability, `updated_at` tamper-resistance, and cascade deletes. Sanitisation defense-in-depth is real and verified *consistent*, not merely duplicated: the live-preview and share-page DOMPurify configs both run the unmodified default allow-list, with no config-level drift. The embed-host allow-list (TD26072601's "three places") currently agrees across all three copies. CSP is correctly wired — fresh per-request nonce, no `unsafe-inline`/`unsafe-eval` on script/style, `object-src 'none'`, `frame-ancestors 'none'` — with its one relaxation narrowly scoped and justified in-file. No secrets found anywhere in the working tree or git history.

### F-SEC-01 — `npm audit`'s 9 high-severity advisories all trace to one dev-tooling chain, already tracked · **Low**

**Evidence:** `eslint@9.39.5`'s own `minimatch@3.1.5` → `brace-expansion@1.1.16` (GHSA-mh99-v99m-4gvg, CVSS 7.5, range `<=5.0.7`) accounts for all 9 rows. Fixing it requires an ESLint major bump — the exact hold `TD26072429` already tracks.

**Impact:** Rated on real exploitability, not bare CVSS: this is ESLint's own dependency processing trusted local file globs at lint/CI time, not shipped to production or exposed to attacker input. GitHub's own Dependabot alert for this exact finding is `auto_dismissed` with `scope: development`.

**Direction:** No new action beyond TD26072429; new evidence for that item's remedy is in F-DEPS-01. Addressed by R-06.

### F-SEC-02 — No explicit `Referrer-Policy` / `X-Content-Type-Options` / `Permissions-Policy` header · **Low**

**Evidence:** `src/proxy.ts:14-20` sets only `x-nonce` and `Content-Security-Policy`; no `headers()` block in `next.config.ts` adds the others.

**Impact:** Largely mitigated already — `frame-ancestors 'none'` is a strict superset of `X-Frame-Options`, and current browsers default to `strict-origin-when-cross-origin`. `/share/[share_id]` URLs embed the share token itself, making an explicit `Referrer-Policy` a cheap closure of a currently-theoretical leak path.

**Direction:** Add both headers alongside CSP in `src/proxy.ts`. Addressed by R-07.

## Data handling and privacy (DATA)

**Strengths:** Data minimisation is enforced at the schema level — `profiles` stores nothing beyond `remix_default`; real PII lives entirely in Supabase's managed `auth.users`. Cascade deletes are FK-level and pgTAP-tested. The Privacy Policy accurately describes storage as live and names every processor with accurate scope; self-service poem deletion is fully wired end-to-end (resolving the previous review's F-DATA-01/F-DATA-02). No real personal data found anywhere in the repository; Sentry's PII minimisation (`sendDefaultPii: false`, `scrubEvent`) still holds.

### F-DATA-01 — Account-level data export has no mechanism at all, not merely no runbook · **Low**

**Evidence:** The Privacy Policy promises poets can "ask us to export or delete your data." Deletion is at least technically sound even though manual (FK `on delete cascade`, pgTAP-tested) — the gap there is purely the human runbook (TD26072433). Export is different in kind: no script, Admin-API call, or documented procedure anywhere exists to actually pull a poet's data out.

**Impact:** Proportionate to project stage (Low) — the worst case is a slow, ad hoc fulfilment of a rare request. Refines TD26072433's framing: it understates the export side, where the mechanism itself doesn't exist yet, not just its documentation.

**Direction:** Addressed by R-10.

## Testing and quality assurance (TEST)

**Strengths:** Near-1:1 test-to-source mapping; zero snapshot tests in 34 files. The riskiest paths are the best-tested: sanitisation tests run real `.poem` source with hostile fixtures through the real renderer, not hand-typed HTML; save/share/remix/delete mutations are covered for both happy paths and RLS-adjacent failure modes. Fake-timer discipline in the debounce tests is correct within each test. `vitest.setup.ts`'s four polyfills are each accompanied by a comment explaining the specific failure they prevent. Lint, typecheck, format-check, and test are all green together — 248/248 pass, 35 files.

### F-TEST-01 — The `.poem` CodeMirror tokenizer (`poem-syntax.ts`) has no test file at all · **Low**

**Evidence:** `src/lib/poem-syntax.ts` (145 lines) implements a hand-written token-stream state machine over ~15 ordered regex alternatives. No `poem-syntax.test.ts` or equivalent exists; `Editor.test.tsx` mocks `@uiw/react-codemirror` entirely.

**Impact:** Non-trivial, order-dependent logic — a misordered regex or unhandled state transition could silently mis-highlight or desync tokenizer state — completely unverified. Low rather than Medium because it degrades editing experience, not security or data integrity.

**Direction:** Add a focused unit test over `poemStreamParser.token` covering each branch and an adjacency case. Addressed by R-09.

### F-TEST-02 — No global teardown resets fake timers if a test throws mid-fake-timer block · **Low**

**Evidence:** `use-poem-persistence.test.ts`'s five fake-timer tests each call `vi.useFakeTimers()`/`vi.useRealTimers()` manually with no `afterEach` safety net anywhere.

**Impact:** Latent today (every assertion currently sits before the cleanup call), but a future failing `expect()` inserted mid-block would skip cleanup and leak fake timers into later tests in the same file — a confusing cascade from one genuine failure.

**Direction:** Add `afterEach(() => vi.useRealTimers())`. Addressed by R-09.

### F-TEST-03 — No coverage tool configured · **Low** · tracked as TD26072428

**Evidence:** No `test.coverage` block, no coverage devDependency, no `coverage` script. Unchanged from the prior review.

**Direction:** Addressed by R-09 (extends TD26072428).

### F-TEST-04 — No watch-mode test script · **Low** · tracked as TD26072428

**Evidence:** `package.json`'s only test script is single-shot `vitest run`.

**Direction:** Addressed by R-09 (extends TD26072428).

## Dependencies and supply chain (DEPS)

**Strengths:** 12 runtime dependencies, every one traceable to a concrete feature — no trivial or speculative additions. The `poetic` tag-pinned tarball dependency carries a real `sha512` integrity hash, so a compromised asset would fail `npm ci`'s check, not install silently. The `postcss`/`sharp` `overrides` are both real, well-documented CVE fixes, still needed today. Dependabot is configured and demonstrably active. The jsdom major-version hold (TD26071901) remains a model example of documenting a deliberate dependency hold.

### F-DEPS-01 — 9 high-severity `npm audit` findings, all through `eslint`'s own chain, with new evidence for the already-open hold · **Low**

**Evidence:** Same root cause as F-SEC-01. New evidence: an open Dependabot PR (#129, `eslint` 9→10) has a maintainer comment (2026-07-27) giving the specific blocker — `eslint-config-next@16.2.12` bundles `eslint-plugin-react@7.37.5`, which still calls the ESLint-10-removed `context.getFilename()` API, so CI's lint step fails; no newer `eslint-config-next` exists yet to fix it. The parallel `typescript` bump (closed PR #9) has no such comment — Dependabot auto-closed it with no human rationale recorded, so that half of TD26072429 is still genuinely undocumented.

**Impact:** Low, per F-SEC-01's reasoning — devDependency-only, not reachable from any deployed path.

**Direction:** Update TD26072429's body with the PR #129 root cause; re-trial or document the `typescript` hold. Addressed by R-06.

### F-DEPS-02 — `engines.node` (`22.x`) disagrees with a mismatched local Node version, and nothing enforces it · **Low**

**Evidence:** No `engine-strict=true` anywhere in `.npmrc`; `npm ci` on Node v26.5.0 completed with only an `EBADENGINE` warning.

**Impact:** Low and purely advisory — CI pins its own Node version independently, so nothing broken can merge. The gap is local-iteration drift.

**Direction:** Addressed by R-08.

## Tooling and developer experience (TOOL)

**Strengths:** `.editorconfig`/`.prettierrc`/`eslint.config.mjs` are committed and match what CI enforces. `.githooks/` is real and behaves as documented. The previously-flagged silent-env-var failure is verifiably fixed (`src/app/error.tsx` plus the module-scope guard in `supabase-client.ts`). README's "Local-only Supabase" section matches `supabase/config.toml` exactly.

### F-TOOL-01 — README/tooling polish gaps confirmed still open · **Low** · tracked as TD26072430

**Evidence:** README's Development table still omits `start`/`test:db`; no WSL mention outside the script's own header; `sync-poetic-css.mjs`'s `require.resolve` is still unguarded (reproduced directly — a missing export throws a raw `MODULE_NOT_FOUND`, no pointer to the pinned `poetic` version).

**Direction:** Addressed by R-11 (no change; TD26072430 already covers this exactly).

### F-TOOL-02 — No `engine-strict` in `.npmrc`; the Node pin is enforced only by CI, never locally · **Low**

**Evidence:** As F-DEPS-02.

**Direction:** Addressed by R-08.

### F-TOOL-03 — No devcontainer or docker-compose · not a defect, recorded per checklist instruction

Judged proportionate: the project's dependency surface is one pinned Node version plus the Supabase CLI's self-contained `supabase start`. Revisit if the contributor base grows.

### F-TOOL-04 — CI's build job has no dependency-vulnerability gate; entirely reliant on out-of-band Dependabot alerts · **Low**

**Evidence:** No `npm audit` step anywhere in `.github/workflows/*.yml`.

**Impact:** Low today, but the previous review found a case where Dependabot itself stayed silent on a live high-severity `next` issue — a CI-level gate is independent of whether Dependabot noticed.

**Direction:** Addressed by R-08.

## CI/CD and release engineering (CI)

**Strengths:** `ci.yml`'s conditional-job-plus-always-green-gate pattern correctly solves GitHub's documented skipped-but-required-check problem, and its deny-list diff classification fails safe. `commit-format.yml` correctly uses `pull_request`, never `pull_request_target`. Branch protection was verified directly via `gh api`, not inferred from docs: ruleset `18828479` requires 1 code-owner review, squash-only merges, `required_status_checks: [commit-format, CI]`, plus CodeQL and Copilot code-quality rules — confirming TD26072405 is durably fixed.

### F-CI-01 — `tech-debt-register.yml`'s consistency check runs but is not a required status check, so it can fail without blocking merge · **High**

**Evidence:** Ruleset `18828479`'s `required_status_checks` lists exactly `commit-format` and `CI` — `tech-debt-register.yml`'s `register` check (a separate workflow, confirmed via `gh pr view 152 --json statusCheckRollup`) is absent. Timeline: PR #111 added `commit-format`/`CI` to the ruleset (merged 2026-07-25, ruleset last updated 2026-07-26); PR #145 added `tech-debt-register.yml` on 2026-07-28, *after* the ruleset was last touched, and nothing has updated it since.

**Impact:** `TECH-DEBT.md`'s own text and the workflow's own comment claim this guard makes a desyncing PR "fail its own CI instead of landing quietly" — that claim is currently false. A PR that desyncs the Ledger from Current Items gets a red `register` check a code-owner can approve and merge anyway. This is exactly the drift the register's own design exists to prevent, one layer up.

**Direction:** Add `register` to the ruleset's required checks. Addressed by R-01.

### F-CI-02 — Nothing enforces that every new job/workflow gets wired into a required check · **Medium**

**Evidence:** `ci.yml`'s own header comment states the discipline ("adding a conditional job later means adding it to `ci`'s `needs` list") but nothing asserts it stays true. F-CI-01 is the concrete cross-workflow instance of the same gap already being missed in practice.

**Impact:** Latent within `ci.yml` itself today (its `needs` list is currently complete), but proven to bite one level up.

**Direction:** A small script parsing `.github/workflows/*.yml` and diffing against the ruleset's required checks, mirroring `tech-debt-register.yml`'s own "guard the register" pattern. Addressed by R-05.

### F-CI-03 — `td-tooling-drift.yml` has no issue-filing/dedup, unlike its sibling `check-poetic-release.yml` · **Low**

**Evidence:** `check-poetic-release.yml` files a GitHub issue with title-based dedup on detecting drift; `td-tooling-drift.yml` — same shape, same purpose — only `exit 1`s inside the run.

**Impact:** A failed scheduled run is discoverable only by checking the Actions tab, inconsistent with the project's own established pattern for this exact kind of check.

**Direction:** Addressed by R-03.

## Performance and scalability (PERF)

**Strengths:** The live-preview render and draft autosave are debounced behind one shared 200ms timer (PR #152), resolving the previous review's asymmetry. No N+1 query pattern in any reviewed data-access code; the one list query is matched by a composite index. `localStorage` draft storage can't grow unbounded (one fixed key, always overwritten). Outbound Supabase calls are uniformly time-bounded (12s) with retry semantics that correctly distinguish idempotent reads from non-idempotent writes.

### F-PERF-01 — No performance budget, Lighthouse/Web Vitals check, or documented rendering-cost ceiling · **Low**

**Evidence:** No `lighthouse`/`web-vitals`/`size-limit` reference anywhere. The preview `srcDoc` still rebuilds the full HTML on every debounced render tick.

**Impact:** Unlikely to be perceptible for short, human-typed documents at the debounce's worst-case rate. Reiterating the prior review's judgment: disproportionate tooling for this project's current size.

**Direction:** No action recommended now; no recommendation filed.

## Usability and accessibility (UX)

**Strengths:** PRs #101, #116, #99/#110, and #137 all independently re-verified as landing exactly as claimed (CodeMirror accessible name; visible share-page heading; AA contrast across tokens/syntax-highlight/status-text; 320px overflow fixes). The native `<dialog>` in `SignInPrompt.tsx` gets focus-trapping, Escape-to-close, and focus-return for free. Pending-state button feedback is broad and consistent for the primary Save/Share/Delete actions. No i18n framework exists — recorded explicitly as an apparently deliberate single-locale design choice, not a silent gap.

### F-UX-01 — Delete-poem confirmation has no focus management or keyboard (Escape) dismissal · **Medium**

**Evidence:** `src/components/PoemsDashboard.tsx:218-247`. Clicking "Delete" swaps the button out for a confirmation `<div>` at the same position — a different element, not a toggled attribute. Neither branch sets focus or registers an Escape handler; the delete test suite exercises only click-based flows.

**Impact:** Removing the focused element drops focus to `<body>` by default, so a keyboard or screen-reader user gets no indication the confirmation appeared. There is no Escape-to-cancel, unlike every other dismissible surface in the app. Both cancel and successful delete repeat the loss on the way back out. Destructive-action confirmations are exactly where a deliberate focus story matters most.

**Direction:** Move focus onto the confirmation (default: "Cancel"); add Escape-to-cancel; return focus to a sensible target on both exit paths. Addressed by R-02.

### F-UX-02 — Remix-related pending states share the already-tracked "disable-only" feedback gap · **Low** · tracked as TD26072431

**Evidence:** The remix-default checkbox and per-poem "Remixing this poem" select both disable while saving but render no accompanying text or status region — the same pattern TD26072431 already flags for `SignInPrompt.tsx`, on two further controls.

**Direction:** Addressed by R-15 (extends TD26072431).

## Documentation (DOC)

**Strengths:** The "as-built only" rule is genuinely followed, not just stated — a systematic grep for historical-narrative phrasing across every top-level doc found nothing beyond the two already-tracked instances below. CHANGELOG.md discipline is selective, not mechanical (correctly omitting entries for two recent patch-level PRs). The tech-debt claiming workflow matches actual branch/PR practice exactly. The local-only Supabase dev loop is accurate.

### F-DOC-01 — `docs/IMPLEMENTATION-PLAN.md`'s W9 item is stale: it says the takedown contact "is not published," but it has shipped · **Low**

**Evidence:** IMPLEMENTATION-PLAN.md's W9 entry still reads as open, but `src/app/privacy/page.tsx` and `src/app/aup/page.tsx` both already publish the takedown address (PR #138, merged 2026-07-27). Unlike W5/W7/W12 in the same list, W9 was never marked "— done."

**Impact:** Low, since IMPLEMENTATION-PLAN.md is a self-declared living doc — but an agent scanning the W-list for unclaimed work would read W9 as open and duplicate shipped work.

**Direction:** Addressed by R-12.

### F-DOC-02 — `docs/TRIAGE.md` and `docs/SENTRY-AGENT-ACCESS.md` still narrate rejected alternatives · **Low** · tracked as TD26072432

**Evidence:** Three "trialled and dropped/removed/abandoned" passages remain, unchanged since the prior review.

**Direction:** Addressed by R-12 (no new evidence beyond confirming still open).

### F-DOC-03 — README still never links the live app · **Low** · tracked as TD26072432

**Evidence:** No mention of the live URL anywhere in README, despite CHANGELOG.md documenting it as deployed.

**Direction:** Addressed by R-12 (no new evidence beyond confirming still open).

### F-DOC-04 — `src/lib/revalidate-share.ts`'s doc comment names the wrong file and undercounts its call sites · **Low**

**Evidence:** The comment says "the three call sites in Editor.tsx"; after PR #144's extraction the actual call sites are in `use-poem-persistence.ts` (three) and `PoemsDashboard.tsx` (one, added by PR #124) — four, not three, and not in `Editor.tsx`.

**Impact:** Comment-only; direct inspection confirms all four call sites still follow the documented pattern correctly.

**Direction:** Addressed by R-12.

## Governance and project health (GOV)

**Strengths:** `scripts/td-check.pl`, run directly against the working tree, confirms the tech-debt Ledger's consistency invariant genuinely holds (16 open rows, each with exactly one Current Items body). Branch protection matches CLAUDE.md's own description, verified via direct API query. CONTRIBUTING.md and the PR template match observed practice across the last 15 merged PRs. Licence hygiene is clean.

### F-GOV-01 — `td-tooling-drift.yml`'s vendored copies have already drifted from `Poetic-Poems/poetic` main, and the guard has not run since · **Medium**

**Evidence:** Diffing the vendored scripts against poetic's current main: `get-tech-debt-record.pl`, `next-tech-debt-id.pl`, and `td-check.pl` all differ substantively (poetic now supports an adaptive per-item register format alongside the legacy one; this repo's copies are legacy-only). Only `drop-sections.pl` matches. `td-tooling-drift.yml`'s last two runs (2026-07-20, 2026-07-27) both predate PR #145 (merged 2026-07-28), which introduced the scripts' current versions — no run has exercised the guard against what's actually vendored today.

**Impact:** The guard exists specifically to notice this class of drift "instead of festering" — but at the moment of its reintroduction it is already blind to real, current drift. Doesn't threaten this repo's own tooling (the legacy-format functions still work correctly here), but the "does the guard work" property was unverified until this review's direct diff.

**Direction:** Trigger the workflow to confirm it now fails as expected, then re-sync the three drifted scripts. Addressed by R-03.

### F-GOV-02 — CONTRIBUTING.md's "reach out to the maintainers" (plural) is inconsistent with the disclosed single-maintainer reality · **Low**

**Evidence:** CONTRIBUTING.md says "maintainers"; CLAUDE.md's Governance section states the two CODEOWNERS accounts belong to one person.

**Impact:** Very minor — boilerplate phrasing, not a substantive claim.

**Direction:** Change to singular next time the file is touched; not worth a dedicated PR. No recommendation filed.

## Observability and operations (OPS)

**Strengths:** No client-side Sentry collection exists, confirmed by absence, not just doc claim. Every deliberate-swallow point in the codebase (`revalidateSharedPoem`'s four call sites) is verified, by exhaustive grep, to route through `reportSwallowedError` internally — TD26072413's fix has held and been correctly extended to the delete-poem feature and the persistence-hook refactor. The Supabase-call timeout fix documents genuinely careful reasoning about postgrest-js's own retry semantics. Data minimisation in Sentry event scrubbing goes beyond "poem content is never attached" — it also guards against poem content arriving by accident.

### F-OPS-01 — No documented backup/restore or export/delete runbook, and no in-app admin tooling exists either · **Low** · tracked as TD26072433

**Evidence:** `SUPABASE_SERVICE_ROLE_KEY` is deliberately unset; no code path uses it. The only way to fulfil an export/delete/restore request today is a maintainer using the Supabase dashboard directly — no repo-side script or audit trail.

**Direction:** Addressed by R-10 (sharpens TD26072433's framing).

### F-OPS-02 — Cross-reference: the stale swallow-point comment (F-DOC-04) sits in this dimension's code path · **Low**

Filed under DOC since it's a documentation-accuracy defect; the *behaviour* it describes was independently verified correct here. Addressed by R-12.
