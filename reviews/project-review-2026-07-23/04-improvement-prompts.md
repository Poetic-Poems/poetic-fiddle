# Improvement prompts

One prompt per recommendation below, in the same order as `03-recommendations.md` (severity first, then quick wins before longer campaigns at equal severity). Each prompt is self-contained: it can be pasted into a fresh agent session with no other review context and restates its own problem, evidence, acceptance criteria, and verification steps. Every prompt tells the executing agent to read CLAUDE.md first, since it documents this repo's mandatory branch/PR workflow (main is protected, PR-only, squash-merge, Conventional Commits titles) and is not repeated here.

**Ordering dependencies:** R-33 (axe smoke test) must land after R-02 and R-14 — otherwise the new test fails immediately on the very accessibility violations those two recommendations fix. R-05 and R-12 are a soft pairing, not a hard dependency: R-05's prompt checks R-12's status so the Privacy Policy doesn't trade one inaccuracy for another, but R-05 can run whether or not R-12 has landed. No other recommendation in this set requires another's artifact to exist first.

## Prompt for R-01 — Bump `next` to `16.2.11`

**Bundles:** R-01 only · **Run after:** no prerequisites

```text
Context: You are working in poetic-fiddle, a Next.js (App Router) + TypeScript
app under this repo's root. Read CLAUDE.md first for the branch/PR workflow
(main is protected; PR-only; squash-merge; Conventional Commits PR title).

Problem: package.json pins "next": "16.2.10". `npm audit` reports 3
high-severity advisories fixed in 16.2.11, several scoped to Server Actions
handling and the proxy/middleware layer. This is not a dormant feature:
src/lib/revalidate-share.ts exports a "use server" function called from
src/components/Editor.tsx on every save of a shared poem. Neither Dependabot
nor `gh api repos/Poetic-Poems/poetic-fiddle/dependabot/alerts` currently
flags this.

Goal (acceptance criteria):
- package.json and package-lock.json pin next@^16.2.11 or later.
- `npm audit` reports zero high-severity advisories traceable to `next`.
- No application code changes (this is dependency-only).

Constraints: Do not touch unrelated dependencies or app code. Do not float
the version with a caret wider than the repo's existing convention for
`next` (match the current pinning style).

Verification: run, in order, `npm install next@16.2.11`, then `npm run
lint`, `npm run typecheck`, `npm run format:check`, `npm test`, `npm run
build`, and `npm audit`. All must pass/report clean before you declare this
done; if `npm audit` still lists a `next`-traceable high-severity advisory,
the bump target was insufficient — bump further and re-verify.

Work cost-consciously: this task is almost entirely mechanical (a version
bump plus running the existing check suite) and suits a low-cost model tier
end to end. The one judgment call — deciding whether any test failure after
the bump is a real regression or a false-positive needing investigation — is
where you should escalate to a higher-capability tier if it arises; do not
guess your way past a red test to make the bump land.

Deliverable: a single commit (dependency bump only) with a Conventional
Commits message (e.g. `fix(deps): bump next to 16.2.11`), ready to push to a
feature branch and open as a PR per CLAUDE.md's workflow.
```

## Prompt for R-02 — Add an accessible name to the CodeMirror editor

**Bundles:** R-02 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its core interaction is
a CodeMirror 6 editor in src/components/Editor.tsx. Read CLAUDE.md first for
the branch/PR workflow.

Problem: Editor.tsx has a `<label htmlFor="poem-source">`, but CodeMirror's
React wrapper places that `id` on the outer wrapper `<div>`, not on the
actual editable element (which has `role="textbox"` and no `id`/`aria-label`
of its own). So the app's primary control is an unlabelled textbox to
screen-reader users. docs/REQUIREMENTS.md's AC79 explicitly requires the
editor be labelled, and PR #89 closed that backlog item without actually
fixing the labelling.

Goal (acceptance criteria):
- The CodeMirror content-editable element (role="textbox") has an
  accessible name, e.g. via
  `EditorView.contentAttributes.of({ "aria-label": "Your poem" })` added to
  the `extensions` array already passed to `<CodeMirror>`.
- A test in Editor.test.tsx asserts the accessible name resolves, e.g. via
  `getByRole("textbox", { name: /your poem/i })` or
  `getByLabelText(...)`.
- AC79 in docs/REQUIREMENTS.md is genuinely satisfied, not just marked done
  (if its status line needs updating to reflect this, update it).

Constraints: Do not change the visible `<label>` or its existing
`htmlFor`/`id` wiring — add the aria-label alongside it, don't replace one
mechanism with the other unless you confirm the existing label becomes
redundant. Do not change CodeMirror's other extensions or editor behaviour.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test` (confirm the new/updated Editor.test.tsx assertion passes and no
other Editor.*.test.tsx file regresses), `npm run build`.

Work cost-consciously: this is a small, well-specified accessibility fix —
one extension addition plus one test assertion — and suits a low-to-mid-cost
model tier throughout. If you delegate the test-writing to a subagent, keep
the fix itself and its verification in the same pass rather than splitting
across sessions.

Deliverable: a single commit with a Conventional Commits message (e.g.
`fix(a11y): add accessible name to CodeMirror editor`), ready for a PR per
CLAUDE.md's workflow.
```

## Prompt for R-03 — Require CI status checks in the branch-protection ruleset

**Bundles:** R-03 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle's `main` branch is governed by a GitHub repo ruleset
(id 18828479, `gh api repos/Poetic-Poems/poetic-fiddle/rulesets/18828479`).
Read CLAUDE.md first — it describes this ruleset's intended role and the
overall branch/PR workflow.

Problem: the active ruleset requires 1 approving code-owner review, CodeQL
at `high_or_higher`, and Copilot code-quality, but has no
`required_status_checks` rule. That means `.github/workflows/build.yml`
(job `build`: lint, typecheck, format check, test, build),
`.github/workflows/commit-format.yml` (job `commit-format`), and
`.github/workflows/database.yml`'s `test` job can all be red, or not yet
finished, and a PR is still mergeable given one code-owner approval — the
exact scenario `build.yml` exists to prevent, and more consequential in a
repo CLAUDE.md itself describes as multi-agent.

Goal (acceptance criteria):
- The ruleset (or a replacement covering `main`) has a
  `required_status_checks` rule naming the `build` job from build.yml, the
  `commit-format` job from commit-format.yml, and database.yml's `test`
  job as required.
- GitHub's merge button is blocked on a PR until each of those has
  succeeded, verified empirically (see Verification).

Constraints: Do not remove or weaken any existing rule (code-owner review,
CodeQL, Copilot code-quality, deletion protection, non-fast-forward). Do not
change which workflows exist — this is a ruleset-configuration change only,
not a CI-file change. Do not force-merge or bypass the ruleset while
testing it.

Verification: apply the change via `gh api --method PUT
repos/Poetic-Poems/poetic-fiddle/rulesets/18828479` (or the GitHub UI),
then confirm with `gh api repos/Poetic-Poems/poetic-fiddle/rulesets/18828479`
that the required checks are present. Open a throwaway PR containing a
deliberately failing lint (e.g. an unused variable) and confirm GitHub's
merge button is disabled while `build` is red; then close that PR without
merging and delete its branch. There is no `npm` command for this
recommendation — the verification is against GitHub's own state.

Work cost-consciously: this is a single, well-specified API/UI
configuration change with a clear, mechanically checkable verification step
(the throwaway PR), and suits a low-to-mid-cost model tier. Because it is a
security/governance control, do not skip the empirical throwaway-PR check
in favour of just trusting the API response.

Deliverable: a short report of the exact ruleset change made (the JSON
patch or UI steps), the `gh api` output confirming it, and the throwaway-PR
evidence that the merge button was blocked. This recommendation has no code
diff and needs no PR of its own.
```

## Prompt for R-04 — Correct CLAUDE.md's Status section

**Bundles:** R-04 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app; CLAUDE.md at the repo
root is its agent-facing operating-instructions file, read first by every
agent before touching the repo. Read CLAUDE.md in full now, including its
own "Branch workflow" and "Documentation principles" sections, which govern
how you must make and land this change.

Problem: CLAUDE.md's "Status" section currently states that "the data layer
(save, dashboard, share) is not yet" built. This is false: the codebase
(src/lib/poems-store.ts, src/components/PoemsDashboard.tsx, the share/remix
routes, all tested) and docs/IMPLEMENTATION-PLAN.md itself (which CLAUDE.md
cites) show milestones through M7 delivered and the app live in production
(per CHANGELOG.md). An agent trusting this line could duplicate already-built
work or misjudge the project's maturity.

Goal (acceptance criteria): CLAUDE.md's Status section accurately states
the current milestone (M0–M7 delivered per docs/IMPLEMENTATION-PLAN.md §7)
and names the actual remaining work (the W1–W16 hardening backlog) as "not
yet," rather than repeating IMPLEMENTATION-PLAN.md's detail — CLAUDE.md's
own documentation principles favour pointing at that doc over duplicating
it.

Constraints: Keep the paragraph brief — this is a correction, not an
expansion. Do not alter any other section of CLAUDE.md. Do not introduce
"previously.../used to say..." framing — CLAUDE.md's own rule bans that
phrasing; just state the current fact.

Verification: `npm run format:check` (Prettier formats Markdown in this
repo); re-read the edited paragraph against docs/IMPLEMENTATION-PLAN.md §7
and CHANGELOG.md to confirm no remaining inaccuracy.

Work cost-consciously: this is a short, mechanical documentation correction
and suits a low-cost model tier end to end.

