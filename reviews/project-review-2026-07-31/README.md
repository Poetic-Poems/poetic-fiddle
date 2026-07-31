# Project review — poetic-fiddle

**Date:** 2026-07-31 · **Reviewer:** Claude (project-review skill) · **Revision reviewed:** e4738c9b746f8b958f3dd6ce97e9144c56d7d055 (main)

Poetic Fiddle remains a well-run, small Next.js/TypeScript poem editor in genuinely good health five weeks after its first full review: roughly 30 pull requests landed in that window, resolving all seven of that review's High-severity findings, independently re-verified here rather than assumed from the commit log (branch protection re-queried live via `gh api`, the tech-debt Ledger's consistency invariant re-checked by actually running `scripts/td-check.pl`, sanitisation configs re-read line-by-line and confirmed consistent, not just duplicated). No Critical finding and no new High-severity application-code finding turned up this pass. The single most important thing to act on is the one High finding: the project's own tech-debt-register CI guard — built specifically to catch a class of silent drift — is not wired into branch protection as a required check, so it can currently fail red without blocking a merge; two related Medium findings (nothing yet stops a *future* workflow shipping with the same gap, and a second guard of the same shape has already drifted unnoticed) point at the same underlying theme — see `03-recommendations.md` R-01 through R-05.

## Contents

| Document | What it contains |
|---|---|
| [Summary](01-summary.md) | What the project is, its overall health, headline strengths and risks, and the review's scope and method. |
| [Findings](02-findings.md) | 31 findings across all 13 review dimensions: 0 critical, 1 high, 5 medium, 25 low. |
| [Recommendations](03-recommendations.md) | 15 prioritised recommendations, both High/Medium findings covered, ordered by severity then effort. |
| [Improvement prompts](04-improvement-prompts.md) | One self-contained AI-agent prompt per recommendation, ready to paste into a fresh agent session. |
| [Tech debt register](../../TECH-DEBT.md) | Updated in place: seven new items (TD26080101–TD26080107) filed for findings without an existing home; five existing open items enriched with this review's new evidence. See the Review provenance table there for the recommendation ↔ ledger-ID mapping. |

The recommendations and improvement prompts feed the implementation pipeline's `tech-debt` source and the `project-remediation` skill.
