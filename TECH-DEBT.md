# Tech debt

Deferred work and known gaps in poetic-fiddle. Record an entry here
whenever you defer something, rather than leaving it only in a commit message or
in chat. Keep entries short and dated. Once an issue has been resolved, remove
its `## <id> <title>` section below — but never remove its row from the
Ledger table at the bottom of this file; see "Ledger" below.

Format:
```
## <id> <short title>

A description of what, why it matters, where, and a suggested fix.

```
Where `<id>` is a literal "TD" then the date followed by a zero-padded
sequential number (starting at 1 for the the first entry of a day). I.e.:
**TD*YYMMDDNN***. `NN` is one more than the highest `NN` already used for
that date **in the Ledger table**, not just what's currently visible above
it — a resolved entry's body is removed, but its Ledger row stays forever,
so the Ledger (not memory or scrollback) is the source of truth for the next
free ID. Compute it with `scripts/next-tech-debt-id.pl` rather than counting
by hand.

## Claiming an item

Before starting work on an open item, confirm nobody else already has:
check its Ledger row is `open` (not `in-progress`), and skim open pull
requests for its ID. Then:

1. Flip its Ledger row's Status to `in-progress`.
2. Push a branch and open a **draft** pull request right away — before the
   fix is finished — so `gh pr list` shows it's claimed. The first commit
   can be the Ledger status flip itself.
3. Do the work, pushing further commits to the same branch/PR.
4. Once verified, flip the Ledger row to `resolved` (fill in `Resolved` and
   `Ref`), remove the entry's `## <id>` section, and mark the PR ready for
   review.

If a claim is abandoned (the draft PR is closed without merging), flip the
row back to `open`.

## TD26071302 poetic dependency pinned to a commit SHA, not a release tag

`docs/IMPLEMENTATION-PLAN.md` §6.1 settled on a **tag**-pinned git dependency
on `poetic` (e.g. `github:Poetic-Poems/poetic#v6.0.0`). At the time M2 needed
it, the latest tag, `v6.0.0`, predates poetic's `./browser` export map (added
in poetic PR #33) and its aggregate renderers (PR #34) — it is 13 commits
behind poetic's `main` and its `package.json` has no `exports` field at all.
No poetic tag yet exposes `poetic/browser`.

`package.json` pins instead to the poetic `main` HEAD commit as of this
writing (`115b15393065bfcf4c12d53fce097115219f4773`). poetic's own
`docs/RENDERER-BROWSER.md` documents a commit SHA as an equally valid pin
("a commit SHA works the same way if pinning between releases"), and
`package-lock.json` still freezes the resolved commit — so this satisfies
the same pinned-version intent as a tag (cf. AC68's pattern), just not the
literal tag syntax §6.1 shows.

Fix: once poetic cuts a release that includes the `./browser` export (bump
`package.json`'s `version` and merge to `main` — poetic's `release.yml` then
auto-tags), switch this repo's `poetic` dependency to that tag (e.g.
`github:Poetic-Poems/poetic#v6.1.0`) and remove this entry.

## Ledger

Every tech-debt ID ever allocated — open, in-progress, resolved, or not-debt —
is listed here forever, in ID order. This is what makes numbering unambiguous:
the next free ID for a given date is one more than the highest `NN` seen
below for that date, regardless of whether the corresponding entry still has
a body above.

A row can also close as `not-debt`: the item was filed here but turned out, on
reflection, not to be a deferred cost at all (e.g. deliberately reserved
syntax awaiting a future feature). Its `## <id>` section is removed like a
resolved one, but nothing was fixed, so the `Resolved` column stays blank; the
`Ref` column instead points to wherever the content moved.

| ID | Title | Status | Resolved | Ref |
|----|-------|--------|----------|-----|
| TD26071301 | poetic git dependency needs types shim + transpilePackages | resolved | 2026-07-13 | https://github.com/Poetic-Poems/poetic-fiddle/pull/14 |
| TD26071302 | poetic dependency pinned to a commit SHA, not a release tag | open | | |
