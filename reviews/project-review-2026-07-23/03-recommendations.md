# Recommendations

Ordered by severity first, then effort — quick wins before long campaigns at
equal severity. Every Critical and High finding is covered by a
recommendation below; several Medium/Low findings are addressed together
where they share a fix or a file.

| ID | Recommendation | Severity | Effort | Addresses |
|---|---|---|---|---|
| R-01 | Bump `next` to `16.2.11` | High | Small | F-SEC-01, F-DEPS-01 |
| R-02 | Add an accessible name to the CodeMirror editor | High | Small | F-UX-01 |
| R-03 | Require CI status checks in the branch-protection ruleset | High | Small | F-CI-01 |
| R-04 | Correct CLAUDE.md's Status section | High | Small | F-DOC-01 |
| R-05 | Correct the Privacy Policy's "storage isn't available yet" claim | High | Small | F-DATA-01 |
| R-06 | Guard against missing Supabase env vars breaking the editor silently | High | Medium | F-TOOL-01 |
| R-07 | Align Node version across README/`engines`/`.nvmrc` | Medium | Small | F-DEPS-03, F-DOC-02, F-TOOL-05 |
| R-08 | Route `SignInPrompt` errors through the safe-message convention | Medium | Small | F-CODE-02 |
| R-09 | Add timeout/abort handling to outbound Supabase calls | Medium | Small | F-PERF-02, F-OPS-03 |
| R-10 | Add tests for `use-session.ts` and `SharedPoemView`'s `escapeHtml` | Medium | Small | F-TEST-01, F-TEST-02 |
| R-11 | Capture `revalidateSharedPoem` failures in Sentry | Medium | Small | F-OPS-01 |
| R-12 | Add a self-service "delete poem" action | Medium | Small | F-DATA-02 |
| R-13 | Pin exact Supabase CLI / npm versions in CI | Medium | Small | F-CI-03, F-CI-04 |
| R-14 | Fix parse-error contrast and add a visible share-page heading | Medium | Small | F-UX-02, F-UX-03 |
| R-15 | Document the local-only Supabase dev workflow in README | Medium | Small | F-TOOL-02 |
| R-16 | Add `CONTRIBUTING.md` and PR/issue templates | Medium | Small | F-GOV-01, F-GOV-02 |
| R-17 | Document the CODEOWNERS single-reviewer reality | Medium | Small | F-GOV-03 |
| R-18 | Trim the historical-narrative blockquote from OBSERVABILITY-PLAN.md | Medium | Small | F-DOC-03 |
| R-19 | Add a `poetic`-release freshness-check workflow | Medium | Medium | F-DEPS-02 |
| R-20 | Reconcile CHANGELOG.md and GitHub release notes at release time | Medium | Medium | F-CI-02 |
| R-21 | Extract Editor.tsx's persistence/session orchestration into a hook | Medium | Medium | F-ARCH-02, F-CODE-01 |
| R-22 | Add a cross-tool-seam test for the Analysis-toggle DOM wiring | Medium | Medium | F-ARCH-01 |
| R-23 | Debounce draft-autosave localStorage writes | Low | Small | F-PERF-01 |
| R-24 | Code-quality quick wins (test boilerplate, error-message helper, PageHeader) | Low | Small | F-CODE-03, F-CODE-04, F-CODE-05 |
| R-25 | Security polish (cache-bust scope, password minLength) | Low | Small | F-SEC-02, F-SEC-03 |
| R-26 | Add test coverage tooling and a watch-mode script | Low | Small | F-TEST-03, F-TEST-04 |
| R-27 | Document the undocumented TypeScript/ESLint major-version holds | Low | Small | F-DEPS-04 |
| R-28 | README/tooling polish | Low | Small | F-TOOL-03, F-TOOL-04, F-TOOL-06 |
| R-29 | Editor/dashboard loading & feedback polish | Low | Small | F-UX-05, F-UX-06, F-UX-07 |
| R-30 | Doc polish | Low | Small | F-DOC-04, F-DOC-05 |
| R-31 | Document backup/restore and export/delete runbooks | Low | Small | F-OPS-02, F-DATA-03 |
| R-32 | Shared sanitisation-policy constant between preview and share pipelines | Low | Small | F-ARCH-03 |
| R-33 | Add automated accessibility testing (axe smoke test) | Low | Medium | F-UX-04 |

No recommendation addresses F-PERF-03 or F-GOV-04: both findings' own
direction concludes no action is needed at the project's current scale.

