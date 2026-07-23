# Project review — poetic-fiddle

**Date:** 2026-07-23 · **Reviewer:** Claude (project-review skill) · **Revision reviewed:** c81b2940b112fe7c87f55c000342fbf1613abbe3 (main)

Poetic Fiddle is a small, well-engineered Next.js/TypeScript poem editor with
a genuinely strong security and testing foundation — default-deny RLS backed
by an adversarial pgTAP suite, defense-in-depth XSS handling on every
untrusted-content boundary, and disciplined, near-fully-tested code. The
single most important thing to act on is not any one code defect but a
pattern of quiet drift between what the project's own documentation claims
and what's actually true: branch protection doesn't require CI to pass
despite CLAUDE.md saying it does, the Privacy Policy says poem storage isn't
live when it's been in production for some time, and CLAUDE.md's own Status
section undersells what's built — see `03-recommendations.md` R-01 through
R-06 for the seven High-severity items (including one real, reachable
security patch: `next` is one version behind on advisories affecting Server
Actions this app actually uses) that should be addressed first.

## Contents

| Document | What it contains |
|---|---|
| [Summary](01-summary.md) | What the project is, its overall health, headline strengths and risks, and the review's scope and method. |
| [Findings](02-findings.md) | 54 findings across all 13 review dimensions: 0 critical, 7 high, 20 medium, 27 low. |
| [Recommendations](03-recommendations.md) | 33 prioritised recommendations, every High finding covered, ordered by severity then effort. |
| [Improvement prompts](04-improvement-prompts.md) | One self-contained AI-agent prompt per recommendation, ready to paste into a fresh agent session. |
| [Tech debt register](../../TECH-DEBT.md) | Updated in place with the items this review's findings did not already have a home in; see the Review provenance table there for the recommendation ↔ ledger-ID mapping. |

The recommendations and improvement prompts feed the implementation
pipeline's `tech-debt` source and the `project-remediation` skill.
