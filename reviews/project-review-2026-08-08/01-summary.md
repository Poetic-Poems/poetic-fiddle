# Summary

## What this project is

Poetic Fiddle is a Next.js (App Router) + TypeScript web editor for the
`.poem` format, giving non-technical poets a CodeMirror-based editor with a
live in-browser HTML preview, anonymous localStorage drafts, and
Supabase-backed accounts, save, share, and remix. It consumes its rendering
logic from the separate `poetic` npm package (pinned to a tag-tarball
release with a locked integrity hash) rather than forking it, per the
project's own single-source-of-truth rule.

The codebase is small (~4,700 non-test lines / ~9,800 including tests, 47
test files) and unusually mature for its size: the MVP (M7) shipped
2026-07-18, and the project is now in M8/M9 non-functional hardening. It is
built and operated almost entirely by AI agents under a solo human
maintainer (disclosed as such in `CLAUDE.md`), coordinated through a formal
`TECH-DEBT.md` register with its own claiming protocol and CI-enforced
consistency guard.

## Overall assessment

This is a well-run project in genuinely good health, and it has kept that
health under sustained velocity: roughly 30 pull requests landed since the
previous review (2026-07-31) alone, and this pass independently re-verified
— not just re-read the tech-debt ledger for — the claims that mattered most.
Branch protection was queried live via `gh api` and does require the `CI`,
`register`, and `commit-format` checks. `npm run coverage` was actually run
(88.97% statements, 454/454 tests passing across 47 files) rather than
estimated. `perl scripts/td-check.pl` confirmed the tech-debt register's own
consistency invariant, both before this review's additions and after. No
Critical or High-severity finding surfaced in this pass, and every High/
Medium finding from the two prior reviews checked out as genuinely resolved
under fresh, direct reading of the current code — not merely trusted from
the register's own claim.

