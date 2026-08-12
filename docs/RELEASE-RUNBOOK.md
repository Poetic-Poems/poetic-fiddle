# Release runbook

How to publish a Poetic Fiddle release. `package.json`'s `version` field is
the single source of truth: `.github/workflows/release.yml` tags whichever
commit on `main` introduces a new value there and publishes a GitHub release
from it, so the tag can never drift out of sync with the version the commit
bumps to.

## Procedure

1. **Open a `chore: release vX.Y.Z` pull request** that bumps `package.json`'s
   `version` field to the new version.
2. **In the same pull request, rename `CHANGELOG.md`'s `## [Unreleased]`
   heading to `## [X.Y.Z]`** (the version from step 1), and open a fresh,
   empty `## [Unreleased]` heading above it. This is what keeps each release's
   notes scoped to what actually shipped in it, rather than restating
   everything earlier releases already announced —
   `scripts/extract-changelog-notes.mjs` (used by `release.yml` to build the
   release body) reads the `## [X.Y.Z]` section when present, falling back to
   `## [Unreleased]` only when it is not.
3. **Merge the pull request to `main`.** `.github/workflows/ci.yml`'s
   `changelog-rename` job checks that steps 1 and 2 were both done — it fails
   a pull request that bumps the version without the matching rename — so a
   green PR has already performed the rename correctly.
4. **`release.yml` runs on the push to `main`, automatically.** It tags the
   commit `vX.Y.Z`, extracts the `## [X.Y.Z]` section from `CHANGELOG.md`, and
   publishes it as the GitHub release body. Nothing further to do by hand.

## Why the rename matters

Without it, every release after the first would resolve through the
`## [Unreleased]` fallback and publish the whole accumulated section — so the
second and later releases would repeat every entry the earlier ones already
announced. The `changelog-rename` CI job and this runbook are the two guards
against that: the job catches it mechanically, the runbook states the step
for whoever is doing the release.

## Deployment and rollback

`main` deploys continuously to production through Vercel's Git integration:
every merge to `main` triggers a Vercel build and deploy on its own, outside
any GitHub Actions workflow. The GitHub release and `vX.Y.Z` tag that
`release.yml` produces (see "Procedure" above) is a version and
release-notes record — it is not what puts code into production, and
production does not wait for it.

The rollback mechanism for a bad production deploy is Vercel's **Instant
Rollback**, performed from the Vercel dashboard:

1. From the project overview, open the **Production Deployment** tile and
   choose **Instant Rollback**.
2. Select the deployment to roll back to, then **Continue**.
3. Verify the domains and details shown, then **Confirm Rollback**. The
   rollback takes effect immediately.

Alternatively, from the **Deployments** tab: filter by `main`, open the ⋮
menu on the deployment row to roll back to, and choose **Instant Rollback**.

Caveats that affect what to do next:

- Only deployments that were previously aliased to a production domain are
  eligible; preview deployments generally are not.
- Environment-variable changes made in project settings since the target
  deployment are **not** applied to a rolled-back deployment — it serves the
  previous build as originally compiled.
- After a rollback, Vercel turns off auto-assignment of production domains,
  so further pushes to `main` will **not** go live until the rollback is
  undone: project overview → **Undo Rollback** → select a deployment →
  **Confirm**, or `vercel promote <deployment-id-or-url>` from the CLI.

See https://vercel.com/docs/instant-rollback for the authoritative
procedure.
