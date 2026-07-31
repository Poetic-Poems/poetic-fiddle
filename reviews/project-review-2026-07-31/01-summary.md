# Summary

## What this project is

Poetic Fiddle is a Next.js (App Router) + TypeScript web editor for the `.poem` format, giving non-technical poets a CodeMirror-based editor with a live HTML preview, anonymous localStorage drafts, and Supabase-backed accounts, save, share, and remix. It consumes its rendering logic from the separate `poetic` npm package (pinned to a tag-tarball release with a locked integrity hash) rather than forking it, per the project's own single-source-of-truth rule.

The codebase is small (~7,500 lines across `src/lib` and `src/components`, 46 non-test files) and unusually mature for its size: the MVP (M7) shipped, and the project is now in M8/M9 non-functional hardening. It is built and operated almost entirely by AI agents under a solo human maintainer (disclosed as such in `CLAUDE.md`), coordinated through a formal `TECH-DEBT.md` register with its own claiming protocol and CI-enforced consistency guard.

## Overall assessment

This is a well-run project in genuinely good health. Since the previous review (2026-07-23), roughly 30 pull requests landed addressing all seven of that review's High-severity findings, and this pass independently re-verified — not just re-read the commit log for — the ones that matter most: branch protection was queried live via `gh api` and does now require the `CI` and `commit-format` checks; the tech-debt Ledger's internal consistency was checked by actually running `scripts/td-check.pl`; the sanitisation and CSP configuration was read line-by-line and found not just duplicated-but-consistent. No Critical finding and no new High-severity application-code finding was found in this pass.

The one High finding is a governance gap, and it is a telling one: the project's own tech-debt-register CI guard — built specifically to stop a class of silent drift — is not wired into branch protection as a required check, so it can fail red without blocking a merge. This is compounded by a related, structural Medium finding: nothing yet ensures that *future* new workflows get wired into required checks either, and a second instance of a closely related pattern (`td-tooling-drift.yml`'s vendored tooling having already drifted from its own upstream, unnoticed since the very PR that refreshed it) surfaced independently in a different dimension. Taken together, these three findings describe one theme worth the maintainer's attention: the project has built real, good automated guards against silent drift, but hasn't yet finished checking that the guards themselves stay wired up and current.

Everything else found is Low-severity polish: a genuine accessibility gap in the newer delete-confirmation flow (no focus management, no Escape-to-dismiss — Medium, the other real defect this pass found), some documentation drift following a recent refactor, a handful of small dependency/tooling enforcement gaps, and code-duplication findings that echo (without reopening) issues the previous review already flagged and PRs partially, not fully, resolved.

## Headline strengths

- **Security engineering holds up under a second, more skeptical pass.** RLS is default-deny with a real pgTAP suite proving `42501` denials, not just empty results; DOMPurify configs on both sanitisation boundaries were checked byte-for-byte and found consistent, not merely duplicated; CSP was read in full and found correctly wired.
- **Test discipline is real, not just a high pass count.** 248/248 tests pass across 35 files with zero snapshot tests; the riskiest paths (sanitisation, permission-sensitive mutations) are tested against real rendered output, not hand-typed fixtures.
- **CI design is unusually sophisticated for a project this size** — the conditional-job-plus-always-green-gate pattern correctly solves GitHub's documented skipped-but-required-check problem, and fails safe on unclassified diffs.
- **Documentation genuinely follows its own stated rules.** A systematic sweep for banned historical-narrative phrasing found nothing beyond two already-tracked instances; CHANGELOG discipline is selective (correctly omitting entries for two recent patch-level PRs), not mechanical.
- **The tech-debt register is a working system, not aspirational paperwork** — its consistency invariant was verified by direct tool execution, and its claiming workflow matches actual branch/PR history exactly.
- **Data minimisation is enforced at the schema level, not just by policy statement**, and Sentry's PII scrubbing goes beyond "poem content isn't attached" to guard against it arriving by accident.

## Headline risks

- The tech-debt register's own CI consistency guard is not a required status check, so it can fail without blocking a merge [F-CI-01].
- Nothing yet enforces that a newly added workflow gets wired into required checks — the exact gap that produced the finding above [F-CI-02], and echoed independently by a second drifted guard [F-GOV-01].
- The delete-poem confirmation added since the last review has no focus management or keyboard dismissal — the one concrete accessibility regression risk this pass found [F-UX-01].
- Recent refactors (`use-poem-persistence.ts`) moved rather than resolved a previously-flagged complexity concern, and introduced a small duplicated data-mutation block [F-ARCH-01, F-CODE-01].
- A previously-"resolved" duplication finding (page headers) has quietly grown from three files to six because the fix that landed was narrower than the finding it closed [F-CODE-02].

## Scope and method

**Exhaustive, not sampled**, for: `src/lib/`, `src/components/`, `src/app/` (every route/page), `supabase/migrations/` and `supabase/tests/rls_test.sql`, all seven `.github/workflows/*.yml`, `TECH-DEBT.md`, `CLAUDE.md`, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, and every file under `docs/`. Six dimension pairs were reviewed in parallel by separate subagents, each given the project map, the relevant checklist sections, and the current `TECH-DEBT.md` state, with instructions to cross-reference rather than duplicate already-tracked debt.

**Automated tools run:** `npm run lint`, `npm run typecheck`, `npm run format:check` (all clean), `npm test` (248/248 pass, 35 files), `npm audit` (9 high-severity advisories, all one dev-tooling chain — see F-SEC-01/F-DEPS-01). `gh api` was used to query the live branch-protection ruleset directly, rather than trusting documentation. `scripts/td-check.pl` was run directly to verify the tech-debt Ledger's consistency invariant. The vendored tech-debt tooling scripts were diffed directly against `Poetic-Poems/poetic`'s current `main`.

**Not run:** `supabase test db` (the pgTAP suite) — no `supabase` CLI or Docker binary was available in this review's sandbox. This is a review-environment limitation, not a project defect: `.github/workflows/ci.yml`'s data-layer job runs the same suite in CI on every relevant PR, and it is part of the required `CI` gate. No automated accessibility checker (axe/pa11y) was available either — UX findings rest on manual markup/ARIA reading plus the repository's own `contrast.test.ts`, which computes real WCAG ratios from literal token values rather than estimating them; this gap is itself tracked as TD26072435.

**Inapplicable dimensions:** none. Internationalisation (part of UX) was judged an apparent deliberate single-locale design choice for the project's current stage, recorded explicitly rather than left silent.
