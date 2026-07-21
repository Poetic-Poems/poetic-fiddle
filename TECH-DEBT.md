# Tech debt

Deferred work and known gaps in poetic-fiddle. Record an entry here
whenever you defer something, rather than leaving it only in a commit message or
in chat. Keep entries short and dated. Live items live under the "Current Items"
heading as `### <id> <title>` sections. Once an issue has been resolved, remove
its `### <id> <title>` section from Current Items below — but never remove its
row from the Ledger table at the bottom of this file; see "Ledger" below.

Format:
```
### <id> <short title>

A description of what, why it matters, where, and a suggested fix.

```
Where `<id>` is a literal "TD" then the date followed by a zero-padded
sequential number (starting at 1 for the the first entry of a day). I.e.:
**TD*YYMMDDNN***. `NN` is one more than the highest `NN` already used for
that date **in the Ledger table**, not just what's currently visible above
it — a resolved entry's body is removed, but its Ledger row stays forever,
so the Ledger (not memory or scrollback) is the source of truth for the next
free ID. Compute it with `scripts/next-tech-debt-id.pl --ref origin/main`
(after a `git fetch origin`) rather than counting by hand — the `--ref` makes
the allocation reflect the shared state instead of a possibly stale checkout.
It still cannot see IDs allocated on unmerged branches, so also skim open
pull requests and `td/*` branches when filing.

IDs are only unique within this repository: sister repositories allocate from
the same date-based sequence, so the bare ID may exist in several of them.
When referring to an item anywhere outside this repository (a sister repo's
docs, a cross-repo PR, chat), qualify it with the repo name — e.g.
`poetic-fiddle TD26071801`.

## Claiming an item

This repository is worked by concurrent agents: autonomous and interactive
sessions may pick up items at the same time, so a claim must be checked and
taken against the shared state, never against what a local checkout happens
to say. Before starting work on an open item:

1. `git fetch origin`, then confirm the item's Ledger row is `open` (not
   `in-progress`) **as of `origin/main`** — e.g. via
   `perl scripts/get-tech-debt-record.pl --ref origin/main <id>`.
2. Confirm nobody holds a claim: `git ls-remote origin "refs/heads/td/<id>"`
   must print nothing, and skim open pull requests for the ID (which also
   catches claims made on unconventionally named branches).
3. Create the claim branch, named exactly **`td/<id>`**, from `origin/main`;
   flip the item's Ledger row Status to `in-progress`; commit and push. The
   branch name is the claim lock: git refuses the push if the branch already
   exists, so a rejected push means another agent won the race — abandon
   quietly; never force-push over it.
4. Open a **draft** pull request right away — before the fix is finished — so
   `gh pr list` shows the claim too. The Ledger status flip can be its first
   commit.
5. Do the work, pushing further commits to the same branch/PR.
6. Once verified, flip the Ledger row to `resolved` (fill in `Resolved` and
   `Ref`), remove the entry's `### <id>` section from Current Items, and mark
   the PR ready for review.

If a claim is abandoned, close the draft PR and delete the `td/<id>` branch —
that releases the lock. The in-progress flip only ever lived on the branch,
so `main`'s Ledger still says `open` and nothing needs reverting.

## Current Items

The open and in-progress items, each as a `### <id> <title>` section. This
heading is permanent: when there are no current items it stays here (empty), so
it is always obvious where a new item's body belongs.

### TD26071901 jsdom pinned to 26.x — 27+ pulls an ESM-only dep Turbopack can't require

