# Project review — Poetic Fiddle

**Date:** 2026-08-08 · **Reviewer:** Claude (project-review skill) · **Revision reviewed:** `99327a7c5283c1a88b64fb4b5441ef098537847e` (`main`)

Poetic Fiddle is a well-run, small Next.js/TypeScript `.poem` editor in
genuinely good health: no Critical or High-severity finding surfaced this
pass, every High/Medium finding from the two prior reviews checked out as
resolved under fresh direct reading (not just trusted from the tech-debt
ledger), and test/coverage discipline has grown since the last review
(454/454 tests, 88.97% statement coverage, both independently measured).
The single most important thing to act on: this review directly observed the
project's own concurrent-multi-agent tooling racing against itself twice in
one day (a stuck, wrongly-resurrected pull request and a stale tech-debt
flip attempt) — the pipeline escalated both correctly rather than guessing,
but the underlying mechanical gap in the orphan-branch recovery tooling will
keep costing real toil until it's fixed (R-04).

## Contents

| Document | What it contains |
|---|---|
| [Summary](01-summary.md) | What the project is, its overall health, headline strengths and risks, and this review's scope and method. |
| [Findings](02-findings.md) | 25 findings across all 13 dimensions: 0 critical, 0 high, 6 medium, 19 low. |
| [Recommendations](03-recommendations.md) | 12 prioritised recommendations, every Medium finding covered; a handful of Low/informational findings deliberately have none, with the reasoning recorded. |
| [Improvement prompts](04-improvement-prompts.md) | 12 self-contained, ready-to-paste AI agent prompts, one per recommendation, in priority order. |
| [Tech debt register](../../TECH-DEBT.md) | Updated in place: 11 new items filed (`tech-debt/TD-PPpfid-26080901.md` through `...911.md`), all `status: open`, each cross-referencing the recommendation it mirrors. One recommendation (R-04) deliberately has no register item — see its entry in `03-recommendations.md` for why. |

No supplementary annexes were warranted this pass — no dimension had enough
distinct material to justify one.
