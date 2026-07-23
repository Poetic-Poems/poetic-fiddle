# Summary

## What this project is

Poetic Fiddle is a Next.js (App Router) + TypeScript web application that
gives poets a browser-based editor and live preview for `.poem` files, the
authoring format defined by the sister `poetic` framework. It renders poems
using a browser-safe renderer imported from that framework as a tag-pinned
GitHub release tarball (not vendored or reimplemented), and adds a CodeMirror
6 editing surface, Supabase-backed accounts (magic link, Google OAuth,
email/password), row-level-security-scoped save/dashboard/share/remix
features, and Sentry-based server-side observability. Its stated audience is
non-technical poets; the MVP scope is a single-poem editor with live preview,
accounts, and database-backed save/share via permalinks.

The codebase is small (~61 TypeScript/TSX files, ~5,425 lines under `src/`)
and actively developed by a single human maintainer working alongside AI
agents, with 16 tech-debt items already resolved and the most recent PR
merged the day before this review. Despite CLAUDE.md's own Status section
describing the data layer as "not yet" built, the codebase, `CHANGELOG.md`,
and `docs/IMPLEMENTATION-PLAN.md`'s milestone tracker all agree the app is
fully built through save/dashboard/share/remix and is live in production at
www.poeticfiddle.com — see F-DOC-01.

## Overall assessment

This is a genuinely well-built project for its size and stage. Code quality
is unusually disciplined (strict TypeScript with zero escape hatches, zero
dead-code markers, a near-1:1 test-to-source ratio, and a test suite that
asserts behaviour rather than snapshots), the Supabase RLS layer is
correctly default-deny and backed by a thorough 34-assertion pgTAP suite,
and the untrusted-content sanitisation boundary (poem HTML rendered from
user-controlled `.poem` source, shown both in-browser and on a public share
page) is defended in depth — DOMPurify at two independent points, iframe
sandboxing, and a nonce-based CSP with no `unsafe-inline`. CI is broad and
each workflow documents its own rationale; the project's tech-debt register
is exemplary, with each hold (notably the jsdom major-version pin) carrying
a clear incident history.

The headline risk is not any single defect but a recurring pattern: several
of the project's own protective mechanisms are quietly not doing what the
project's documentation says they do. Branch protection does not actually
require CI to pass before merge, despite CLAUDE.md stating that it does
(F-CI-01). The two CODEOWNERS accounts that satisfy "independent code-owner
review" both appear to belong to the same person (F-GOV-03). The Privacy
Policy tells visitors that poem storage "isn't available yet," while it has
been live and exercised in production for some time (F-DATA-01). And
CLAUDE.md's own Status section undersells what's built, which risks steering
a future agent into duplicating or avoiding work incorrectly (F-DOC-01).
None of these is a defect in the underlying engineering — the RLS, the
sanitisation, the CI jobs themselves are all sound — but each is a place
where the stated guarantee and the actual guarantee have quietly diverged,
which is exactly the kind of gap that's invisible until it matters. A second,
smaller cluster of findings is a real but narrower security gap: `next` is
one dependency-patch behind on a build that genuinely exercises the affected
Server Actions code path (F-SEC-01/F-DEPS-01), and the editor's core
CodeMirror surface has no accessible name for screen readers despite a
closed-out acceptance criterion saying it does (F-UX-01).

No Critical findings were identified. Seven High findings were identified,
covering the divergences above plus one further onboarding trap (a missing
`.env.local` silently breaks the editor client-side with no on-screen
explanation, F-TOOL-01). All seven are addressed by dedicated, small-to-medium
recommendations in `03-recommendations.md`.

## Headline strengths

