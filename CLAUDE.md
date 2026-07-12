# poetic-fiddle

A web-app interface to the [poetic](https://github.com/Poetic-Poems/poetic)
poem-authoring framework.

This is **not** a poem-collection consumer repo — it does not use
`scripts/sync-framework.sh` or track a `.poetic-version`. It's a standalone
web application that talks to the poetic framework's output/format.

## Status

The app's stack is chosen (see "Architecture & stack" below) but not yet
scaffolded. This repo currently carries its governance and agent-working layer
(branch/commit policy, tech-debt process, CI backstops) plus a living
requirements registry (`docs/REQUIREMENTS.md`). Build/lint/test tooling —
`package.json`, an ESLint config, app build/test CI, and CodeQL's
`javascript-typescript` scan — will be added when the app is scaffolded.

Requirements gathering is ongoing; `docs/REQUIREMENTS.md` is the authoritative,
living registry of decisions, rationale, and open questions.

## Architecture & stack

Poetic Fiddle is a web `.poem` editor with a real-time HTML preview. Confirmed
choices (rationale and full decision log in `docs/REQUIREMENTS.md`):

- **Language:** TypeScript.
- **Framework:** Next.js (React), deployed to free-tier serverless hosting
  (Vercel by default; Cloudflare/Netlify are options).
- **Editor:** CodeMirror 6 with a custom `.poem` language mode.
- **Backend / Auth / DB:** Supabase — Postgres, Auth (magic link, Google,
  email/password), and storage, with row-level security.
- **Rendering:** the `.poem` → HTML render runs **in the browser** for the live
  preview; the same renderer can run server-side to SSR a shared poem's public
  page.

MVP scope: a single-poem editor + live preview + accounts + database-backed
save/share (permalinks), aimed at non-technical poets. Publishing to GitHub
Pages / Blogger is a later phase.

## Relationship to the Poetic framework

Poetic Fiddle *consumes* the Poetic framework's `.poem` format and renderer, but
is not a poem-collection repo — it does not use `sync-framework.sh` or track a
`.poetic-version`.

- **Single source of truth.** Fiddle renders poems with a browser-safe renderer
  **exported by the `poetic` repo**, not a copy. Do not fork or re-implement the
  `.poem` parser/renderer in this repo — changes to `.poem` syntax or rendering
  belong upstream in `poetic` and reach Fiddle through that shared module. (The
  packaging/versioning mechanism for that module is still to be decided.)

## Development approach

Be cost-conscious: prefer the cheapest model or agent likely to complete a task
correctly on the first attempt, and delegate well-scoped work to lower-cost
subagents where appropriate. Favour a minimal-cost architecture — static/edge
hosting, in-browser compute, free managed tiers — and add paid infrastructure
only when a capability genuinely requires it.

## Branch workflow

`main` is protected: it does not accept direct commits or pushes, from anyone
or anything, including maintainers and AI agents. Every change goes through a
pull request. A repo ruleset scoped to the default branch restricts merges
into `main` to squash only (other branches allow any merge method) — so a
pull request's title becomes the subject line of the single commit that
lands on `main`.
Write that title in Conventional Commits format (see "Commit messages"
below); the individual commits on the branch are discarded when squashed, so
only the title needs to conform. The squash commit's body is pre-filled from
the pull request's description (GitHub repo setting `squash_merge_commit_message:
PR_BODY`), so a filled-in PR description carries through to `main`'s history —
write one whenever the change needs more context than the title alone gives.

Because every change is gated by a PR and CI regardless of who or what proposes it, agents
work autonomously up to the PR stage: commit, push a branch, and open the pull request
without pausing to ask permission first. Review happens on the PR, not before it — the repo
owner reviews there and requests changes if needed. This does not extend to actions on `main`
itself (direct commits/pushes are rejected by the branch protection anyway) or to
force-pushing/merging, which still require explicit instruction.

In this workspace, a local `post-checkout` Git hook in `.githooks/` refreshes the local
`main` branch from `origin/main` after switching to `main`, helping keep the branch aligned
with GitHub while working locally.

After opening (or updating) a pull request, confirm it is actually mergeable via `gh`
(e.g. `gh pr view <n> --json mergeable,mergeStateStatus`) — in addition to, not instead
of, whatever local checks the agent already ran. The remote can diverge from what the
agent last saw locally (another PR merging to `main` first, for example), so this check
has to happen after the PR exists, against GitHub's own view of it, not inferred from the
local working tree. If it comes back conflicting, resolve the conflict (e.g. rebase onto
the current `main`) and push the fix; force-pushing to update a branch still requires
explicit instruction, per above.

## Commit messages

All commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
(`<type>[(scope)][!]: <description>`, e.g. `fix(auth): resolve token refresh`). Allowed
types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`,
`test`. A `commit-msg` hook (`.githooks/commit-msg`) enforces this once a contributor runs
`git config core.hooksPath .githooks`. Because `main` only accepts squash merges (see
"Branch workflow" above), the pull request title is what actually becomes the commit on
`main` — CI (`.github/workflows/commit-format.yml`) checks both the PR title and every
commit on the branch.

## Documentation principles

- **`CHANGELOG.md`** is the only place for recording what changed and when.
  Add an entry under `[Unreleased]` for any notable change (one visible to
  users of the app). Patch-level fixes and routine doc updates do not need
  entries.
- **All other docs are as-built.** Write them to describe the current state
  only — no "previously", "used to be", "now uses", "migration completed", or
  "old format (deprecated)" phrasing. Git log already records history; docs
  that repeat it become misleading as the codebase evolves.
- If you encounter historical language in an existing doc, remove it and move
  the substance to `CHANGELOG.md` if it is significant.

## Tech debt

When you defer work, take a shortcut, or notice a known gap, record it in
`TECH-DEBT.md` at the repo root — do not leave it only in a commit message or in
chat. Keep entries short and aligned to the format outlined in `TECH-DEBT.md`,
and delete one when it is resolved. If you add an entry in `TECH-DEBT.md` and
refer to that entry in other places (e.g., code comments), note that reference
in the `TECH-DEBT.md` entry, so whoever addresses that item knows to also remove
the references.

`TECH-DEBT.md` ends with a permanent Ledger table recording every ID ever
allocated, so a removed entry's ID is never reused. Get a new entry's ID from
`scripts/next-tech-debt-id.pl` rather than counting by hand, and add a Ledger
row (`open`) alongside the new entry. When picking up an existing open item,
follow the "Claiming an item" workflow at the top of `TECH-DEBT.md` — flip its
Ledger row to `in-progress` and open a draft PR immediately, so the claim is
visible to other agents/developers before the fix lands. The `/td` skill
(`.claude/skills/td/SKILL.md`) automates resolving an ID segment to a record
via `scripts/get-tech-debt-record.pl` and dispatching it to a subagent.

## Key docs

| File | Contents |
|------|----------|
| `README.md` | Project overview |
| `docs/REQUIREMENTS.md` | Requirements registry / decision log (living) |
| `SECURITY.md` | Vulnerability reporting, CodeQL scanning |
| `TECH-DEBT.md` | Deferred work register |
| `CHANGELOG.md` | Notable changes, Keep a Changelog format |