Deliverable: a single commit editing only CLAUDE.md's Status paragraph,
with a Conventional Commits message (e.g. `docs: correct CLAUDE.md status
section`), ready for a PR per CLAUDE.md's own workflow.
```

## Prompt for R-05 — Correct the Privacy Policy's "storage isn't available yet" claim

**Bundles:** R-05 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app with a public Privacy
Policy at src/app/privacy/page.tsx. Read CLAUDE.md first for the branch/PR
workflow.

Problem: the "Saving and sharing poems" section of src/app/privacy/page.tsx
tells visitors that poem/account storage "isn't available yet." In fact,
src/lib/poems-store.ts has fully implemented, unflagged save/share/list/load
logic against live Supabase tables, called directly from Editor.tsx, and the
app has already had a production incident confirming it is live. Since the
policy explicitly targets GDPR/NZ Privacy Act compliance, telling a poet
their writing is not being stored server-side when it demonstrably is
matters more than the project's prototype-stage maturity would otherwise
suggest.

Goal (acceptance criteria):
- The "Saving and sharing poems" section is rewritten in present tense to
  accurately state that poem content and account data are stored
  server-side now.
- The adjacent "Your rights" section's deletion promise is checked against
  what deletion mechanism actually exists today. Before editing, check
  whether a self-service "delete poem" action has landed (this is
  recommendation R-12's scope — search src/lib/poems-store.ts for a
  `deletePoem` export and src/components/PoemsDashboard.tsx for a delete
  control). If it has not landed, keep the policy's wording accurate to the
  current email-only deletion path rather than promising a self-service
  capability that doesn't exist yet.

Constraints: Do not alter any other section of the Privacy Policy (e.g. the
sub-processor disclosures, which the review found accurate). Do not
overstate what exists — the goal is accuracy in both directions, not just
removing the "not available" claim.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test`, `npm run build` (this is a React component; confirm it still
renders/builds cleanly). Manually re-read the full page after editing to
confirm no other paragraph now contradicts the change.

Work cost-consciously: the wording change is mechanical, but confirming
what deletion mechanism currently exists requires a real code check, not a
guess — do that check yourself rather than delegating it, since getting it
wrong recreates the exact class of inaccuracy this task exists to fix. This
whole task suits a low-to-mid-cost model tier.

Deliverable: a single commit editing src/app/privacy/page.tsx, with a
Conventional Commits message (e.g. `fix(privacy): correct storage-not-
available claim`), ready for a PR per CLAUDE.md's workflow. Note in the PR
description whether R-12's delete action was found to exist at the time of
writing, since that determines which "Your rights" wording you used.
```

## Prompt for R-06 — Guard against missing Supabase env vars breaking the editor silently

**Bundles:** R-06 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its browser Supabase
client lives in src/lib/supabase-client.ts; the editor component
(src/components/Editor.tsx) is loaded client-only via
`next/dynamic(..., { ssr: false })`, likely from an `EditorClient.tsx`
wrapper in src/components/. Read CLAUDE.md first for the branch/PR workflow.

Problem: supabase-client.ts throws at module-evaluation time if
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset.
Because Editor loads client-only, this throw only fires in the browser:
`npm run dev` with no .env.local starts cleanly and serves HTTP 200 (verified
directly), so a newcomer following README's command order — which sequences
"Environment & secrets" as a separate, later section rather than a
prerequisite before the `npm run dev` row — hits a silently broken editor
pane with no on-screen explanation, visible only in the browser console.

Goal (acceptance criteria):
- A developer who runs `npm run dev` without .env.local configured sees a
  clear, in-app message telling them to copy .env.example and fill in
  Supabase credentials, instead of a silent client-side crash with a blank
  or broken editor pane.
- README.md sequences "Environment & secrets" before the commands table (or
  adds an explicit pointer from the `npm run dev` row to that section), so
  the prerequisite is visible before someone runs the command.

Constraints: Do not change supabase-client.ts's behaviour for the
configured case, and do not weaken the deliberate module-level throw for
other callers — it exists so misconfiguration fails loudly server-side too.
Do not touch supabase-server.ts's lazy-client pattern (it already avoids
this problem for a different reason — Next's page-config collection — leave
it as-is). Keep the added error surface specific to this missing-env-var
case; do not turn it into a generic catch-all error boundary that would mask
other bugs.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test`, `npm run build`. Additionally, manually verify the fix: rename
.env.local aside (or unset the two vars), run `npm run dev`, open the
editor route in a browser, and confirm you see the new actionable message
rather than a blank/broken pane or only a console error. Restore .env.local
afterward.

Work cost-consciously: recognising the specific missing-env-var error and
rendering an actionable message (e.g. via src/app/error.tsx or a check
inside the client wrapper) requires real judgment about where in Next's
render lifecycle to intercept it — this suits a mid-cost model tier. The
README reordering is purely mechanical and suits a low-cost tier; delegate
it separately if using subagents.

Deliverable: a single commit (or a small set of commits) covering both the
in-app error handling and the README reorder, with a Conventional Commits
message (e.g. `fix(dx): surface missing Supabase env vars instead of
silent crash`), ready for a PR per CLAUDE.md's workflow.
```

## Prompt for R-07 — Align Node version across README/`engines`/`.nvmrc`

**Bundles:** R-07 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Read CLAUDE.md first
for the branch/PR workflow.

Problem: package.json pins `engines.node: "22.x"` (required because of a
documented `ERR_REQUIRE_ESM` bug on Node below 22.12, recorded as tech-debt
item TD26071901 — see TECH-DEBT.md and docs/TRIAGE.md for the full
rationale). README.md still says "Requires Node.js >=20.9". No
`.nvmrc`/`.node-version` file exists, so `nvm`/`fnm`/`asdf`/Volta cannot
auto-select the right version, and `.npmrc` has no `engine-strict`.
scripts/setup-linux.sh runs `nvm use node` before every command, which only
resolves correctly once a version file exists.

Goal (acceptance criteria):
- README.md's Node-version line reads "Requires Node.js 22.x" (or the more
  precise `>=22.12` if you confirm that's the true floor from
  TD26071901/TRIAGE.md), matching package.json's `engines.node`.
- A new `.nvmrc` at the repo root contains `22` (or the more precise
  version if you used that above).
- `scripts/setup-linux.sh`'s `nvm use node` is changed to plain `nvm use`
  so it picks up the new `.nvmrc`.

Constraints: Do not change the actual Node version the project targets —
this is a documentation/tooling alignment, not a version bump. Do not add
`engine-strict=true` to `.npmrc` unless you confirm it doesn't break any
existing documented workflow (it is optional per the recommendation; only
add it if you verify it's safe).

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test`, `npm run build`. Additionally, run `nvm use` from the repo root
(if nvm is available in your environment) and confirm it selects Node 22.x
without a human needing to know the number.

Work cost-consciously: this is a small, mechanical alignment across three
files and suits a low-cost model tier end to end.

Deliverable: a single commit touching README.md, .nvmrc (new), and
scripts/setup-linux.sh, with a Conventional Commits message (e.g.
`docs: align Node version across README, engines, and .nvmrc`), ready for a
PR per CLAUDE.md's workflow.
```

## Prompt for R-08 — Route `SignInPrompt` errors through the safe-message convention

**Bundles:** R-08 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its Supabase-backed
data layer is src/lib/poems-store.ts; its sign-in dialog is
src/components/SignInPrompt.tsx, tested by
src/components/SignInPrompt.test.tsx. Read CLAUDE.md first for the
branch/PR workflow.

Problem: src/lib/poems-store.ts wraps every Supabase-backed operation in a
dedicated typed `Error` subclass whose message is documented as safe to
show a poet as-is. src/components/SignInPrompt.tsx does not follow this
convention: at three call sites (around lines 70, 81, 92 — verify current
line numbers before editing) it shows raw `error.message` from Supabase
Auth calls (`signInWithOtp`, `signInWithOAuth`/`signInWithPassword`,
`signUp`) directly to the user, an inconsistency with the rest of the app's
error-handling idiom.

Goal (acceptance criteria):
- Auth errors surfaced in the sign-in dialog follow the same safe-message
  pattern as poems-store.ts: a user-facing message that doesn't leak raw
  Supabase Auth error text, with the original error preserved as `.cause`
  for observability (consistent with how the app already reports errors to
  Sentry server-side — see docs/OBSERVABILITY-PLAN.md for the pattern).
- All three call sites in SignInPrompt.tsx use this mapping.
- SignInPrompt.test.tsx is updated to assert the safe message (not the raw
  Supabase string) is what renders.

Constraints: Do not change the actual auth flows (OTP, OAuth, password,
sign-up) or their success-path behaviour — only the error-message
presentation. Follow poems-store.ts's existing typed-error convention
rather than inventing a new pattern; reuse or closely mirror its structure
(e.g. an `AuthError` class).

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test` (confirm SignInPrompt.test.tsx passes with the new assertions),
`npm run build`.

