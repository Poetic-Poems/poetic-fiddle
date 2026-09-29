# Project review — Poetic Fiddle

**Date:** 2026-09-28 · **Reviewer:** Claude (project-review skill) · **Revision reviewed:** `0ae07cc0a30a8112427a3c0d597fa67a00244732` (`main`)

Poetic Fiddle remains in good health: no Critical or High-severity finding surfaced across any of the 13 dimensions, security fundamentals (auth, RLS, CSP, sanitisation, secrets) are unusually rigorous for a project this size, and 584/584 tests pass with 90.46% coverage. The single most important thing to act on: production has run with no live Supabase backend since 2026-09-19 — sign-in, save and share are down for real users, handled gracefully but with no visible restoration plan, and two of the project's own docs haven't fully caught up with that fact.

## Contents

| Document | What it contains |
|---|---|
| [Summary](01-summary.md) | What the project is, its overall health, headline strengths and risks, and this review's scope and method. |
| [Findings](02-findings.md) | 19 findings across all 13 dimensions: 0 critical, 0 high, 5 medium, 14 low. |
| [Recommendations](03-recommendations.md) | 7 prioritised recommendations; every Medium finding is covered, and two are already fully specified by existing escalation issues rather than duplicated. |
| [Improvement prompts](04-improvement-prompts.md) | 7 self-contained, ready-to-paste AI agent prompts, one per recommendation, in priority order. |
| [Tech debt filed](https://github.com/Poetic-Poems/poetic-fiddle/issues?q=is%3Aissue+label%3Apw%3A%3Atype%3Atech-debt) | 6 new issues filed this pass (#447–#452), one per new recommendation; R-02's two items were already covered by existing issues #432 and #437, so no duplicate was filed. `TECH-DEBT.md` (a frozen historical archive) was not touched — no archived item resolved this pass. |

No supplementary annexes were warranted this pass — no dimension had enough distinct material to justify one.