*Filed 2026-07-19, resolving #52.* jsdom 27+ replaced its CommonJS encoding
dependencies with the **ESM-only** `@exodus/bytes` (`jsdom` and
`html-encoding-sniffer@6` both `require()` it). jsdom is on Next's default
`serverExternalPackages` list, so on Vercel it is `require()`d — not bundled —
at runtime, and that CommonJS-`require()`-of-an-ESM-module throws
`ERR_REQUIRE_ESM` under the Turbopack server build (it is not fixed by moving to
Node ≥ 22.12 — see #52 / PR #65). Because the share page imports jsdom at module
scope (`src/lib/render-share.ts`), the throw hard-500s `/share/[share_id]` for
every visitor.

Worked around by pinning `jsdom` to `^26.0.0` in `package.json` — jsdom 26.x's
encoding deps are all CommonJS (`whatwg-encoding`, `html-encoding-sniffer@4`),
so `@exodus/bytes` leaves the tree entirely and there is no ESM `require` left
to fail. The pin is referenced from a comment at the jsdom import in
`src/lib/render-share.ts`.

Dependabot PR #79 bumped jsdom 26.1.0 → 29.1.1 anyway — a `^26.0.0` range in
`package.json` doesn't stop Dependabot from *proposing* a major bump, only
from a plain `npm update` picking one silently — and merging it regressed
this exact 500 in production (issue #86). `.github/dependabot.yml` now has an
`ignore` rule for jsdom `semver-major` updates, so Dependabot itself can no
longer open that PR; a manual bump remains possible and must not land without
re-checking this entry first.

Fix (to lift the pin): bump jsdom once either Turbopack bundles jsdom rather
than externalising it, or its ESM deps can be `require()`d in this runtime
(e.g. jsdom ships a CJS-compatible path again). Alternatively, move the
share-page sanitiser off jsdom onto a bundler-friendly DOM (e.g. linkedom),
which would remove the constraint but is a change to a security-sensitive
sanitisation boundary and needs its own careful review. Either way, remove
the `dependabot.yml` ignore rule in the same change.

## Ledger

Every tech-debt ID ever allocated — open, in-progress, resolved, or not-debt —
is listed here forever, in ID order. This is what makes numbering unambiguous:
the next free ID for a given date is one more than the highest `NN` seen
below for that date, regardless of whether the corresponding entry still has
a body above.

A row can also close as `not-debt`: the item was filed here but turned out, on
reflection, not to be a deferred cost at all (e.g. deliberately reserved
syntax awaiting a future feature). Its `### <id>` section is removed like a
resolved one, but nothing was fixed, so the `Resolved` column stays blank; the
`Ref` column instead points to wherever the content moved.

| ID | Title | Status | Resolved | Ref |
|----|-------|--------|----------|-----|
| TD26071301 | poetic git dependency needs types shim + transpilePackages | resolved | 2026-07-13 | https://github.com/Poetic-Poems/poetic-fiddle/pull/14 |
| TD26071401 | Analysis show/hide toggle is inert under DOMPurify sanitisation | resolved | 2026-07-16 | https://github.com/Poetic-Poems/poetic-fiddle/pull/32 |
| TD26071501 | Auth needs manual Supabase/Vercel dashboard configuration | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/24 |
| TD26071502 | Privacy policy needed for Google OAuth brand verification | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/26 |
| TD26071503 | Point the Google OAuth consent screen at the published privacy policy | resolved | 2026-07-15 | https://github.com/Poetic-Poems/poetic-fiddle/pull/27 |
| TD26071504 | OAuth consent screen App name doesn't match the home page | resolved | 2026-07-21 | https://github.com/Poetic-Poems/poetic-fiddle/pull/84 |
| TD26071601 | Auth email reaches only project-team addresses (no custom SMTP) | resolved | 2026-07-16 | https://github.com/Poetic-Poems/poetic-fiddle/pull/34 |
| TD26071602 | Analysis synopsis/full selector is inert under DOMPurify sanitisation | resolved | 2026-07-16 | https://github.com/Poetic-Poems/poetic-fiddle/pull/33 |
| TD26071701 | No way to revoke a share link | resolved | 2026-07-17 | https://github.com/Poetic-Poems/poetic-fiddle/pull/39 |
| TD26071801 | `npm test` fails on Node 26 (26 tests, all localStorage) | resolved | 2026-07-18 | https://github.com/Poetic-Poems/poetic-fiddle/pull/46 |
| TD26071802 | poem-title CSS override is a brittle regex against vendored CSS | resolved | 2026-07-18 | https://github.com/Poetic-Poems/poetic-fiddle/pull/47 |
| TD26071803 | Merged migrations don't reach the live Supabase project on their own | resolved | 2026-07-18 | https://github.com/Poetic-Poems/poetic-fiddle/pull/49 |
| TD26071804 | npm 12 blocks the `poetic` git dependency by default | resolved | 2026-07-18 | https://github.com/Poetic-Poems/poetic-fiddle/pull/53 |
| TD26071805 | `database.yml`'s live-migration push is failing silently | resolved | 2026-07-19 | https://github.com/Poetic-Poems/poetic-fiddle/pull/70 |
| TD26071901 | jsdom pinned to 26.x — 27+ pulls an ESM-only dep Turbopack can't require | open | | |
| TD26071902 | `supabase/setup-cli@v1` targets the deprecated Node.js 20 runtime | resolved | 2026-07-19 | https://github.com/Poetic-Poems/poetic-fiddle/pull/72 |