## R-01 — Bump `next` to `16.2.11`

**Severity:** High · **Effort:** Small · **Addresses:** F-SEC-01, F-DEPS-01

**Current state:** `package.json` pins `next@16.2.10`. `npm audit` reports 3 high-severity advisories fixed in `16.2.11`, several scoped to Server Actions — a feature this app genuinely uses (`src/lib/revalidate-share.ts`'s `"use server"` export, called on every save of a shared poem). No Dependabot PR or alert has surfaced this yet.

**Intended end state:** `package.json` and `package-lock.json` pin `next@^16.2.11` (or later); `npm audit` reports zero high-severity advisories traceable to `next`; the app builds and all existing tests pass unchanged.

**Approach:** `npm install next@16.2.11`, run the full local check suite (lint, typecheck, test, build), and confirm `npm audit` is clean of the three advisories. No app-code changes are expected — this is a dependency-only bump.

## R-02 — Add an accessible name to the CodeMirror editor

**Severity:** High · **Effort:** Small · **Addresses:** F-UX-01

**Current state:** The `<label htmlFor="poem-source">` in `src/components/Editor.tsx` targets an `id` that CodeMirror's React wrapper places on the outer wrapper `<div>`, not on the actual editable `role="textbox"` element, which has no accessible name.

**Intended end state:** The CodeMirror editor's content-editable element has an `aria-label` (or equivalent accessible name), verified via `getByLabelText`/`getByRole("textbox", { name: ... })` in `Editor.test.tsx`. `docs/REQUIREMENTS.md` AC79 is genuinely satisfied, not just marked done.

**Approach:** Add `EditorView.contentAttributes.of({ "aria-label": "Your poem" })` (or equivalent) to the `extensions` array passed to `<CodeMirror>`, alongside the other extensions already there. Add a test asserting the accessible name resolves via Testing Library's `getByRole`.

## R-03 — Require CI status checks in the branch-protection ruleset

**Severity:** High · **Effort:** Small · **Addresses:** F-CI-01

**Current state:** The active ruleset (`gh api repos/Poetic-Poems/poetic-fiddle/rulesets/18828479`) requires code-owner review, CodeQL, and Copilot code-quality, but has no `required_status_checks` rule — so `build.yml`, `commit-format.yml`, and `database.yml`'s `test` job can all be red (or not yet finished) and a PR is still mergeable.

**Intended end state:** The ruleset (or a new one) names `build` (from `build.yml`), `commit-format` (from `commit-format.yml`), and `database.yml`'s `test` job as required status checks, so GitHub's merge button is blocked until each has succeeded.

**Approach:** Via the GitHub UI (Settings → Rules → Rulesets → default) or `gh api --method PUT repos/Poetic-Poems/poetic-fiddle/rulesets/18828479`, add a `required_status_checks` rule listing the three job names. Verify by opening a throwaway PR with a deliberately failing lint and confirming the merge button is disabled, then close it without merging.

## R-04 — Correct CLAUDE.md's Status section

**Severity:** High · **Effort:** Small · **Addresses:** F-DOC-01

**Current state:** CLAUDE.md's Status section states the data layer (save, dashboard, share) "is not yet" built. The codebase and `docs/IMPLEMENTATION-PLAN.md` (which CLAUDE.md itself cites) both show it as fully implemented, tested, and live in production.

**Intended end state:** CLAUDE.md's Status section accurately reflects the current milestone (M0–M7 delivered per `docs/IMPLEMENTATION-PLAN.md` §7), naming the actual remaining work (the W1–W16 hardening backlog) as "not yet."

**Approach:** Rewrite the paragraph. Keep it brief — CLAUDE.md's own documentation principles favour pointing at `docs/IMPLEMENTATION-PLAN.md` for detail rather than duplicating it.

## R-05 — Correct the Privacy Policy's "storage isn't available yet" claim

**Severity:** High · **Effort:** Small · **Addresses:** F-DATA-01

**Current state:** `src/app/privacy/page.tsx`'s "Saving and sharing poems" section tells visitors that poem/account storage "isn't available yet," while `poems-store.ts` has fully implemented, unflagged save/share/list/load logic against live Supabase tables, exercised in production.

**Intended end state:** The Privacy Policy accurately describes current data collection: poem content and account data are stored server-side now. The adjacent "you'll be able to delete... at any time" promise is checked against actual capability (see R-12/F-DATA-02) and adjusted if it overstates what's currently possible.

**Approach:** Update the section's wording to present-tense, accurate language. Cross-check the surrounding "Your rights" section against what deletion mechanism actually exists today (currently email-only, per F-DATA-02) so the policy doesn't trade one inaccuracy for another.

## R-06 — Guard against missing Supabase env vars breaking the editor silently

**Severity:** High · **Effort:** Medium · **Addresses:** F-TOOL-01

**Current state:** `src/lib/supabase-client.ts` throws at module-evaluation time if `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset. Because `Editor` loads via `next/dynamic(..., { ssr: false })`, this throw only fires in the browser — `npm run dev` starts cleanly and serves HTTP 200, so a newcomer following README's command order (env setup is a separate, later section, not sequenced before `npm run dev`) hits a silently broken editor pane with no on-screen explanation.

**Intended end state:** A developer who runs `npm run dev` without `.env.local` configured sees a clear, in-app message telling them to copy `.env.example` and fill in Supabase credentials, instead of a silent client-side crash. README sequences env setup before the dev-server command.

**Approach:** Add a `src/app/error.tsx` (or a check inside `EditorClient`/`Editor`) that recognises this specific missing-env-var error and renders an actionable message. Reorder README.md so "Environment & secrets" precedes the commands table, or add an explicit pointer from the `npm run dev` row to that section.

## R-07 — Align Node version across README/`engines`/`.nvmrc`

**Severity:** Medium · **Effort:** Small · **Addresses:** F-DEPS-03, F-DOC-02, F-TOOL-05

**Current state:** `package.json` pins `engines.node: "22.x"` (required because of a documented `ERR_REQUIRE_ESM` bug below Node 22.12, TD26071901); README still says "Requires Node.js >=20.9"; no `.nvmrc`/`.node-version` exists to let version managers auto-select the right version; `.npmrc` has no `engine-strict`.

**Intended end state:** README, `package.json`'s `engines.node`, and a new `.nvmrc` all agree on `22.x` (or a more precise `>=22.12` if that's the true floor). Running `nvm use` in the repo root selects the correct version without a human needing to know the number.

**Approach:** Update README's line to `Requires Node.js 22.x` (or reference the `>=22.12` constraint directly, linking `docs/TRIAGE.md`'s explanation). Add a one-line `.nvmrc` containing `22`. Adjust `scripts/setup-linux.sh`'s `nvm use node` to plain `nvm use` so it picks up the new file.

## R-08 — Route `SignInPrompt` errors through the safe-message convention

**Severity:** Medium · **Effort:** Small · **Addresses:** F-CODE-02

**Current state:** `src/lib/poems-store.ts` wraps every Supabase-backed operation in a typed `Error` subclass with a message documented as safe to show a poet as-is. `src/components/SignInPrompt.tsx` instead shows raw `error.message` from Supabase Auth calls directly.

**Intended end state:** Auth errors surfaced in the sign-in dialog follow the same safe-message pattern as the rest of the app — a user-facing message that doesn't leak raw provider error text, with the original error preserved as `.cause` for observability.

**Approach:** Introduce an `AuthError` class (or reuse the existing pattern from `poems-store.ts`) that maps Supabase Auth error codes/messages to safe user-facing text, and use it at the three call sites in `SignInPrompt.tsx` (`signInWithOtp`, `signInWithOAuth`/`signInWithPassword`, `signUp`). Update `SignInPrompt.test.tsx` accordingly.

## R-09 — Add timeout/abort handling to outbound Supabase calls

**Severity:** Medium · **Effort:** Small · **Addresses:** F-PERF-02, F-OPS-03

**Current state:** No Supabase client configures a request timeout or `AbortController`; `@supabase/postgrest-js`'s built-in retry explicitly excludes non-idempotent methods (inserts/updates). A hung save leaves the UI stuck in "Saving…" indefinitely (bounded only by the hosting platform's own function timeout) with no error message from the app's own typed-error path.

**Intended end state:** Every write in `poems-store.ts` (save, share, unshare, remix-default, allow-remix) either succeeds, fails with the app's existing typed error (`PoemSaveError` etc.), or fails with a timeout-specific message within a bounded window (e.g. 10-15s) — never hangs indefinitely from the UI's perspective.

**Approach:** Pass a `global: { fetch: <wrapped fetch with AbortSignal.timeout(...)> } }` option to `createClient` in `supabase-client.ts`/`supabase-server.ts`, or wrap individual `poems-store.ts` calls with `Promise.race` against a timeout. Translate a timeout into the existing typed error classes so downstream UI code doesn't need to special-case it.

## R-10 — Add tests for `use-session.ts` and `SharedPoemView`'s `escapeHtml`

**Severity:** Medium · **Effort:** Small · **Addresses:** F-TEST-01, F-TEST-02

**Current state:** `src/lib/use-session.ts` (the hook gating every owner-scoped, RLS-backed operation) is mocked by every consumer test and never exercised directly. `src/components/SharedPoemView.tsx`'s hand-rolled `escapeHtml`, which interpolates a poet-controlled title into a CSP-bearing HTML template, has zero test coverage.

**Intended end state:** `src/lib/use-session.test.ts` exists, mocking the Supabase client's `auth.getSession`/`auth.onAuthStateChange` directly and asserting initial session reflection, update on a later auth event, and unsubscribe-on-unmount. `src/components/SharedPoemView.test.tsx` exists, rendering with a title containing `<`, `>`, `"`, `'`, `&` and asserting the resulting `srcDoc` doesn't break out of the `<title>` tag or the CSP `<meta>` attribute.

