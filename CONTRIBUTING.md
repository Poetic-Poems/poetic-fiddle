# Contributing to Poetic Fiddle

Thanks for your interest in contributing! Poetic Fiddle is a collaborative project and all contributions go through a pull request review process.

## Quick start

1. **Branch naming:** Create a branch with a descriptive name. For tech-debt items, use `td/<id>` (e.g., `td/TD26072418`); for other work, use `agent/<description>` or a similar clear prefix.

2. **Commit format:** All commits must follow [Conventional Commits](https://www.conventionalcommits.org/). This means:
   - Start with a type: `fix`, `feat`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`, `style`, or `revert`
   - Optionally add a scope in parentheses: `fix(auth)`, `docs(readme)`
   - End with a concise description: `fix(auth): resolve token refresh`

3. **Pull request workflow:** Every change lands via a pull request — there are no direct commits to `main`. When you open a PR:
   - Use the PR title to describe your change in Conventional Commits format (the title becomes the commit on `main`)
   - Fill in the PR body with context: what the change does, why it matters, any test plan or verification steps
   - Link the issue or tech-debt item if applicable
   - CI checks must pass before merge

## Getting help

For detailed information on the project's architecture, development setup, and conventions, see [CLAUDE.md](./CLAUDE.md).

For the full tech-debt register and project implementation plan, see:
- [TECH-DEBT.md](./TECH-DEBT.md) — known deferred work
- [docs/IMPLEMENTATION-PLAN.md](./docs/IMPLEMENTATION-PLAN.md) — milestone sequencing
- [CHANGELOG.md](./CHANGELOG.md) — notable changes

## Questions?

If you have questions about contributing or the development process, please open an issue or reach out to the maintainers.
