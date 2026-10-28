# Project review — Poetic Fiddle

**Date:** 2026-10-27 · **Reviewer:** the project-review skill · **Revision reviewed:** `f08427aad9f2deb5e4a8bfca63cbf2371cfac118` (`main`)

Poetic Fiddle remains well-engineered for its size — architecture, code quality, security fundamentals, test design, and observability are all unusually strong for a single-maintainer MVP — but it is currently in a rough operational moment on two unrelated fronts: production has no live backend at all (a disclosed, deliberate cost decision, not a new incident, but a real one — sign-in, save, share, and remix are all non-functional for real users), and `main` has been frozen for 9 days by a structural flaw in the required dependency-audit CI gate that gridlocks the whole repository whenever two or more packages carry advisories at once. Both are already being worked by the project's own pipeline, with an immediate fix for the live advisory set green and ready to merge; the single most important thing to act on is prioritising the *durable* fix for the audit-gate design (issue #542), not just the immediate patch, so the same gridlock doesn't recur on the next overlapping advisory.

## Contents

| Document | What it contains |
|---|---|
| [Summary](01-summary.md) | What the project is, its overall health, headline strengths and risks, and this review's scope and method. |
| [Findings](02-findings.md) | 31 findings across all 13 dimensions: 2 critical, 1 high, 7 medium, 21 low (plus 3 informational/strength notes not included in that tally). |
| [Recommendations](03-recommendations.md) | 11 prioritised recommendations; both Critical findings and the one High finding are covered. |
| [Improvement prompts](04-improvement-prompts.md) | 11 self-contained, ready-to-paste AI agent prompts, one per recommendation, in priority order. |
| [Tech debt filed](https://github.com/Poetic-Poems/poetic-fiddle/issues?q=is%3Aissue+label%3Apw%3A%3Atype%3Atech-debt) | 9 new issues filed this pass (#548–#556), one per recommendation not already tracked elsewhere. R-01's Critical finding and R-06's stalled-PR finding were not filed as new debt — both are already tracked in depth by existing issues (#538/#539/#541/#542/#544 and #485 respectively). `tech-debt/` (a frozen historical archive) was not touched — no archived item was found resolved this pass. |

No supplementary annexes were warranted this pass — no single dimension had enough distinct additional material to justify one.