**Approach:** Two independent, small test files; no production code changes required unless a test surfaces a real bug. Follow the existing test file conventions in `src/lib/*.test.ts` and `src/components/*.test.tsx`.

## R-11 — Capture `revalidateSharedPoem` failures in Sentry

**Severity:** Medium · **Effort:** Small · **Addresses:** F-OPS-01

**Current state:** Three call sites in `Editor.tsx` do `revalidateSharedPoem(saved.shareId).catch(() => {})`. `docs/OBSERVABILITY-PLAN.md` already flags this as an open, unresolved gap.

**Intended end state:** A failed cache-tag revalidation after a save is captured via the existing `reportSwallowedError` helper (consistent with the app's other three deliberate-swallow points), tagged with the poem/share id but not its content. `docs/OBSERVABILITY-PLAN.md`'s open flag is resolved and can be removed or marked done.

**Approach:** Wrap the three `.catch(() => {})` call sites (or `revalidateSharedPoem` itself) with a call to `reportSwallowedError`, matching the pattern already used in `get-shared-poem.ts`, `shared-poem-cache.ts`, and `render-share.ts`.

## R-12 — Add a self-service "delete poem" action

**Severity:** Medium · **Effort:** Small · **Addresses:** F-DATA-02

**Current state:** `poems-store.ts` exports no delete function, and no delete UI exists, even though the RLS policy and grant (`poems_delete_own`) already exist in the migration. Deletion today is manual, by emailing the maintainer.

**Intended end state:** A signed-in poet can delete an individual poem from the dashboard; the action is a straightforward RLS-scoped `delete`, with a confirmation step given it's destructive.

**Approach:** Add a `deletePoem(id)` function to `poems-store.ts` (mirroring the existing typed-error convention), a delete action/button in `PoemsDashboard.tsx` with a confirmation prompt, and a corresponding test. This is a natural pairing with R-05, since it makes the Privacy Policy's "delete at any time" promise actually true for poems (account-level self-service deletion is a larger, separate follow-up not required to close this recommendation).

## R-13 — Pin exact Supabase CLI / npm versions in CI

**Severity:** Medium · **Effort:** Small · **Addresses:** F-CI-03, F-CI-04

**Current state:** `database.yml` installs the Supabase CLI via `supabase/setup-cli@v3` with `version: latest`; `build.yml` installs npm via `npm install -g npm@12` (floating patch). Both are the least-pinned parts of an otherwise carefully version-pinned pipeline, and this project already hit an npm-version-specific bug once (TD26071804).

**Intended end state:** `database.yml` pins an exact Supabase CLI version; `build.yml` pins an exact npm version (or `package.json`'s `engines.npm` records the verified major).

**Approach:** Replace `version: latest` with the current exact Supabase CLI release tag in both jobs of `database.yml`. Replace `npm@12` with an exact `npm@12.x.y` in `build.yml`, or add `"engines": {"npm": "12.x"}` to `package.json` documenting the verified major. Bump each deliberately going forward, the same way `poetic` and `eslint-config-next` are bumped.

## R-14 — Fix parse-error contrast and add a visible share-page heading

**Severity:** Medium · **Effort:** Small · **Addresses:** F-UX-02, F-UX-03

**Current state:** `Editor.tsx`'s parse-error status text uses `text-amber-600` in light mode, computing to ≈3.18:1 contrast against white (below the 4.5:1 AA threshold AC76 requires). `src/app/share/[share_id]/page.tsx` has no visible `<h1>` outside the sandboxed iframe, unlike every other route. **Note:** open PR #99 already fixes the F-UX-02 half (amber-600 → amber-700) as part of closing `IMPLEMENTATION-PLAN.md`'s W4 item — check whether it has merged before starting; if so, this recommendation's remaining scope is just the F-UX-03 share-page heading.

**Intended end state:** The parse-error message meets 4.5:1 contrast in both light and dark mode. The share page renders the poem's title as a visible `<h1>` in the page's own DOM (not only inside the iframe), giving screen-reader users page-level orientation before they enter the framed content.

**Approach:** Replace `text-amber-600` with a contrast-checked colour (or a CSS custom property consistent with `--focus-ring`'s existing approach). Add an `<h1>` to the share page's own markup using the already-derived poem title; keep the iframe's internal title as-is.

## R-15 — Document the local-only Supabase dev workflow in README

**Severity:** Medium · **Effort:** Small · **Addresses:** F-TOOL-02

**Current state:** README's "Environment & secrets" section only describes filling `.env.local` from a live Supabase cloud project's dashboard, even though `supabase/config.toml` and the migrations fully support a zero-cloud `supabase start` local dev loop already used by `database.yml`'s `test` job and the `test:db` script.

**Intended end state:** README documents both paths: the cloud-project path already described, and a short "Local-only Supabase" alternative using `supabase start`.

**Approach:** Add a short subsection to README's "Environment & secrets" describing `supabase start` and pointing `.env.local` at its printed local URL/anon key.

## R-16 — Add `CONTRIBUTING.md` and PR/issue templates

**Severity:** Medium · **Effort:** Small · **Addresses:** F-GOV-01, F-GOV-02

**Current state:** No `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, or `.github/ISSUE_TEMPLATE/` exists. The equivalent workflow (branch naming, commit format, PR-only changes) is documented in CLAUDE.md, which is framed as agent operating instructions rather than a human-facing contribution guide, and isn't picked up by GitHub's own contribution-guide UI affordances.

**Intended end state:** A short root `CONTRIBUTING.md` exists, discoverable via GitHub's UI, pointing to CLAUDE.md's "Branch workflow" and "Commit messages" sections rather than duplicating them. A minimal PR template reminds contributors of the Conventional Commits title requirement and prompts for a test plan.

**Approach:** Write `CONTRIBUTING.md` as a short pointer document, not a duplicate of CLAUDE.md. Add `.github/PULL_REQUEST_TEMPLATE.md` with a Conventional Commits reminder and a test-plan checklist; add `.github/ISSUE_TEMPLATE/*.yml` forms only if/when issue volume warrants it.

## R-17 — Document the CODEOWNERS single-reviewer reality

**Severity:** Medium · **Effort:** Small · **Addresses:** F-GOV-03

**Current state:** `CODEOWNERS` lists two GitHub accounts (`@warwickallen`, `@Warwick-Allen`) that satisfy the branch-protection rule's code-owner-review requirement, but evidence (review authorship, `mergedBy`, LICENCE copyright, CLAUDE.md's git user) indicates both belong to the same individual — so the "independent review" the ruleset implies is procedurally self-approval through an alternate account.

**Intended end state:** This is stated explicitly somewhere a reader of CLAUDE.md or CODEOWNERS would find it, so the strength of the control is represented accurately rather than implying independent-reviewer coverage it doesn't currently have.

**Approach:** Add a short note to CLAUDE.md's governance-adjacent section (or a comment in `CODEOWNERS`) stating that review is currently a single-human checkpoint under two accounts, pending a second genuine reviewer as the project grows. No code change required.

## R-18 — Trim the historical-narrative blockquote from OBSERVABILITY-PLAN.md

**Severity:** Medium · **Effort:** Small · **Addresses:** F-DOC-03

**Current state:** `docs/OBSERVABILITY-PLAN.md` embeds a dated "Update (2026-07-19)" blockquote narrating the jsdom `ERR_REQUIRE_ESM` incident's resolution in past-tense — the same "previously.../fixed by..." phrasing CLAUDE.md's documentation principles reserve for `CHANGELOG.md`. The incident is already fully narrated in `CHANGELOG.md` and `TECH-DEBT.md`'s `TD26071901`.

**Intended end state:** `docs/OBSERVABILITY-PLAN.md` states the current mitigation (the jsdom pin) as a one-line as-built fact, linking to `TD26071901` for history, rather than re-narrating the incident.

**Approach:** Trim the blockquote to a single sentence; verify `CHANGELOG.md`'s existing entry already carries the full narrative (it does) so nothing is lost.

## R-19 — Add a `poetic`-release freshness-check workflow

**Severity:** Medium · **Effort:** Medium · **Addresses:** F-DEPS-02

**Current state:** `poetic` installs from a pinned GitHub release-tarball URL, which Dependabot's npm updater cannot track. No mechanism polls `Poetic-Poems/poetic`'s releases for a newer tag than the one pinned in `package.json`.

**Intended end state:** A scheduled workflow periodically compares the pinned `poetic` version against `Poetic-Poems/poetic`'s latest release and opens an issue (or PR) when they diverge, so a new upstream release doesn't sit undetected.

**Approach:** Mirror the existing `td-tooling-drift.yml` scheduled-diff pattern: a workflow on a weekly `schedule` trigger that reads the pinned version from `package.json`, queries `gh api repos/Poetic-Poems/poetic/releases/latest`, and opens an issue naming both versions if they differ.

## R-20 — Reconcile CHANGELOG.md and GitHub release notes at release time

**Severity:** Medium · **Effort:** Medium · **Addresses:** F-CI-02

**Current state:** `release.yml` creates each GitHub release with `--generate-notes` (PR-title bullets from GitHub), entirely independent of `CHANGELOG.md`'s manually curated `[Unreleased]` section. Nothing keeps the two in sync, and they have already begun to diverge in spirit (CHANGELOG lists substantially more shipped work than the one existing tagged release).

**Intended end state:** Either the GitHub release body is generated from `CHANGELOG.md`'s section for the version being tagged, or a CI check ensures a version-bump PR renames `[Unreleased]` to the new version heading before a tag can be cut.

**Approach:** Modify `release.yml` to read the relevant `CHANGELOG.md` section (matching a `## [Unreleased]` or `## [X.Y.Z]` heading) and pass it via `gh release create --notes-file`, dropping `--generate-notes`. Alternatively, add a lightweight check (in `build.yml` or a new job) that flags a version-bump PR whose `CHANGELOG.md` still has content under `[Unreleased]` after the bump.

## R-21 — Extract Editor.tsx's persistence/session orchestration into a hook

**Severity:** Medium · **Effort:** Medium · **Addresses:** F-ARCH-02, F-CODE-01

**Current state:** `src/components/Editor.tsx` (581 lines) owns 13 state/ref hooks, session-migration logic, draft persistence, debounced rendering, and four independent Supabase-backed save/share/unshare/allow-remix flows, all in one component.

**Intended end state:** The non-presentational state machine (session migration, draft adoption, and the four persistence flows) lives in one or more dedicated hooks (e.g. `usePoemPersistence`), leaving `Editor.tsx` closer to a presentation component that consumes that hook's state and handlers. Existing behaviour and test coverage (the six `Editor.*.test.tsx` files) continue to pass, adjusted only for the new import surface.

**Approach:** Extract incrementally — start with the four save/share/unshare/allow-remix handlers and their loading/error state into `usePoemPersistence`, then consider whether draft/session-migration logic warrants a second hook. Keep the extraction test-driven: run the existing Editor test suite after each step to confirm behaviour is unchanged before moving to the next piece.

## R-22 — Add a cross-tool-seam test for the Analysis-toggle DOM wiring

**Severity:** Medium · **Effort:** Medium · **Addresses:** F-ARCH-01

**Current state:** `src/components/PoemPreview.tsx`'s `wireAnalysisToggles` is tested only against a hand-authored fixture string, not real `poetic` output. Two prior production incidents (TD26071401, TD26071602) already happened in exactly this seam.

**Intended end state:** At least one test pipes real `.poem` source containing an `{Analysis}` block through `renderPoem()` (and, for the share path, through `sanitizeSharedPoemHtml`) and then runs `wireAnalysisToggles` against that real output, so a future `poetic` release renaming an Analysis class/id would fail this test instead of silently breaking both preview surfaces.

**Approach:** Mirror `src/lib/render-share.test.ts`'s pattern (real `poetic/browser` import, real render) inside `PoemPreview.test.tsx` or a new test file, replacing or supplementing the current hand-copied `ANALYSIS_HTML`/`SELECTOR_HTML` fixtures.

## R-23 — Debounce draft-autosave localStorage writes

**Severity:** Low · **Effort:** Small · **Addresses:** F-PERF-01

**Current state:** `saveDraft` runs synchronously on every keystroke in `Editor.tsx`'s `handleChange`, while the more expensive `renderPoem()` call one line below is debounced to 200ms.

**Intended end state:** `saveDraft` runs on the same (or a similarly short) debounce as the render call, so keystroke-to-paint latency doesn't pay for a synchronous storage write on every character.

**Approach:** Fold the `saveDraft(value)` call into the existing `setTimeout` debounce block in `handleChange`, or give it its own short-interval debounce if draft-loss risk on rapid typing needs to be kept lower than the render debounce.

## R-24 — Code-quality quick wins

**Severity:** Low · **Effort:** Small · **Addresses:** F-CODE-03, F-CODE-04, F-CODE-05

**Current state:** Six `Editor.*.test.tsx` files repeat identical mock/fixture boilerplate; `err instanceof Error ? err.message : String(err)` is duplicated 10 times across `Editor.tsx`/`PoemsDashboard.tsx`; three route components inline the same page-header JSX.

**Intended end state:** Shared test mocks/fixtures live in one `editor-test-support.ts` helper; a one-line `errorMessage(err: unknown): string` helper replaces the 10 duplicated inline expressions; a `PageHeader` component exists if/when a fourth route needs the same header (not required immediately).

**Approach:** Three small, independent mechanical refactors; each can be done and verified (existing tests still passing) in isolation.

## R-25 — Security polish

**Severity:** Low · **Effort:** Small · **Addresses:** F-SEC-02, F-SEC-03

**Current state:** `revalidateSharedPoem` has no authorization check before invalidating a share page's cache tag (low-impact given the token's entropy). `SignInPrompt.tsx` allows 6-character passwords with no strength guidance.

**Intended end state:** No change required to `revalidateSharedPoem` unless this pattern is reused for a less entropy-rich identifier (documented as a design note, not urgent). Password `minLength` raised to ~8-10.

**Approach:** Raise `minLength={6}` to `minLength={8}` (or higher) in `SignInPrompt.tsx`; optionally add a Supabase Auth project-level minimum-password-length setting to enforce it server-side too, not just client-side.

## R-26 — Add test coverage tooling and a watch-mode script

**Severity:** Low · **Effort:** Small · **Addresses:** F-TEST-03, F-TEST-04

**Current state:** No coverage tool is configured; `package.json`'s only test script is a single-shot `vitest run`.

**Intended end state:** `@vitest/coverage-v8` is installed and wired to a `coverage` script (surfaced, not necessarily gated on, in CI); a `test:watch` script exists for local iteration.

**Approach:** `npm install -D @vitest/coverage-v8`, add `"coverage": "vitest run --coverage"` and `"test:watch": "vitest"` to `package.json`'s scripts.

## R-27 — Document the undocumented TypeScript/ESLint major-version holds

**Severity:** Low · **Effort:** Small · **Addresses:** F-DEPS-04

**Current state:** `typescript` (`^5`, two majors behind) and `eslint` (`^9`, one major behind) both had Dependabot bump PRs closed unmerged with no recorded reason, unlike jsdom's well-documented TD26071901 hold.

**Intended end state:** Either the current-generation major bumps are merged (if they prove low-risk on trial), or a `TECH-DEBT.md` entry / `dependabot.yml` ignore-rule comment documents why they're held, matching jsdom's style.

**Approach:** Trial each bump in a throwaway branch (`npm install typescript@latest` / `eslint@latest`, run lint/typecheck/test/build); if clean, merge; if not, record the specific breakage as a new dated `TECH-DEBT.md` entry via `scripts/next-tech-debt-id.pl`.

## R-28 — README/tooling polish

**Severity:** Low · **Effort:** Small · **Addresses:** F-TOOL-03, F-TOOL-04, F-TOOL-06

**Current state:** README's commands table omits `npm start` and `test:db`. The WSL npm-shadowing workaround (`scripts/setup-linux.sh`) is undocumented outside its own header comment and an agent-only skill file. `sync-poetic-css.mjs`'s postinstall step fails with a raw Node stack trace rather than an actionable message if `poetic`'s CSS export path ever changes.

**Intended end state:** README's table lists all `package.json` scripts including their prerequisites (e.g. Supabase CLI for `test:db`); README has a one-line pointer to `setup-linux.sh` for WSL users; `sync-poetic-css.mjs` wraps its `require.resolve` in `try`/`catch` and rethrows with a message naming the pinned `poetic` version.

**Approach:** Three small, independent documentation/error-message edits.

## R-29 — Editor/dashboard loading & feedback polish

**Severity:** Low · **Effort:** Small · **Addresses:** F-UX-05, F-UX-06, F-UX-07

**Current state:** `EditorClient`/`PoemsDashboardClient` render a blank gap until client JS hydrates (no `loading` fallback on `next/dynamic`). `useSession()`'s async initial resolution can briefly present an already-signed-in poet with a false sign-in prompt. `SignInPrompt.tsx` gives no visible "in progress" text during a pending request.

**Intended end state:** Editor/dashboard show the app's existing "Loading…" pattern during hydration; `useSession()` exposes a loading state that gates Save/Share until resolved; the sign-in form shows pending-state text (e.g. "Sending…") during a request.

**Approach:** Pass a `loading` fallback to the existing `next/dynamic(...)` calls reusing the app's existing loading UI. Add a `"loading" | "signed-in" | "signed-out"` union (or a boolean `isLoading`) to `useSession()`'s return value. Add pending-state button text in `SignInPrompt.tsx`.

## R-30 — Doc polish

**Severity:** Low · **Effort:** Small · **Addresses:** F-DOC-04, F-DOC-05

**Current state:** `docs/TRIAGE.md` and `docs/SENTRY-AGENT-ACCESS.md` narrate rejected alternatives ("was trialled and dropped/removed/abandoned") with no as-built exemption. README never links the live app (`www.poeticfiddle.com`), though `CHANGELOG.md` documents it as deployed.

**Intended end state:** The two runbooks state rejected alternatives as a one-line "Rejected: X (reason)" rather than a narrated story. README has a one-line "Live at..." link near the top.

**Approach:** Two small, independent documentation edits.

## R-31 — Document backup/restore and export/delete runbooks

**Severity:** Low · **Effort:** Small · **Addresses:** F-OPS-02, F-DATA-03

**Current state:** No document states the Supabase Pro project's actual backup/PITR coverage or restore steps. No document states the operational steps for fulfilling a privacy export/delete request.

**Intended end state:** A short paragraph (in `docs/IMPLEMENTATION-PLAN.md` §6 or a new `docs/BACKUP.md`) states the actual backup/PITR guarantee and manual restore steps. A short internal runbook (mirroring `docs/TRIAGE.md`'s precision) covers what to run against Supabase for an export or delete request.

**Approach:** Two short, independent documentation additions; no code change. Verify the backup/PITR claim against the actual Supabase project settings before writing it down, rather than assuming.

## R-32 — Shared sanitisation-policy constant between preview and share pipelines

**Severity:** Low · **Effort:** Small · **Addresses:** F-ARCH-03

**Current state:** The live editor preview (`PoemPreview.tsx`) and the server share page (`render-share.ts`) each independently configure DOMPurify and embed-activation logic for the same class of untrusted content, with no shared constant between them.

**Intended end state:** Anything the two pipelines need to agree on (e.g. which DOMPurify config each intentionally departs from a shared baseline) is expressed as a shared constant/module, so the two are visibly the same policy applied twice rather than two independently-maintained policies.

**Approach:** Not urgent; when next touching either pipeline, factor out the common baseline config into a shared module that each imports and extends, documenting any intentional divergence inline.

## R-33 — Add automated accessibility testing (axe smoke test)

**Severity:** Low · **Effort:** Medium · **Addresses:** F-UX-04

**Current state:** No `axe-core`/`jest-axe`/`vitest-axe`/`pa11y` tooling exists anywhere in the repo. Manual review already found real labelling and contrast defects (F-UX-01, F-UX-02) that green CI didn't catch.

**Intended end state:** A CI-run accessibility smoke test (e.g. `vitest-axe` against the Editor and Dashboard component trees) catches the class of defect this review found manually, going forward.

**Approach:** `npm install -D vitest-axe` (or `jest-axe` equivalent adapted for Vitest), add an `axe()` assertion to `Editor.test.tsx` and `PoemsDashboard.test.tsx` rendering the component and checking for violations. This directly actions the open `docs/IMPLEMENTATION-PLAN.md` W4 backlog item already proposing an automated contrast test — implement it as the broader axe check rather than a narrower contrast-only test, since axe covers labelling too (which is where F-UX-01 was found).