Work cost-consciously: designing the error-code-to-safe-message mapping
requires judgment (matching Supabase Auth's actual error shapes) and suits
a mid-cost model tier; updating the test file to match is mechanical and
can be delegated to a low-cost tier once the mapping is decided.

Deliverable: a single commit touching SignInPrompt.tsx (and a new
AuthError-style module if you introduce one) plus SignInPrompt.test.tsx,
with a Conventional Commits message (e.g. `fix(auth): route sign-in errors
through safe-message convention`), ready for a PR per CLAUDE.md's workflow.
```

## Prompt for R-09 — Add timeout/abort handling to outbound Supabase calls

**Bundles:** R-09 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its Supabase clients
are created in src/lib/supabase-client.ts (browser) and
src/lib/supabase-server.ts (server, built lazily). Its write operations
(save, share, unshare, allow-remix) live in src/lib/poems-store.ts and are
called from src/components/Editor.tsx. Read CLAUDE.md first for the
branch/PR workflow.

Problem: no Supabase client configures a request timeout or
`AbortController`. `@supabase/postgrest-js`'s built-in retry explicitly
excludes non-idempotent methods (inserts/updates). Editor.tsx sets
`saving = true` before `await savePoem(...)`, cleared only in a `finally`
that never runs if the request neither resolves nor rejects — so a hung
save leaves the UI stuck in "Saving…" indefinitely, bounded only by the
hosting platform's own function timeout, with no error message from the
app's own typed-error path (PoemSaveError etc.).

Goal (acceptance criteria): every write in poems-store.ts (save, share,
unshare, and the allow-remix update — check current exported function
names, e.g. `savePoem`, `sharePoem`, `unsharePoem`, `updateAllowRemix`)
either succeeds, fails with the app's existing typed error, or fails with a
timeout-specific message within a bounded window (e.g. 10–15s) — never
hangs indefinitely from the UI's perspective.

Constraints: Do not change the typed-error class hierarchy's public shape
in a way that breaks existing catch sites in Editor.tsx and
PoemsDashboard.tsx — a timeout should surface through the same typed-error
path they already handle, not a new, uncaught error type. Do not add a
timeout to read operations unless you confirm it's safe for slower
legitimate queries; the recommendation's evidence is specifically about
non-idempotent writes.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test` (add or extend a test that simulates a hung/never-resolving
fetch and asserts the timeout path fires with the expected typed error
within the bounded window — do not rely on a real 10–15s wall-clock wait in
the test; fake timers or a short test-specific timeout constant are
appropriate), `npm run build`.

Work cost-consciously: choosing where to intercept (wrapping `fetch` in
`createClient`'s `global.fetch` option vs. wrapping individual call sites
with `Promise.race`) and translating a timeout into the existing typed-error
classes without breaking other call sites requires real judgment about
control flow and error-handling correctness — do the design and the core
implementation at a mid-to-high-cost model tier. Writing the fake-timer test
once the approach is decided is more mechanical and can run at a lower
tier.

Deliverable: a single commit touching supabase-client.ts/supabase-server.ts
and/or poems-store.ts plus a new or extended test, with a Conventional
Commits message (e.g. `fix(reliability): add timeout handling to Supabase
writes`), ready for a PR per CLAUDE.md's workflow.
```

## Prompt for R-10 — Add tests for `use-session.ts` and `SharedPoemView`'s `escapeHtml`

**Bundles:** R-10 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its auth-state hook is
src/lib/use-session.ts; its server-rendered share page component is
src/components/SharedPoemView.tsx. Read CLAUDE.md first for the branch/PR
workflow.

Problem: src/lib/use-session.ts — the hook gating every owner-scoped,
RLS-backed operation in the app — has no direct test; every consumer test
mocks `useSession` entirely, so its real logic (subscribing to
`auth.getSession`/`auth.onAuthStateChange`, unsubscribing on unmount) is
never executed by the suite. Separately, src/components/SharedPoemView.tsx
has a hand-rolled, non-exported `escapeHtml` function that interpolates a
poet-controlled `title` into a CSP-bearing HTML template with zero test
coverage — attacker-reachable input (the title comes from user-supplied
`.poem` source) into raw HTML with no automated backstop.

Goal (acceptance criteria):
- src/lib/use-session.test.ts exists, mocking the Supabase client's
  `auth.getSession`/`auth.onAuthStateChange` directly (not mocking
  `useSession` itself), and asserts: initial session reflects
  `getSession()`'s result, the session updates on a later `onAuthStateChange`
  event, and the subscription unsubscribes on unmount.
- src/components/SharedPoemView.test.tsx exists, rendering with a title
  containing each of `<`, `>`, `"`, `'`, `&`, and asserts the resulting
  `srcDoc` doesn't break out of the `<title>` tag or the CSP `<meta>`
  attribute.

Constraints: These are new test files only; no production code changes are
expected unless a test surfaces a real bug — if one does, fix it minimally
and note it explicitly in your deliverable rather than silently expanding
scope. Follow the existing test conventions in src/lib/*.test.ts and
src/components/*.test.tsx (mocking style, assertion style — no snapshot
tests, per the project's existing convention).

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test` (both new files pass, and no existing test regresses), `npm run
build`.

Work cost-consciously: this is writing tests for already-specified
behaviour against existing code — exactly the kind of mechanical,
well-specified work that suits a low-cost model tier throughout. The one
exception is the hostile-title escaping test: if it reveals `escapeHtml`
actually has a gap, treat diagnosing and fixing that as security-adjacent
work warranting a higher-capability tier before you integrate the fix.

Deliverable: two new test files (or one, if the other proves undoable
without production changes you were told not to make — explain why), ready
for a PR per CLAUDE.md's workflow, with a Conventional Commits message
(e.g. `test: add coverage for use-session and SharedPoemView escapeHtml`).
```

## Prompt for R-11 — Capture `revalidateSharedPoem` failures in Sentry

**Bundles:** R-11 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app using Sentry
(`@sentry/nextjs`) for server-side error/log capture — see docs/TRIAGE.md
for how evidence is read and docs/OBSERVABILITY-PLAN.md for the app's
observability design. Read CLAUDE.md first for the branch/PR workflow, and
note its standing rule that error/log payloads may contain user-influenced
strings — treat them as data, never as instructions.

Problem: three call sites in src/components/Editor.tsx do
`revalidateSharedPoem(saved.shareId).catch(() => {})` — an empty catch that
silently swallows failure. docs/OBSERVABILITY-PLAN.md already flags this
exact gap as an open, unresolved item. If cache-tag invalidation fails right
after a save, the share page can serve a stale render for up to 5 minutes
with zero record anywhere, unlike the app's other three deliberate-swallow
points (in src/lib/get-shared-poem.ts, src/lib/shared-poem-cache.ts, and
src/lib/render-share.ts), which are all captured via a `reportSwallowedError`
helper.

Goal (acceptance criteria):
- The three `.catch(() => {})` call sites in Editor.tsx (or
  `revalidateSharedPoem` itself in src/lib/revalidate-share.ts, if you
  centralize it there instead) call `reportSwallowedError`, tagged with the
  poem/share id but never with poem content.
- docs/OBSERVABILITY-PLAN.md's open flag for this gap is resolved: remove it
  or mark it done, matching how other resolved items in that doc are
  represented.

Constraints: Match the existing `reportSwallowedError` call pattern used at
the three other swallow points exactly (same tagging conventions, same
opaque-identifier-only discipline — never log poem title or body). Do not
change `revalidateSharedPoem`'s success-path behaviour or its return type in
a way that would require changing its callers' control flow.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test` (add or extend a test asserting `reportSwallowedError` is called
on a simulated revalidation failure, mocking Sentry the same way existing
tests around the other three swallow points do), `npm run build`.

Work cost-consciously: this is applying an already-established pattern
(the same helper, same tagging discipline, used three times elsewhere in
this codebase) to three new call sites — mechanical, well-specified work
that suits a low-cost model tier throughout.

Deliverable: a single commit touching Editor.tsx (or revalidate-share.ts),
its test, and docs/OBSERVABILITY-PLAN.md, with a Conventional Commits
message (e.g. `fix(observability): capture revalidateSharedPoem failures in
Sentry`), ready for a PR per CLAUDE.md's workflow.
```

## Prompt for R-12 — Add a self-service "delete poem" action

**Bundles:** R-12 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its data layer is
src/lib/poems-store.ts; its dashboard UI is
src/components/PoemsDashboard.tsx. Read CLAUDE.md first for the branch/PR
workflow.

Problem: poems-store.ts exports no delete function, and no delete UI exists
in PoemsDashboard.tsx, even though the RLS policy and grant
(`poems_delete_own`) already exist in the Supabase migrations. Today,
deletion is manual: a poet has to email the maintainer, per the wording in
both src/app/privacy/page.tsx and the terms page, with no audit trail.

Goal (acceptance criteria):
- poems-store.ts exports a `deletePoem(id)` function, mirroring the
  existing typed-error convention used by `savePoem`/`sharePoem`/etc. (its
  own typed error subclass, safe user-facing message).
- PoemsDashboard.tsx has a delete action/button per poem, gated behind a
  confirmation step (given it is destructive and irreversible).
- A test covers both the happy path and a confirmation-cancelled path.

Constraints: The delete must be scoped by RLS to the signed-in owner only —
do not add any server-side bypass. Do not implement account-level deletion
(deleting the user's Supabase Auth account); this recommendation is
poem-level only, per its own stated scope — that is a separate, larger
follow-up. Do not remove or weaken the existing `poems_delete_own` RLS
policy/migration; use it as-is.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test`, `npm run build`. Manually verify (or write a test proving) that
attempting to delete a poem you don't own is rejected by RLS, not silently
a no-op that looks like success.

Work cost-consciously: the store function itself is a mechanical
application of the existing typed-error convention and suits a low-to-mid
tier. The confirmation-flow UI and the RLS-ownership check deserve a
mid-to-high-cost tier's attention, since a destructive, irreversible
operation is exactly the kind of correctness-sensitive work where a wrong
first attempt (e.g. a confirmation that can be bypassed, or a delete that
silently no-ops instead of erroring on someone else's poem) is costly to
discover later.

Deliverable: a single commit touching poems-store.ts, PoemsDashboard.tsx,
and a new/extended test file, with a Conventional Commits message (e.g.
`feat(dashboard): add self-service poem deletion`), ready for a PR per
CLAUDE.md's workflow. Note in the PR description that this makes the
Privacy Policy's "delete at any time" promise for poems (see R-05) actually
true.
```

## Prompt for R-13 — Pin exact Supabase CLI / npm versions in CI

**Bundles:** R-13 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app with CI defined in
.github/workflows/. Read CLAUDE.md first for the branch/PR workflow.

Problem: .github/workflows/database.yml installs the Supabase CLI via
`supabase/setup-cli@v3` with `version: latest` in both of its jobs.
.github/workflows/build.yml installs npm via `npm install -g npm@12` — a
floating patch version. Both are the least-pinned parts of an otherwise
carefully version-pinned pipeline (Node itself is exactly pinned), and this
project already hit an npm-version-specific bug once, recorded as
TD26071804 in TECH-DEBT.md.

Goal (acceptance criteria):
- Both jobs in database.yml pin an exact Supabase CLI release tag (replace
  `version: latest`) instead of floating.
- build.yml pins an exact npm version (`npm@12.x.y`) instead of `npm@12`,
  or package.json records the verified major via `"engines": {"npm":
  "12.x"}`.

Constraints: Use the current latest stable release of each tool as the
pinned value — check the Supabase CLI's actual latest release (e.g. via
`gh api repos/supabase/cli/releases/latest`) and the npm version currently
installed by `npm@12` at the time you make this change, rather than
guessing a number. Do not change any other part of either workflow file.

Verification: `npm run format:check` (repo-wide style). Since this is a CI
configuration change, the real verification is CI itself: push the branch
and confirm both database.yml jobs and build.yml's job complete
successfully with the pinned versions (check via `gh run list` /
`gh run view` on the branch's PR, once opened).

Work cost-consciously: this is a mechanical pinning change — look up the
current exact version, substitute it, confirm CI is still green — and suits
a low-cost model tier throughout.

Deliverable: a single commit touching database.yml and build.yml (and
optionally package.json's engines), with a Conventional Commits message
(e.g. `ci: pin exact Supabase CLI and npm versions`), ready for a PR per
CLAUDE.md's workflow.
```

## Prompt for R-14 — Fix parse-error contrast and add a visible share-page heading

**Bundles:** R-14 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its editor is
src/components/Editor.tsx; its public share page is
src/app/share/[share_id]/page.tsx. Read CLAUDE.md first for the branch/PR
workflow.

Problem: two independent accessibility defects. First, Editor.tsx's
parse-error status text uses Tailwind's `text-amber-600` (`#d97706`) in
light mode, which computes to ≈3.18:1 contrast against white — below the
4.5:1 AA threshold that docs/REQUIREMENTS.md's AC76 requires (the dark-mode
variant is fine). Second, src/app/share/[share_id]/page.tsx has no visible
`<h1>` in the page's own DOM outside the sandboxed iframe, unlike every
other route in the app, leaving screen-reader users with no page-level
orientation before entering the framed content.

Before starting: check whether GitHub PR #99 ("feat(a11y): verify and fix
WCAG AA contrast for globals.css tokens (W4)") has already merged — it
changes this exact class to `text-amber-700`. If it has, the first defect
is already fixed; verify the contrast is now compliant and skip straight to
the share-page heading.

Goal (acceptance criteria):
- The parse-error message meets 4.5:1 contrast in both light and dark mode
  (verify by computing the WCAG relative-luminance ratio for whatever
  colour you choose against both the light and dark background, the same
  way the review did — do not eyeball it).
- The share page renders the poem's title as a visible `<h1>` in the page's
  own markup (not only inside the iframe), using the already-derived poem
  title; the iframe's internal title element stays as-is.

Constraints: Prefer a CSS custom property consistent with how the app
already handles related tokens (e.g. `--focus-ring`) over a one-off
Tailwind class, if that pattern fits. Do not change the parse-error
message's wording or trigger condition — only its colour. Do not alter the
iframe's sandboxing, CSP, or internal title.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test`, `npm run build`. Add or extend a test asserting the share
page's rendered output includes an `<h1>` with the poem title text.

Work cost-consciously: both fixes are small and well-specified (a colour
value and a heading element); this whole task suits a low-cost model tier,
except for the contrast-ratio computation itself, which must be done
correctly by formula, not estimated — verify the arithmetic rather than
trusting a plausible-looking hex value.

Deliverable: a single commit touching Editor.tsx and
src/app/share/[share_id]/page.tsx (plus any shared CSS/token file), with a
Conventional Commits message (e.g. `fix(a11y): parse-error contrast and
share-page heading`), ready for a PR per CLAUDE.md's workflow.
```

## Prompt for R-15 — Document the local-only Supabase dev workflow in README

**Bundles:** R-15 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app backed by Supabase.
Read CLAUDE.md first for the branch/PR workflow.

Problem: README.md's "Environment & secrets" section only describes
filling .env.local from a live Supabase cloud project's dashboard. But
supabase/config.toml and the migrations under supabase/ fully support a
zero-cloud `supabase start` local dev loop, already used by
.github/workflows/database.yml's `test` job and package.json's `test:db`
script — this path is real and exercised in CI, just undocumented for
humans.

Goal (acceptance criteria): README documents both paths — the existing
cloud-project path unchanged, plus a short new "Local-only Supabase"
subsection describing `supabase start` and pointing .env.local at its
printed local URL/anon key.

Constraints: Do not remove or restructure the existing cloud-project
instructions. Keep the addition short — a subsection, not a rewrite of the
"Environment & secrets" section.

Verification: `npm run format:check`. Manually verify the instructions work
if the Supabase CLI is available in your environment: run `supabase start`
and confirm the printed local URL/anon key match what you tell readers to
put in .env.local.

Work cost-consciously: this is a short, mechanical documentation addition
and suits a low-cost model tier end to end.

Deliverable: a single commit editing README.md, with a Conventional
Commits message (e.g. `docs: document local-only Supabase dev workflow`),
ready for a PR per CLAUDE.md's workflow.
```

## Prompt for R-16 — Add `CONTRIBUTING.md` and PR/issue templates

**Bundles:** R-16 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its contribution
workflow (branch naming, commit format, PR-only changes) is documented in
CLAUDE.md, framed as agent operating instructions. Read CLAUDE.md in full
now — you will point to, not duplicate, its "Branch workflow" and "Commit
messages" sections.

Problem: no CONTRIBUTING.md, .github/PULL_REQUEST_TEMPLATE.md, or
.github/ISSUE_TEMPLATE/ exists anywhere in the repo. GitHub's own
contribution-guide UI affordances (the banner shown when opening a new
issue/PR) don't pick up CLAUDE.md, so a human contributor has no
canonical, discoverable entry point even though the workflow itself is
well specified.

Goal (acceptance criteria):
- A short root CONTRIBUTING.md exists, discoverable via GitHub's UI,
  pointing to CLAUDE.md's "Branch workflow" and "Commit messages" sections
  rather than duplicating their content.
- .github/PULL_REQUEST_TEMPLATE.md exists with a Conventional Commits
  title reminder and a test-plan checklist.
- .github/ISSUE_TEMPLATE/*.yml forms are added only if you judge issue
  volume currently warrants them (per the recommendation, this is
  optional — a bare CONTRIBUTING.md + PR template alone satisfies the core
  goal).

Constraints: CONTRIBUTING.md must be a pointer document, not a duplicate of
CLAUDE.md — if you find yourself restating branch/commit rules in detail,
you're duplicating; link instead. Do not alter CLAUDE.md itself.

Verification: `npm run format:check`. Manually confirm CONTRIBUTING.md
renders sensibly and the PR template's checkboxes are valid GitHub Markdown
task-list syntax.

Work cost-consciously: this is short, templated documentation work and
suits a low-cost model tier end to end.

Deliverable: new files CONTRIBUTING.md and
.github/PULL_REQUEST_TEMPLATE.md (and optionally .github/ISSUE_TEMPLATE/),
with a Conventional Commits message (e.g. `docs: add CONTRIBUTING.md and PR
template`), ready for a PR per CLAUDE.md's workflow.
```

## Prompt for R-17 — Document the CODEOWNERS single-reviewer reality

**Bundles:** R-17 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app whose branch-protection
ruleset requires one approving code-owner review per CLAUDE.md's "Branch
workflow" section (read it first, along with the repo's CODEOWNERS file).

Problem: CODEOWNERS lists two GitHub accounts, `@warwickallen` and
`@Warwick-Allen`, both of which satisfy the ruleset's code-owner-review
requirement. Evidence (review authorship on merged PRs, `mergedBy`, the
LICENCE copyright holder, and CLAUDE.md's own recorded git user "Warwick
Allen") indicates both accounts belong to the same individual — so the
"independent review" the ruleset implies is procedurally self-approval
through an alternate account. This matters more here than in a typical
solo repo because CLAUDE.md names PR review as the primary control on
autonomous-agent output.

Goal (acceptance criteria): this reality is stated explicitly somewhere a
reader of CLAUDE.md or CODEOWNERS would find it — e.g. a short note in
CLAUDE.md's governance-adjacent section, or a comment above the relevant
lines in CODEOWNERS — so the control's actual strength (a single-human
checkpoint under two accounts, pending a second genuine reviewer as the
project grows) is represented accurately rather than implying independent-
reviewer coverage it doesn't currently have.

Constraints: No code change. Do not remove either account from CODEOWNERS
or otherwise change how review is enforced — this recommendation is about
disclosure, not about changing the control itself.

Verification: `npm run format:check`.

Work cost-consciously: this is a short, mechanical documentation note and
suits a low-cost model tier end to end.

Deliverable: a single commit adding a short note to CLAUDE.md and/or a
comment in CODEOWNERS, with a Conventional Commits message (e.g. `docs:
document CODEOWNERS single-reviewer reality`), ready for a PR per
CLAUDE.md's workflow.
```

## Prompt for R-18 — Trim the historical-narrative blockquote from OBSERVABILITY-PLAN.md

**Bundles:** R-18 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Read CLAUDE.md first,
in particular its "Documentation principles" section: all docs except
CHANGELOG.md must describe current state only, with historical
"previously.../fixed by..." narration reserved for CHANGELOG.md.

Problem: docs/OBSERVABILITY-PLAN.md embeds a dated "Update (2026-07-19)"
blockquote that narrates, past-tense, the jsdom `ERR_REQUIRE_ESM`
incident's resolution — exactly the phrasing CLAUDE.md's principles ban
outside CHANGELOG.md. The same incident is already fully narrated in
CHANGELOG.md and in TECH-DEBT.md's TD26071901 entry, so this is a third,
drifting retelling, not new information.

Goal (acceptance criteria): docs/OBSERVABILITY-PLAN.md states the current
mitigation (the jsdom version pin) as a one-line as-built fact, linking to
TD26071901 for the history, rather than re-narrating the incident in a
dated blockquote.

Constraints: Before trimming, confirm CHANGELOG.md's existing entry for
this incident already carries the full narrative (the recommendation
states it does) — if you find it doesn't, do not silently drop information;
flag that in your deliverable instead of proceeding. Do not touch any other
part of OBSERVABILITY-PLAN.md.

Verification: `npm run format:check`.

Work cost-consciously: this is a small, mechanical trim-and-link edit and
suits a low-cost model tier end to end.

Deliverable: a single commit editing docs/OBSERVABILITY-PLAN.md, with a
Conventional Commits message (e.g. `docs: trim historical narrative from
OBSERVABILITY-PLAN.md`), ready for a PR per CLAUDE.md's workflow.
```

## Prompt for R-19 — Add a `poetic`-release freshness-check workflow

**Bundles:** R-19 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app that depends on the
sibling `poetic` framework (repo `Poetic-Poems/poetic`) as a tag-pinned
GitHub release-tarball dependency in package.json — see CLAUDE.md's
"Relationship to the Poetic framework" section, which you must read first,
for why this is a deliberate, non-Dependabot-trackable pin. The repo already
has a scheduled-diff workflow pattern to mirror: read
.github/workflows/td-tooling-drift.yml in full before writing the new
workflow.

Problem: because `poetic` installs from a pinned release-tarball URL,
Dependabot's npm updater cannot track it. No script or workflow currently
polls Poetic-Poems/poetic's releases for a newer tag than the one pinned in
package.json, so a new upstream release — the dependency where currency
matters most, since it's Fiddle's single source of truth for `.poem`
rendering — would sit undetected indefinitely.

Goal (acceptance criteria): a new scheduled GitHub Actions workflow, on a
weekly `schedule` trigger, reads the pinned `poetic` version from
package.json, queries `gh api repos/Poetic-Poems/poetic/releases/latest`
(or the GitHub API equivalent), and opens an issue naming both versions
when they diverge — mirroring td-tooling-drift.yml's existing pattern
closely enough that a future maintainer recognizes the shared idiom.

Constraints: Do not have this workflow auto-bump the dependency or open a
PR — per CLAUDE.md, bumping the `poetic` pin is "a deliberate package.json
edit, never a silent float," so this workflow's job is detection
(issue-opening) only, matching the recommendation's own scope. Do not
modify td-tooling-drift.yml itself; only read it as a template.

Verification: `npm run format:check` for repo-wide style (YAML formatting,
if Prettier covers it here — check .prettierrc's file coverage). Validate
the workflow YAML is well-formed (e.g. `actionlint` if available, or a
careful manual read against td-tooling-drift.yml's structure). Since a
scheduled workflow can't be fully exercised locally, describe in your
deliverable how you'd manually trigger it once (e.g. via
`workflow_dispatch` if you add that trigger, or by temporarily changing the
schedule) to confirm it runs end-to-end before relying on the weekly
schedule.

Work cost-consciously: this closely mirrors an existing, working pattern in
the same repo, which lowers its risk — but adapting the diff logic
correctly (comparing package.json's pinned tarball URL/version against a
live GitHub API response) still requires real care to avoid false
positives/negatives, so treat the core logic as mid-cost-tier work; the
YAML scaffolding itself, once the pattern is understood, is mechanical.

Deliverable: a new workflow file (e.g.
.github/workflows/poetic-freshness-check.yml), with a Conventional Commits
message (e.g. `ci: add poetic-release freshness-check workflow`), ready for
a PR per CLAUDE.md's workflow.
```

## Prompt for R-20 — Reconcile CHANGELOG.md and GitHub release notes at release time

**Bundles:** R-20 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app with a release
workflow at .github/workflows/release.yml and a hand-maintained
CHANGELOG.md (Keep a Changelog format, per CLAUDE.md's "Documentation
principles" — read CLAUDE.md first).

Problem: release.yml creates each GitHub release with `--generate-notes`
(PR-title bullets auto-generated by GitHub), entirely independent of
CHANGELOG.md's manually curated `[Unreleased]` section. Nothing keeps the
two in sync, and they have already begun to diverge in spirit: CHANGELOG.md
lists substantially more shipped work than the one existing tagged release
describes, and package.json's version (0.1.0) still matches that sole tag.

Goal (acceptance criteria): either (a) release.yml's GitHub release body is
generated from CHANGELOG.md's section for the version being tagged
(dropping `--generate-notes` in favour of `gh release create
--notes-file`, reading the relevant `## [X.Y.Z]` or `## [Unreleased]`
section), or (b) a CI check (in build.yml or a new job) flags a
version-bump PR whose CHANGELOG.md still has content under `[Unreleased]`
after the bump, forcing the rename before a tag can be cut. Pick whichever
approach fits release.yml's existing structure with less disruption, and
say which you chose and why.

Constraints: Do not change release.yml's versioning/tagging logic, which
the review found "coherent and race-safe against re-runs" — only the notes
source. Do not rewrite CHANGELOG.md's existing entries; this is a
process/tooling fix, not a content edit.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test`, `npm run build` (if any script logic changes). For the release
workflow change specifically, you cannot safely cut a real release to test
it — instead, extract the notes-parsing logic into a small script or inline
step and test it locally against the actual current CHANGELOG.md content
(e.g. `node -e "..."` or a short test script) to confirm it correctly
extracts the right section before wiring it into release.yml.

Work cost-consciously: the CHANGELOG-section-extraction logic (matching a
heading, extracting its body) is well-specified but has real edge cases
(first release with no prior version heading, an empty `[Unreleased]`
section) — treat it as mid-cost-tier work and test it directly against the
real file rather than a synthetic fixture.

Deliverable: a single commit touching release.yml (and/or a new CI check),
with a Conventional Commits message (e.g. `ci: reconcile CHANGELOG.md with
GitHub release notes`), ready for a PR per CLAUDE.md's workflow.
```

## Prompt for R-21 — Extract Editor.tsx's persistence/session orchestration into a hook

**Bundles:** R-21 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its editor component,
src/components/Editor.tsx, is the repo's largest and highest-fan-out
module. Read CLAUDE.md first for the branch/PR workflow.

Problem: Editor.tsx is 581 lines and owns 13 `useState`/`useRef` hooks,
session-migration state-machine logic run during render, anonymous draft
persistence, debounced client-side rendering, and four independent
Supabase-backed data-mutation flows (save, share, unshare, allow-remix
against src/lib/poems-store.ts's `savePoem`/`sharePoem`/`unsharePoem`/
`updateAllowRemix`), each with its own loading/error state — five distinct
concerns in one component. It is currently well-tested (six
`Editor.*.test.tsx` files) and well-commented, so this is not undocumented
tangling, but it is the one real god-object risk as more features land, and
the established pattern so far has been to keep adding orchestration
directly into this file.

Goal (acceptance criteria): the non-presentational state machine (session
migration, draft adoption, and the four persistence flows) lives in one or
more dedicated hooks (e.g. `usePoemPersistence`), leaving Editor.tsx closer
to a presentation component that consumes that hook's state and handlers.
All six existing `Editor.*.test.tsx` files continue to pass, adjusted only
for the new import surface (e.g. mocking the new hook instead of, or in
addition to, poems-store.ts directly) — not for changed behaviour.

Constraints: This must be a pure refactor — no behavioural change, no
change to the four flows' external effects (what gets called, in what
order, on what user action), no change to error messages shown to the
user. Do not change poems-store.ts's public API. Extract incrementally:
one handler/concern at a time, running the full existing Editor test suite
after each step, rather than one large rewrite — this bounds the risk of a
subtle regression slipping through unnoticed in a big diff.

Verification: after each incremental extraction step, run `npm test` and
confirm all six Editor.*.test.tsx files still pass before proceeding to the
next piece. When the extraction is complete, run the full suite: `npm run
lint`, `npm run typecheck`, `npm run format:check`, `npm test`, `npm run
build`.

Work cost-consciously: this is a cross-cutting, design-level refactor of
the repo's most complex component — do the extraction design and the core
hook implementation at a high-capability model tier, since a wrong
abstraction boundary here is expensive to unwind later. You may delegate
narrow, well-specified sub-steps (e.g. "move this one handler and its
associated state into the new hook, keeping behaviour identical, and confirm
tests still pass") to a mid-cost tier once you've defined the target shape,
but review each delegated step's diff yourself before moving to the next.

Deliverable: a small series of commits (one per incremental extraction
step is fine, or squashed into one coherent commit if you prefer), with a
Conventional Commits message (e.g. `refactor(editor): extract persistence
orchestration into usePoemPersistence`), ready for a PR per CLAUDE.md's
workflow. Summarize in the PR description which concerns moved into which
hook(s) and confirm test coverage was preserved, not just re-passed.
```

## Prompt for R-22 — Add a cross-tool-seam test for the Analysis-toggle DOM wiring

**Bundles:** R-22 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app that renders `.poem`
source via the upstream `poetic` package (imported from `poetic/browser`).
Its DOM-wiring logic for `{Analysis}` blocks lives in
src/components/PoemPreview.tsx's `wireAnalysisToggles` function (lines
17–62), shared by the live preview and, indirectly, the SSR share page
(src/components/SharedPoemView.tsx). Read CLAUDE.md first for the
branch/PR workflow, and note its rule that the `.poem` renderer must never
be forked or reimplemented in this repo — it comes from the `poetic`
package.

Problem: `wireAnalysisToggles`'s only test, in
src/components/PoemPreview.test.tsx, builds hand-authored
`ANALYSIS_HTML`/`SELECTOR_HTML` fixture strings rather than running real
`.poem` source through `renderPoem()`/DOMPurify. By contrast, the other
side of the same pipeline, src/lib/render-share.test.ts, imports the real
`poetic/browser` package and renders real source. This is exactly the
cross-tool-seam gap the review's checklist flags: the producer (poetic's
Pug template markup) and consumer (Fiddle's DOM-wiring assumptions) are
each tested only against their own side's assumptions. Two prior
production incidents (TECH-DEBT.md's TD26071401 and TD26071602) already
happened in exactly this seam, both previously worked around the same
hand-authored way this test still uses.

Goal (acceptance criteria): at least one test pipes real `.poem` source
containing an `{Analysis}` block through `renderPoem()` (and, for the share
path, through `sanitizeSharedPoemHtml` — check the actual exported name in
src/lib/render-share.ts) and then runs `wireAnalysisToggles` against that
real output, so that a future `poetic` release renaming an Analysis
class/id fails this test instead of silently breaking both preview
surfaces with CI green.

Constraints: Do not delete the existing hand-authored fixture test unless
the new real-render test makes it fully redundant — prefer supplementing
over replacing unless you confirm no coverage is lost. Do not modify
`wireAnalysisToggles` itself as part of this task; this is a test-only
addition unless the new test reveals a real bug, in which case fix it
minimally and call it out explicitly.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test` (the new test must actually exercise real poetic output — verify
by temporarily breaking `wireAnalysisToggles`'s selector and confirming the
new test fails, then revert), `npm run build`.

Work cost-consciously: this closely mirrors render-share.test.ts's existing
pattern (real `poetic/browser` import, real render) — well-specified,
low-to-mid-cost-tier work. Confirming the test actually catches the class
of regression it's meant to (the temporary-break check above) is the one
step worth doing carefully yourself rather than trusting a subagent's
say-so.

Deliverable: a new or extended test in PoemPreview.test.tsx (or a new test
file), with a Conventional Commits message (e.g. `test: exercise
Analysis-toggle wiring against real poetic output`), ready for a PR per
CLAUDE.md's workflow.
```

## Prompt for R-23 — Debounce draft-autosave localStorage writes

**Bundles:** R-23 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its editor's
change-handling logic is in src/components/Editor.tsx's `handleChange`.
Read CLAUDE.md first for the branch/PR workflow.

Problem: `saveDraft` runs synchronously on every keystroke inside
`handleChange`, while the more expensive `renderPoem()` call one line below
it is deliberately debounced to 200ms. The cheaper-per-call operation
(render) is throttled while the costlier synchronous one (localStorage
I/O) isn't — not currently user-visible at this app's typical poem sizes,
but a real asymmetry worth correcting before it is.

Goal (acceptance criteria): `saveDraft` runs on the same (or a similarly
short) debounce as the render call in `handleChange`, so keystroke-to-paint
latency no longer pays for a synchronous storage write on every character.

Constraints: Do not increase draft-loss risk on rapid typing beyond what's
reasonable — if you judge the render debounce's window too long for safe
draft persistence, give `saveDraft` its own short-interval debounce instead
of literally reusing the render one, and say which you chose and why. Do
not change `renderPoem()`'s own debounce behavior.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test` (confirm existing Editor tests around draft persistence still
pass, adjusting timer-based assertions — e.g. `vi.useFakeTimers()` — if the
debounce window changed), `npm run build`.

Work cost-consciously: this is a small, well-specified change (fold one
call into an existing debounce block) and suits a low-cost model tier end
to end.

Deliverable: a single commit editing Editor.tsx (and its test if timer
assertions needed adjusting), with a Conventional Commits message (e.g.
`perf(editor): debounce draft-autosave localStorage writes`), ready for a
PR per CLAUDE.md's workflow.
```

## Prompt for R-24 — Code-quality quick wins

**Bundles:** R-24 only (three independent mechanical refactors bundled under one recommendation in the source review; each is separately verifiable) · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Read CLAUDE.md first
for the branch/PR workflow.

Problem: three independent, low-severity code-quality issues:
1. Six test files — Editor.open/.remix-permission/.remix/.save/.share/.test.tsx
   under src/components/ — repeat identical `vi.mock(...)` blocks, an
   identical `SESSION` fixture constant, and an identical `beforeEach`, with
   no shared helper module. Three of the six already mock a slightly
   different subset of poems-store.ts functions from the boilerplate they
   otherwise share verbatim.
2. The expression `err instanceof Error ? err.message : String(err)` is
   duplicated verbatim 10 times: 7 call sites in src/components/Editor.tsx,
   3 in src/components/PoemsDashboard.tsx.
3. The same page-header JSX is inlined independently in src/app/page.tsx,
   src/app/poems/[id]/page.tsx, and src/app/poems/page.tsx.

Goal (acceptance criteria):
1. Shared test mocks/fixtures/`beforeEach` are factored into one
   `editor-test-support.ts` helper (or similarly named module) that all six
   Editor.*.test.tsx files import from, preserving each file's own
   per-test mock overrides where they currently diverge.
2. A one-line `errorMessage(err: unknown): string` helper replaces all 10
   duplicated inline expressions.
3. A `PageHeader` component is extracted and used by the three route
   files, if you judge (per the recommendation) that a fourth route
   needing it isn't a precondition — this item is explicitly "not required
   immediately" per the recommendation, so completing items 1–2 alone is an
   acceptable partial delivery if you choose to defer item 3; say so
   explicitly if you do.

Constraints: These are pure refactors — no behavioural change to any test
assertion's meaning, no change to any error message shown to a user, no
visible change to any page header's rendered output. Do each of the three
independently and verify after each before moving to the next, so a
problem in one doesn't block landing the other two.

Verification: after each of the three sub-changes, run `npm run lint`,
`npm run typecheck`, `npm run format:check`, `npm test`, `npm run build`
and confirm all six Editor.*.test.tsx files and PoemsDashboard's tests
still pass with unchanged assertions (only their setup should differ).

Work cost-consciously: all three are mechanical, well-specified refactors
(consolidate duplicated code behind a shared symbol) and suit a low-cost
model tier throughout; this is a good candidate for delegating each of the
three sub-tasks to a separate low-cost-tier subagent run in sequence, since
they touch non-overlapping files.

Deliverable: up to three commits (one per sub-change, or combined), with
Conventional Commits messages (e.g. `refactor(test): extract shared Editor
test support`, `refactor: add errorMessage helper`, `refactor(ui): extract
PageHeader component`), ready for a PR (or three small PRs) per CLAUDE.md's
workflow. State clearly which of the three you completed.
```

## Prompt for R-25 — Security polish

**Bundles:** R-25 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its sign-in dialog is
src/components/SignInPrompt.tsx; its share-cache revalidation entry point
is `revalidateSharedPoem` in src/lib/revalidate-share.ts. Read CLAUDE.md
first for the branch/PR workflow.

Problem: two low-severity security items. First, `revalidateSharedPoem` has
no authorization check on the share id before invalidating that page's
cache tag — low-impact given `share_id` is a 122-bit random token (knowing
it already lets an attacker view that page), but worth a documented design
note rather than silence. Second, SignInPrompt.tsx sets `minLength={6}` on
its password field (currently line 160 — verify before editing), mirroring
Supabase Auth's own default minimum, with no strength guidance shown to the
user.

Goal (acceptance criteria):
- No code change is required for `revalidateSharedPoem` itself — instead,
  add a short design-note comment near its definition (or in
  docs/OBSERVABILITY-PLAN.md / a relevant security doc) stating that it
  intentionally has no per-request authorization check today because of the
  token's entropy, and that this should be revisited if the pattern is ever
  reused for a less entropy-rich identifier.
- SignInPrompt.tsx's password `minLength` is raised from 6 to at least 8
  (the recommendation suggests 8–10; pick a value and justify it briefly in
  your deliverable).

Constraints: Do not add a full authorization system to
`revalidateSharedPoem` — the recommendation is explicit that no change is
required there beyond documentation, given the entropy argument. Do not
change the sign-up flow's other fields or validation logic beyond
`minLength`.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test` (update SignInPrompt.test.tsx if it asserts the old minLength
value), `npm run build`.

Work cost-consciously: the `minLength` change is trivially mechanical
(low-cost tier). The design-note wording for `revalidateSharedPoem`
requires understanding the actual threat model (entropy vs. authorization)
well enough to state it accurately — do that part yourself or delegate to
a mid-cost tier, not a low one, since a wrong security rationale written
down is worse than none.

Deliverable: a single commit touching SignInPrompt.tsx (and its test) plus
a short comment/doc addition near revalidate-share.ts, with a Conventional
Commits message (e.g. `fix(security): raise password minLength, document
revalidateSharedPoem authorization design`), ready for a PR per CLAUDE.md's
workflow.
```

## Prompt for R-26 — Add test coverage tooling and a watch-mode script

**Bundles:** R-26 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app using Vitest, configured
in vitest.config.ts. Read CLAUDE.md first for the branch/PR workflow.

Problem: no coverage tool is configured anywhere in the toolchain — no
`test.coverage` block in vitest.config.ts, no coverage dependency. This is
also plausibly how two real test gaps (this review's F-TEST-01, F-TEST-02 —
see recommendation R-10) went unnoticed: a coverage report would have
surfaced both automatically. Separately, package.json's only test script is
a single-shot `"test": "vitest run"`, with no watch-mode script for local
iteration.

Goal (acceptance criteria):
- `@vitest/coverage-v8` is installed as a devDependency and wired into
  vitest.config.ts (or a new `coverage` script's flags) so `npm run
  coverage` produces a coverage report.
- package.json gains `"coverage": "vitest run --coverage"` and
  `"test:watch": "vitest"` scripts.
- Coverage is surfaced (e.g. printed in CI logs or uploaded as an artifact)
  but not required to be gated on a threshold — the recommendation does not
  ask for a coverage gate, only visibility.

Constraints: Do not add a coverage-percentage gate/threshold that could
fail CI — that's explicitly out of scope per the recommendation ("surfaced,
not necessarily gated"). Do not change the existing `test` script's
behaviour.

Verification: `npm install -D @vitest/coverage-v8`, then run `npm run
coverage` once and confirm it produces a report without error; run `npm run
test:watch` briefly (e.g. start it, confirm it picks up file changes, then
exit) to confirm it works. Then the standard suite: `npm run lint`, `npm run
typecheck`, `npm run format:check`, `npm test`, `npm run build`.

Work cost-consciously: this is installing and wiring a well-documented,
standard tool per its own docs — mechanical, low-cost-tier work throughout.

Deliverable: a single commit touching package.json, package-lock.json, and
vitest.config.ts, with a Conventional Commits message (e.g. `test: add
coverage tooling and watch-mode script`), ready for a PR per CLAUDE.md's
workflow.
```

## Prompt for R-27 — Document the undocumented TypeScript/ESLint major-version holds

**Bundles:** R-27 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its tech-debt register
is TECH-DEBT.md at the repo root — read its "Claiming an item" workflow and
ID-allocation rules (via scripts/next-tech-debt-id.pl) before adding
anything to it. Read CLAUDE.md first too, in particular its "Tech debt"
section.

Problem: package.json pins `typescript` at `^5` (two majors behind the
latest `7.0.2`) and `eslint` at `^9` (one major behind the latest `10.7.0`).
Dependabot proposed both bumps (PR #9 and #10) and both were closed
unmerged with no recorded reason — unlike the jsdom major-version hold,
which TECH-DEBT.md documents thoroughly as TD26071901. This leaves no
institutional memory of whether holding these was a deliberate risk call or
an oversight.

Goal (acceptance criteria): either (a) the current-generation major bumps
are merged, after trialling them and confirming they're low-risk, or (b) a
TECH-DEBT.md entry (or a `dependabot.yml` ignore-rule comment) documents
specifically why each is held, in the same style/precision as TD26071901.

Constraints: Do not merge a bump that breaks lint/typecheck/test/build —
if a trial fails, that failure itself is the content of the new
TECH-DEBT.md entry (be specific about what broke, not just "it failed").
If you add a TECH-DEBT.md entry, get its ID from
`scripts/next-tech-debt-id.pl` — do not hand-assign an ID.

Verification: in a throwaway local state, run `npm install typescript@latest`
and separately `npm install eslint@latest` (test each independently, not
combined, so a failure is attributable), then `npm run lint`, `npm run
typecheck`, `npm run format:check`, `npm test`, `npm run build` after each.
If both are clean, merge both bumps together and re-run the full suite once
more. If either isn't clean, revert that one specifically and document the
concrete breakage in TECH-DEBT.md.

Work cost-consciously: running the trials and reading their output is
mechanical, low-cost-tier work. Deciding whether a given lint/type error
surfaced by the trial is a real, load-bearing breaking change versus a
trivially fixable false alarm requires judgment — do that assessment at a
mid-cost tier rather than reverting reflexively on the first red result.

Deliverable: either an upgrade commit (both packages bumped, full suite
green) or a documentation-only commit (a new TECH-DEBT.md entry with a
freshly allocated ID explaining the hold), with a Conventional Commits
message (e.g. `chore(deps): bump typescript and eslint to current major`
or `docs: document typescript/eslint major-version hold`), ready for a PR
per CLAUDE.md's workflow.
```

## Prompt for R-28 — README/tooling polish

**Bundles:** R-28 only (three independent small edits bundled under one recommendation in the source review) · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Read CLAUDE.md first
for the branch/PR workflow.

Problem: three independent, low-severity tooling/doc gaps:
1. README.md's commands table omits `npm start` and `npm run test:db`,
   both real scripts in package.json.
2. scripts/setup-linux.sh (the WSL npm-shadowing workaround) is documented
   only in its own header comment and in .claude/skills/td/SKILL.md — an
   agent-only file, not human-facing — so a human contributor on WSL has no
   signpost to it.
3. scripts/sync-poetic-css.mjs's postinstall step calls
   `require.resolve(...)` at line 16 with no `try`/`catch`, so it fails
   with a raw Node stack trace instead of an actionable message if
   `poetic`'s CSS export path ever changes.

Goal (acceptance criteria):
1. README's commands table has rows for `start` and `test:db`, including
   `test:db`'s prerequisite (the Supabase CLI).
2. README has a one-line pointer to scripts/setup-linux.sh for WSL users.
3. sync-poetic-css.mjs wraps its `require.resolve` call in `try`/`catch`
   and rethrows with a message naming the pinned `poetic` version, so a
   future failure points at the actual cause.

Constraints: Item 3 must preserve the script's current successful-path
behaviour exactly — only the failure path changes. Do these three
independently; a problem in one shouldn't block the other two.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test`, `npm run build`. For item 3 specifically, verify the new error
message manually by temporarily pointing `require.resolve` at a
nonexistent path and confirming you get the new actionable message instead
of a raw stack trace, then revert that temporary change.

Work cost-consciously: all three are small, mechanical edits (two
documentation, one error-handling wrap) and suit a low-cost model tier
throughout.

Deliverable: up to three commits (one per item, or combined), with
Conventional Commits messages (e.g. `docs: add missing scripts to README
commands table`, `docs: point WSL users to setup-linux.sh`, `fix(tooling):
actionable error message in sync-poetic-css.mjs`), ready for a PR (or three
small PRs) per CLAUDE.md's workflow.
```

## Prompt for R-29 — Editor/dashboard loading & feedback polish

**Bundles:** R-29 only (three independent small UX fixes bundled under one recommendation in the source review) · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Its editor and
dashboard load via `next/dynamic(..., { ssr: false })` wrapper components
(EditorClient.tsx, PoemsDashboardClient.tsx, under src/components/); its
auth-state hook is src/lib/use-session.ts; its sign-in dialog is
src/components/SignInPrompt.tsx. Read CLAUDE.md first for the branch/PR
workflow.

Problem: three independent, low-severity UX gaps:
1. EditorClient.tsx and PoemsDashboardClient.tsx pass no `loading` fallback
   to `next/dynamic`, so on slow connections the page shows a blank gap
   until client JS hydrates, despite the app already having a "Loading…"
   pattern used elsewhere.
2. src/lib/use-session.ts's `session` state starts at `null` and resolves
   asynchronously; consumers (e.g. Editor.tsx) treat `null` as
   "signed out" with no separate loading state, so an already-signed-in
   poet clicking Save/Share before session resolution can see a confusing,
   false sign-in prompt.
3. SignInPrompt.tsx only disables its buttons during a pending request —
   there is no visible "in progress" text/status, unreliable feedback for
   screen-reader and low-attention users.

Goal (acceptance criteria):
1. EditorClient.tsx and PoemsDashboardClient.tsx pass a `loading` fallback
   to `next/dynamic` reusing the app's existing "Loading…" pattern.
2. `useSession()`'s return value gains a loading indicator — e.g. a
   `"loading" | "signed-in" | "signed-out"` union or a boolean `isLoading`
   — and Editor.tsx (and any other consumer gating Save/Share on session
   state) uses it to avoid presenting a sign-in prompt before resolution.
3. SignInPrompt.tsx shows pending-state text (e.g. "Sending…") during a
   request, in addition to the existing disabled-button behaviour.

Constraints: Item 2 changes `useSession()`'s return shape — update every
consumer (search for all `useSession(` call sites, not just Editor.tsx) and
every test that mocks it, so nothing silently breaks on the new shape. Do
each of the three independently where possible.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test` (pay particular attention to any test mocking `useSession` —
confirm all such mocks and their assertions are updated for the new return
shape), `npm run build`.

Work cost-consciously: item 1 and item 3 are small and mechanical
(low-cost tier). Item 2 touches a shared hook's public return shape used
across the app and needs a full sweep of consumers to avoid a missed
call site — treat it as mid-cost-tier work and verify the sweep is
complete (grep for `useSession(` across src/) rather than relying on
TypeScript alone to catch every case, since a loosely-typed consumer could
silently compile.

Deliverable: up to three commits (one per item, or combined), with
Conventional Commits messages (e.g. `feat(ui): add loading fallback to
Editor/Dashboard`, `feat(auth): add loading state to useSession`, `feat(ui):
add pending-state feedback to sign-in form`), ready for a PR (or several
small PRs) per CLAUDE.md's workflow.
```

## Prompt for R-30 — Doc polish

**Bundles:** R-30 only (two independent doc edits bundled under one recommendation in the source review) · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app deployed live at
www.poeticfiddle.com (per CHANGELOG.md). Read CLAUDE.md first, in
particular its "Documentation principles" section.

Problem: two independent, low-severity documentation gaps:
1. docs/TRIAGE.md and docs/SENTRY-AGENT-ACCESS.md both narrate rejected
   alternatives in past-tense story form ("was trialled and
   dropped/removed/abandoned"), with no as-built exemption from CLAUDE.md's
   rule against "previously.../used to..." phrasing in docs other than
   CHANGELOG.md.
2. README.md never links the live app, even though CHANGELOG.md documents
   it as deployed at www.poeticfiddle.com.

Goal (acceptance criteria):
1. Both runbooks state each rejected alternative as a one-line "Rejected:
   X (reason)" rather than a narrated story, preserving the reason but
   dropping the past-tense narrative framing.
2. README.md has a one-line "Live at www.poeticfiddle.com" (or similar)
   near the top.

Constraints: Do not remove the substance of why an alternative was
rejected — only its narrative framing. Do not alter any other content in
TRIAGE.md or SENTRY-AGENT-ACCESS.md.

Verification: `npm run format:check`. Manually re-read both runbooks after
editing to confirm the rejected-alternatives sections are still
informative, just terser.

Work cost-consciously: both edits are short and mechanical; this whole task
suits a low-cost model tier end to end.

Deliverable: up to two commits (one per item, or combined), with
Conventional Commits messages (e.g. `docs: trim rejected-alternatives
narration in TRIAGE.md and SENTRY-AGENT-ACCESS.md`, `docs: link live app in
README`), ready for a PR per CLAUDE.md's workflow.
```

## Prompt for R-31 — Document backup/restore and export/delete runbooks

**Bundles:** R-31 only (two independent doc additions bundled under one recommendation in the source review) · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app backed by a Supabase
Pro project. Read CLAUDE.md first, and read docs/TRIAGE.md as the style
model for precision this recommendation asks you to match.

Problem: two independent, low-severity documentation gaps. First, no
document states the Supabase Pro project's actual backup/PITR (point-in-time
recovery) coverage, retention window, or restore steps — poems are real
user-authored creative work with no in-app export path and no documented
recovery procedure. Second, no document states the operational steps
(which SQL, which Supabase Admin API call) for actually fulfilling a
privacy export or delete request, turning a routine subject-access request
into an ad hoc scramble if one arrives.

Goal (acceptance criteria):
1. A short paragraph, in docs/IMPLEMENTATION-PLAN.md §6 or a new
   docs/BACKUP.md, states the Supabase Pro project's actual backup/PITR
   guarantee and the manual restore steps — verified against the actual
   project settings, not assumed.
2. A short internal runbook (mirroring docs/TRIAGE.md's precision) covers
   the concrete steps to run against Supabase for an export or delete
   request.

Constraints: Do not write down a backup/PITR guarantee you have not
verified. If you cannot access the live Supabase project's dashboard/
settings (e.g. because you lack credentials in your environment), do not
guess a plausible-sounding retention window — state explicitly in the doc
that this figure needs to be confirmed against the project's actual
settings by someone with access, rather than asserting an unverified claim
(this is exactly the kind of inaccuracy R-05 exists to fix elsewhere in
this repo — don't introduce a new one here).

Verification: `npm run format:check`. If you have Supabase project access,
confirm the backup/PITR claim directly (e.g. via the Supabase dashboard's
"Backups" settings or the management API) before writing it down.

Work cost-consciously: this is documentation work, but getting an
unverifiable operational/compliance claim wrong is a real risk, not a style
nit — do the verification-or-explicit-caveat step yourself at a mid-cost
tier rather than delegating it to a subagent that might paraphrase an
assumption as fact.

Deliverable: a short doc addition (in docs/IMPLEMENTATION-PLAN.md and/or a
new docs/BACKUP.md, plus an export/delete runbook), with a Conventional
Commits message (e.g. `docs: add backup/restore and export/delete
runbooks`), ready for a PR per CLAUDE.md's workflow. Note explicitly in the
PR description whether the backup/PITR figures were verified against the
live project or left as an open item pending someone with access.
```

## Prompt for R-32 — Shared sanitisation-policy constant between preview and share pipelines

**Bundles:** R-32 only · **Run after:** no prerequisites

```text
Context: poetic-fiddle is a Next.js + TypeScript app with two independent
HTML-sanitisation pipelines for the same class of untrusted content
(rendered `.poem` HTML): the browser live preview in
src/components/PoemPreview.tsx (around line 73, browser DOMPurify with
default config) and the server-side share page in src/lib/render-share.ts
(lines 44–98, jsdom + DOMPurify with `RETURN_DOM_FRAGMENT` plus custom
embed-activation logic and its own allow-list). Read CLAUDE.md first for
the branch/PR workflow, and note that the `.poem` renderer itself must
never be forked in this repo — this task only touches Fiddle's sanitisation
config, not poetic's rendering.

Problem: the two pipelines are each commented with their own rationale
(referencing AC24/AC25/AC86 in docs/REQUIREMENTS.md) and their divergence
is intentional and low-risk today, but there is no shared constant or
module between them — two hand-maintained implementations of "sanitise
poetic's rendered HTML" that could silently drift apart on something they
actually need to agree on.

Goal (acceptance criteria): whatever baseline configuration the two
pipelines genuinely need to agree on (e.g. the core DOMPurify allow-list
for tags/attributes both intentionally permit) is expressed as a shared
constant/module that each pipeline imports and extends, with any
intentional divergence (e.g. `RETURN_DOM_FRAGMENT`, jsdom-specific setup,
the embed-activation allow-list) documented inline at the point where it
diverges from the shared baseline.

Constraints: Do not change either pipeline's actual sanitisation behaviour
— this is a structural refactor (deduplicate shared config into one place)
with zero observable output difference. Do not merge the two pipelines
into one function — they run in genuinely different environments (browser
vs. server/jsdom) for good reason per the existing comments; only the
config they agree on should be shared.

Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`,
`npm test` (confirm PoemPreview.test.tsx and render-share.test.ts both
still pass with byte-identical sanitisation output before and after —
consider snapshotting the sanitised output of a representative fixture
before your change and diffing it after, even though the project avoids
snapshot tests generally; a manual before/after comparison here is
acceptable since it's a refactor-safety check, not a permanent test
artifact), `npm run build`.

Work cost-consciously: identifying exactly which parts of two independently
evolved security-relevant configs are safe to share versus intentionally
divergent requires real judgment — do this analysis and the extraction
itself at a mid-to-high-cost model tier, since a mistake here (accidentally
sharing something that should have stayed divergent, or vice versa) is a
security-relevant regression, not a cosmetic one.

Deliverable: a single commit adding a shared sanitisation-config module and
updating both PoemPreview.tsx and render-share.ts to import from it, with a
Conventional Commits message (e.g. `refactor(security): share sanitisation
baseline config between preview and share pipelines`), ready for a PR per
CLAUDE.md's workflow.
```

## Prompt for R-33 — Add automated accessibility testing (axe smoke test)

**Bundles:** R-33 only · **Run after:** R-02, R-14

```text
Context: poetic-fiddle is a Next.js + TypeScript app. Read CLAUDE.md first
for the branch/PR workflow. This task assumes recommendations R-02
(accessible name on the CodeMirror editor, in src/components/Editor.tsx)
and R-14 (parse-error contrast fix and share-page heading) have already
landed — verify before starting by checking that Editor.tsx's CodeMirror
extensions include an `aria-label` (or equivalent) on the editable element,
and that the parse-error text no longer uses the under-contrast
`text-amber-600` value. If either hasn't landed, the new axe test you add
here will fail immediately on those pre-existing violations rather than on
any future regression — that's a real blocker for this task's own
acceptance criteria, not just clutter.

Problem: no `axe-core`/`jest-axe`/`vitest-axe`/`pa11y` tooling exists
anywhere in the repo. This is not hypothetical: manual review already found
real labelling and contrast defects (the F-UX-01 and F-UX-02 findings this
review addressed via R-02 and R-14) that green CI did not catch, because
nothing in the pipeline checks for this class of defect automatically.
docs/IMPLEMENTATION-PLAN.md's W4 backlog item already proposes an automated
contrast test; this task implements the broader axe check instead of a
narrower contrast-only one, since axe also covers labelling — where F-UX-01
was found.

Goal (acceptance criteria): a CI-run accessibility smoke test (using
`vitest-axe` or an equivalent Vitest-compatible axe wrapper) runs an
`axe()` assertion against the rendered Editor and PoemsDashboard component
trees in Editor.test.tsx and PoemsDashboard.test.tsx (or new dedicated test
files), asserting zero violations, and this passes in CI going forward.
docs/IMPLEMENTATION-PLAN.md's W4 backlog item is marked resolved by this
broader implementation.

Constraints: Do not silently loosen the axe ruleset to make a real
violation disappear (e.g. disabling a rule because it's inconvenient) — if
a genuine new violation surfaces that isn't covered by R-02/R-14, fix it or
document it explicitly as a follow-up (with a TECH-DEBT.md entry via
`scripts/next-tech-debt-id.pl`) rather than suppressing the check. Test
against realistic rendered states (e.g. Editor's error state, dashboard
with poems present), not just the emptiest possible render, since that's
closer to how the real defects were found.

Verification: `npm install -D vitest-axe` (or the equivalent package you
choose — state which and why), `npm run lint`, `npm run typecheck`, `npm
run format:check`, `npm test` (confirm both new axe assertions pass with
zero violations), `npm run build`. As a sanity check that the test actually
works, temporarily reintroduce one of the R-02/R-14 defects (e.g. remove
the aria-label) and confirm the new test fails, then revert.

Work cost-consciously: installing and wiring `vitest-axe` per its
documentation is mechanical, low-cost-tier work. Interpreting any
violations the tool surfaces beyond what R-02/R-14 already fixed requires
real accessibility judgment — do that triage at a mid-to-high-cost tier
rather than reflexively suppressing a rule to get to green.

Deliverable: new/extended test files wiring `axe()` assertions into
Editor.test.tsx and PoemsDashboard.test.tsx, package.json/package-lock.json
changes for the new dependency, and a docs/IMPLEMENTATION-PLAN.md update
marking W4's automated-contrast-test backlog item resolved, with a
Conventional Commits message (e.g. `test(a11y): add axe smoke test for
Editor and Dashboard`), ready for a PR per CLAUDE.md's workflow.
```