- Row-level security is default-deny, precisely scoped, and verified by a genuinely adversarial 34-assertion pgTAP test suite that proves cross-tenant access is denied, not merely empty [F-SEC strengths, F-DATA strengths].
- The untrusted-content sanitisation boundary is defended in depth at every layer it's rendered — DOMPurify at two independent points, restrictive iframe sandboxing, and a correctly-wired nonce-based CSP with no `unsafe-inline` [F-SEC strengths].
- Code quality is unusually disciplined for the project's size: strict TypeScript with zero `any`/escape hatches, zero dead-code markers, and near-1:1 test-to-source coverage where the riskiest paths (auth, mutations, sanitisation, RLS) are consistently the best-tested [F-CODE strengths, F-TEST strengths].
- Observability is built with real data-minimisation discipline (`sendDefaultPii: false`, deliberate cookie/header scrubbing verified against the SDK's actual defaults) and an honestly-documented, least-privilege agent-triage runbook [F-OPS strengths].
- The single non-registry dependency (`poetic`, installed from a pinned GitHub release tarball) is genuinely reproducible, integrity-hashed, and documented as a deliberate, reviewable edit rather than a silent float [F-DEPS strengths, F-ARCH strengths].

## Headline risks

- Branch protection does not actually require CI (lint/typecheck/test/build/commit-format) to pass before a PR merges, despite CLAUDE.md's documentation stating it does [F-CI-01].
- `next` is one patch behind on advisories that target Server Actions handling — a code path this app genuinely exercises on every save of a shared poem — with no Dependabot PR or alert currently in flight to catch it [F-SEC-01, F-DEPS-01].
- The Privacy Policy tells visitors that poem/account storage "isn't available yet," while it has been fully implemented and live in production [F-DATA-01].
- CLAUDE.md's own Status section understates what's built (calling the data layer "not yet" done when it demonstrably is), risking future agents misjudging project maturity or duplicating shipped work [F-DOC-01].
- The CodeMirror editor — the app's core interaction — has no accessible name for screen-reader users, despite a closed-out acceptance criterion (AC79) saying it does [F-UX-01].
- A missing `.env.local` breaks the editor silently and client-side only (HTTP 200, no on-screen error), the most likely way a newcomer's "clone → follow instructions" path fails in practice [F-TOOL-01].
- The two CODEOWNERS accounts satisfying "independent code-owner review" appear to belong to the same individual, so the review gate is closer to self-approval through an alternate account than independent oversight [F-GOV-03].

## Scope and method

**Exhaustive:** `src/` (all ~61 files), `supabase/migrations/` and
`supabase/tests/rls_test.sql`, `scripts/`, every file under
`.github/workflows/`, and all top-level docs (README, CLAUDE.md,
SECURITY.md, CHANGELOG.md, TECH-DEBT.md, `.env.example`).

**Sampled:** `docs/REQUIREMENTS.md` (1,284 lines) and
`docs/IMPLEMENTATION-PLAN.md` (967 lines) — both explicitly self-declared
living/decision-log documents, not as-built prose — were read by section
relevant to each review dimension rather than end-to-end line-by-line, given
their length.

**Automated checks run:** `npm ci`, `npm run lint`, `npm run typecheck`,
`npm run format:check`, `npm test` (vitest), `npm run build` (Next.js/
Turbopack), `npm audit` — all run centrally once and results shared across
dimension reviewers rather than re-run per dimension. Lint, typecheck,
format, tests (125/125), and build all passed cleanly; `npm audit` found 3
high-severity advisories, fully traced to `next@16.2.10` being one patch
behind `16.2.11` (F-SEC-01/F-DEPS-01). `gh api`/`gh pr list`/`gh issue list`
were used for the governance and CI dimensions to inspect real branch-protection
rulesets, PR review history, and Dependabot alert state directly, rather than
inferring them from documentation alone.

**Not run:** an automated accessibility scanner (`axe-core`/`pa11y`) — no
such tooling exists in the repo, and standing one up against a live dev
server with valid Supabase credentials was out of proportion for this pass;
the UX dimension is accordingly a manual, code-reading review only, and its
own findings note this explicitly (F-UX-04 recommends closing this gap). No
dimension was judged wholly inapplicable — the project has a real UI, a real
backend, and real user data, so all thirteen checklist dimensions applied.

This is the project's first project-review pass — no prior `reviews/`
folder existed to compare against.
