## Description

<!-- Link to the issue or tech-debt item this addresses -->

<!-- Brief explanation of the change and why it matters -->

## Changelog

<!-- For a type that owes no entry (chore, docs, refactor, test, build, ci,
     style, revert), leave this section as it is or delete it: a section
     holding only this comment counts as absent. A feat, fix or perf title,
     or a breaking change, must fill it: one or more of `### Added`,
     `### Changed`, `### Deprecated`, `### Removed`, `### Fixed` and
     `### Security`, each with `- ` bullets written for this repository's
     changelog audience, or the single line `None.` if the change is not
     notable. The squash merge carries it onto main; the release pull
     request assembles CHANGELOG.md from it, so do not edit that file. -->

## Test plan

<!-- How to verify this change works as intended -->

<!-- If this PR touches src/lib/csp.ts, src/proxy.ts, PoemPreview.tsx or
     SharedPoemView.tsx, run through docs/CSP-REVIEW-CHECKLIST.md in a real
     browser and note the results here. -->

## Notes

- PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/) format: `type(scope): description` (e.g., `docs(contributing): add CONTRIBUTING.md`)
- Allowed types: `fix`, `feat`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`, `style`, `revert`
- Every commit on this branch is also checked for the same format by CI
- See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full workflow