What this pass found instead is a smaller, more interesting pattern: two
concrete Medium-severity code/content gaps (a stale legal-copy contradiction
between the Terms and Privacy pages; two untested paths on
security-adjacent code), and — more structurally — the project's first
directly observed instance of its own concurrent-multi-agent tooling racing
against itself. Two open GitHub issues (#224, #228) and three pull requests
record a near-miss: two autonomous pipeline cycles tried to flip the same
tech-debt records at once, one half landed cleanly and the other half got
stuck behind a stale, wrongly-resurrected draft PR — and the identical shape
of problem recurred a second time in the same day on a different item
(PR #229). The pipeline handled both correctly (it escalated to the human
maintainer rather than guessing), which is itself evidence the project's
process is sound — but the underlying mechanical gap in the orphan-branch
recovery tooling will keep producing this cost until it's fixed.

Everything else found is Low-severity polish: two organisational
recommendations from the previous review (a duplicated page-header pattern,
a components/lib boundary crossing) that were never converted into tracked
tech-debt items and so quietly dropped off the register between reviews; a
dormant release/tagging process against a month of continuous production
deployment; a monitoring gap in the Supabase auth-drift check; and a handful
of small accessibility-test, dependency-hygiene, and documentation-accuracy
gaps.

## Headline strengths

- **Security engineering continues to hold up under a third, still-skeptical pass.** No secrets found anywhere in the working tree or full git history; CSP, sanitisation, and RLS-bypass boundaries were all read directly and found correctly wired, not merely re-cited from the tech-debt ledger.
- **Test discipline is real and has grown, not just held steady.** 454/454 tests pass (up from 248 at the last review), coverage was actually measured (not estimated) at 88.97% statements, and the riskiest paths — sanitisation, permission-sensitive mutations, the cross-package renderer seam — are tested against real rendered output at multiple independent layers.
- **CI/governance guards that were the previous review's headline gap are now demonstrably closed, verified live.** Branch protection was queried via `gh api`, not read from a YAML comment; the tech-debt register's own consistency check is a required status check, and a new `workflow-wiring` job programmatically guards against future jobs slipping outside that net.
- **The project's tooling has begun checking itself, and did so successfully during this review window.** Two independent drift guards (`td-tooling-drift.yml`, `supabase-auth-drift.yml`) both now file deduplicated issues on failure and were confirmed doing exactly that.
- **When automation hit a genuinely ambiguous state, it escalated correctly rather than guessing** — the register-hygiene incident (F-GOV-01) is a real process gap, but the pipeline's own response to it (a careful, evidenced written account to the human maintainer) is exactly the right failure mode for a disclosed single-maintainer, multi-agent project.
- **Data handling and privacy are fully built out**, not merely policy statements: self-service account deletion, a maintainer-run data-export script, and a documented, dated backup/PITR posture all shipped and were independently verified this pass.

## Headline risks

- Two independent instances of the same structural gap in the orphan-branch-recovery tooling raced against the tech-debt register within the review window, each costing real escalation and maintainer toil — a genuine, currently-unmitigated risk, not a one-off [F-GOV-01].
- The Terms of Service page still tells poets account deletion requires emailing the maintainer, directly contradicting the Privacy Policy and the self-service deletion flow already shipped — on the one page whose purpose is explaining account termination, for an audience of non-technical poets [F-UX-02, F-DOC-01].
- Two security-adjacent code paths — the public share page's render-failure fallback, and the sole code path capable of bypassing row-level security — have no real-implementation test coverage, verified by direct measurement rather than assumption [F-TEST-01, F-TEST-02].
- The project's own release/tagging mechanism has been dormant for a month against ~180 commits of continuously-deployed production work, leaving no documented rollback anchor closer than the pre-MVP scaffold [F-CI-01].
- Two Low-severity organisational recommendations from the previous review were never converted into tracked tech-debt items and so silently dropped, despite their affected code being touched again since — a small gap in an otherwise disciplined register's own follow-through [F-ARCH-02, F-CODE-01].

## Scope and method

**Exhaustive** for: `src/lib/`, `src/components/`, `src/app/` (every route),
`src/proxy.ts`, `src/instrumentation.ts`, all ten `.github/workflows/*.yml`,
`TECH-DEBT.md`, `CLAUDE.md`, `README.md`, `SECURITY.md`, every file under
`docs/`, and both prior review folders (for continuity, not re-review).
**Sampled**: the ~700-package transitive dependency tree (via `npm ls`,
`npm outdated`, a full `license-checker` scan, and `npm audit`, rather than
package-by-package reading); `tech-debt/*.md` bodies (77 items — frontmatter
status checked for all, full bodies read for the 2 pre-existing open items
and a representative sample of resolved ones); GitHub issue/PR history
(current open set plus the last ~15-20 closed/merged items, not full
repository history). Six subagents, each covering a pair or trio of
dimensions, worked in parallel against the same project map and were
instructed to verify prior findings' fixes by reading current code directly
rather than trusting the tech-debt ledger's own claim, and to cross-check
each other's territory (e.g. UX and DOC both independently found the same
Terms-of-Service defect from different angles — consolidated, not
double-counted, in the findings and recommendations).

**Automated tools run:** `npm ci --engine-strict=false` (this review's
sandbox has Node v26.5.1; the project pins `22.x` via `engine-strict=true` —
a sandbox limitation, not a project defect; the project's own CI installs
the exact pinned version) — clean install, 0 vulnerabilities in the bundled
audit. `npm run lint`/`typecheck`/`format:check` — all clean. `npm test` —
454/454 passed, 47 files. `npm run coverage` — 88.97%/82.46%/90.26%/90.85%
stmt/branch/func/line, real numbers reported in `02-findings.md`. `npm run
build` — succeeded, all routes compiled. `gh api`/`gh run list`/`gh pr
list`/`gh issue list` — used throughout to verify live GitHub state (branch
protection, CI history, PR/issue triage) rather than trusting documentation.
A full `license-checker` scan and targeted `git log --all -p`/`git grep`
secret sweeps were also run.

**Not run:** `npm run test:db` (the pgTAP suite) — no `supabase`/`docker`
CLI in this review's sandbox; read instead. `npm run test:a11y`
(Playwright/axe against a real browser) — no browser binaries pre-installed,
and installing them was judged disproportionate for a read-only review pass;
`e2e/a11y.spec.ts` was read instead, and the project's own CI runs it as
part of the required gate on every relevant PR. Both are review-environment
limitations, not project defects, and match the limitation the 2026-07-31
review recorded for the same reasons.

**Inapplicable dimensions:** none. Internationalisation (part of UX) was
re-confirmed, by direct grep for i18n scaffolding, to be a deliberate
single-locale design choice at this project's current stage, not a
silently-abandoned half-build — consistent with both prior reviews'
judgement.
