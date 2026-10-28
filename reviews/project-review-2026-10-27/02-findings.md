# Findings

Findings are organised by dimension, in the order used throughout this review's checklist. Where the same underlying fact was independently surfaced from two dimensions' evidence, it is recorded once under its most natural home, with a cross-reference noted in the other dimension's section — this avoids double-counting the same defect in the severity tally below. Three further observations are recorded as **Informational** (a verified strength or an explicitly non-actionable note) and are not included in the Critical–Low tally, since they describe no defect.

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 1 |
| Medium | 7 |
| Low | 21 |

## Architecture and design (ARCH)

**Strengths:** The app has a genuinely layered, consistently-followed architecture: presentation (`Editor.tsx`, `PoemsDashboard.tsx`) delegates to orchestration hooks (`use-poem-persistence.ts` composing `use-poem-crud.ts` + `use-sign-in-migration.ts`), which call a thin data layer (`poems-store.ts`, `get-shared-poem.ts`) that returns typed domain errors rather than leaking Supabase errors upward. Security boundaries are enforced architecturally, not just by convention: RLS is the default confinement for every route, and the one service-role client (`getSupabaseAdmin`) is isolated to the single route that needs it, with the rationale for not using it elsewhere spelled out at each call site. `docs/IMPLEMENTATION-PLAN.md` is detailed, dated, and matches the code as read. The `poetic` renderer seam is consumed through a single ambient `.d.ts` shim and a single generated-CSS module, both narrow and well-isolated, and the seam is exercised against the *real* pinned dependency in tests rather than only against mocks — exemplary cross-tool seam consistency.

### F-ARCH-01 — Interactive poem behaviour is re-implemented client-side, duplicating upstream `poetic.js` across a repo boundary · **Low**

**Evidence:** `src/lib/poem-toggles.ts` (266 lines) reimplements click/`auxclick` handling for Analysis show/hide, the synopsis/full selector, postscript "see more" clamping, and song-embed activation — behaviour that `poetic`'s own `poetic.js` normally provides, but which Fiddle's sandboxed, script-less preview iframe cannot execute. Comments at `src/lib/poem-toggles.ts:1-21` and `src/lib/poem-toggles.test.ts:193-197` explicitly name this risk and cite tracked tech debt (`TD26071401`, `TD26071602`).

**Impact:** A deliberate, well-documented consequence of the sandboxing requirement. The most load-bearing paths are tested against real `renderPoem()` output, catching gross desync on existing features; the residual gap is forward-looking — a *new* interactive feature added to `poetic.js` upstream has no automated signal that Fiddle needs a matching handler.

**Direction:** Already tracked (TD26071401/TD26071602); no new issue.

### F-ARCH-02 — `PoemsDashboard.tsx` carries inline orchestration the project's own convention says should be extracted · **Low**

**Evidence:** `src/components/PoemsDashboard.tsx` (380 lines) manages two independent data-loading effects, a per-row delete-confirmation state machine, and manual focus-management bookkeeping directly inside the component — unlike `Editor.tsx`, which delegates all of this to a hook. Parked issue #457 (`blocked` per `AGENTS.md`'s "Parked issues" convention) records the same observation, triggered on a material change to this file.

**Impact:** The component is still readable; the asymmetry with `Editor.tsx` is the project's own known, deliberately-deferred inconsistency.

**Direction:** None — already parked by design (issue #457).

### F-ARCH-03 — Supabase client construction re-validates the same two env vars three times with drifted error messages · **Low**

**Evidence:** `src/lib/supabase-client.ts:5-10` validates `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` via the shared `MISSING_SUPABASE_ENV_MESSAGE` constant (`src/lib/env-errors.ts`). `src/lib/supabase-server.ts` has three separate functions (`getSupabaseServer`, `getSupabaseAdmin`, `getSupabaseForToken`) that each hand-roll a near-identical check with inline message strings that do not reference `.env.example` and are not the shared constant — duplication that has already begun to diverge in wording. (Also reported, as a code-duplication instance, in CODE.)

**Impact:** Low risk in practice, but the textbook shape of copy-pasted validation logic drifting; a fourth near-identical block is one more copy-paste away from a fourth independent wording.

**Direction:** Factor the `if (!url || !key) throw ...` pattern in `supabase-server.ts` into one small helper so there is one message per missing-var combination. See R-08.

## Code quality and maintainability (CODE)

**Strengths:** Code quality is unusually high for a project this size. A near-exhaustive grep across `src/`, `scripts/`, `supabase/` found **zero** `any` types, `@ts-ignore`/`@ts-expect-error`, `eslint-disable` comments, and `TODO`/`FIXME`/`HACK` markers — self-reported tech debt is tracked in GitHub issues and the frozen `tech-debt/` archive instead of left in code comments. `tsconfig.json` has `strict: true` with no loosening flags. Error handling is consistent and deliberate: `src/lib/errors.ts`'s `domainError` factory gives every data-layer failure its own typed class, and every genuinely "swallowed" `.catch(() => {})` call site is paired with a `reportSwallowedError` call inside the function being called, so nothing is silently dropped. The project's one live lint warning (`AccountDangerZone.tsx:93`) is a correctly-reasoned, deliberate exception (see F-TOOL-04), not an oversight.

### F-CODE-01 — `use-poem-crud.ts` and its sibling `use-poem-persistence.ts` duplicate a large return-type shape · **Low**

**Evidence:** `src/lib/use-poem-crud.ts:26-68` (`UsePoemCrudResult`) and `src/lib/use-poem-persistence.ts:27-61` (`UsePoemPersistenceResult`) declare two independent interfaces identical except for `session` (added) and `migrateFromDraft`/`forgetSavedPoem` (removed) — roughly 35 lines of near-verbatim duplicated type declaration.

**Impact:** Harmless today (the files are directly adjacent in the dependency graph), but if either hook's return shape grows, both interfaces must be hand-edited in lockstep with no compiler-enforced link.

**Direction:** Derive `UsePoemPersistenceResult` from `UsePoemCrudResult` via `Omit<...> & { session: Session | null }`. See R-08.

### F-CODE-02 — `PoemsDashboard.tsx` and `use-poem-crud.ts` are the two largest non-test files and both carry real incidental complexity · **Low**

**Evidence:** `PoemsDashboard.tsx` (380 lines) interleaves two async data-loading effects, a confirm-delete state machine, and manual DOM-focus bookkeeping across four refs. `use-poem-crud.ts` (390 lines) owns four related-but-distinct flows (save, share, unshare, remix) through one hook with ~13 pieces of `useState`.

**Impact:** Matches the project's own measured size metrics and parked issue #457. No new risk beyond what's already tracked.

**Direction:** None beyond what #457 already proposes for `PoemsDashboard.tsx`.

## Security (SEC)

**Strengths:** The 2026-09-28 review's verdict — "unusually rigorous for a project this size" — still holds and has not drifted. `DELETE /api/account/delete` and `GET /api/account/export` authenticate the caller by handing their bearer token to Supabase Auth itself, so there is no path from a client-supplied id to someone else's account; the export route deliberately uses an RLS-enforced client, never the service-role key. The heartbeat cron secret is compared with `timingSafeEqual` after an explicit length check (correct use). The CSP (`src/proxy.ts` + `src/lib/csp.ts`) is a per-request nonce, no `'unsafe-inline'`, `frame-ancestors 'none'`, `object-src 'none'`, a narrow `frame-src` allow-list shared by the sanitiser so the two can't drift apart, plus `Referrer-Policy`, `X-Content-Type-Options`, and a restrictive `Permissions-Policy`. Poem HTML is sanitised through one shared DOMPurify config consumed identically by the client preview and the SSR share path, with embed URLs re-validated against an explicit allow-list. `SharedPoemView.tsx` layers a second, independent `script-src 'none'` CSP on its srcDoc iframe as a backstop against a DOMPurify bypass. No secrets were found in tracked files or a sample of git history.

### F-SEC-01 — Five unpatched npm audit advisories (2 critical, 3 high) live on `main`; fix already in flight · **Critical**

**Evidence:** `npm audit --json` run this session against `main` (`f08427a`) reports 5 unpatched advisories, all `fixAvailable: true` (non-major): `next` (2 critical: GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr; 1 high: GHSA-p3m5-59mp-jv5r), `dompurify` (1 critical: GHSA-cg2g-xh64-v4q7; 1 high: GHSA-mrv2-3pqr-j5jr), `markdown-it` (high, transitive via the pinned `poetic` tarball dependency), `vite` (high, dev-only), `zod` (high, transitive devDependency via `eslint-config-next` → `eslint-plugin-react-hooks`, no direct package to bump). Tracked in depth: issues #538, #539, #541, #542, #544, and PRs #545, #546, #547. Issue #541 diagnoses a structural gridlock (see F-CI-01): `CI`'s `Audit dependencies` job audits the whole tree and is a required, strict check, so no single-package bump PR can go green while other packages' advisories remain on `main` — #540, #535, #536 each independently hit this. PR **#546** bundles all five fixes (`next`→16.4.3, `dompurify`→3.4.17, `markdown-it`→15.0.3, `vite`→8.3.5, a `zod` `overrides` entry) and is, as of this review, `mergeStateStatus: CLEAN` / `mergeable: MERGEABLE` — ready to merge. Issue #542 (open) is the durable follow-up: a baseline/allowlist mechanism so a future single advisory doesn't re-create the gridlock.

**Impact:** Rated per the absolute-harm exception to the project-maturity moderation rule — a live critical/high advisory set is rated on the harm it could enable regardless of project size. The concretely reachable subset is narrower than "5 advisories" suggests: `next` and `dompurify` sit directly in the production request/render path (`next` is the framework itself; `dompurify` sanitises every poem rendered to a visitor), so those two carry real exposure until patched. `markdown-it` is pulled in transitively by the pinned `poetic` renderer and runs during rendering, behind the DOMPurify boundary. `vite` and `zod` are dev-only/test-toolchain and never ship to production.

**Direction:** Already in flight — do not propose a new fix. Merge PR #546 (currently green and mergeable) to clear all five; #542 remains open afterward as the durable structural fix. See R-01. *(DEPS dimension reports the same advisory set; see this finding rather than a separate DEPS entry.)*

### F-SEC-02 — Privacy Policy misdescribes the auth session storage mechanism as a cookie · **Low**

**Evidence:** `src/app/privacy/page.tsx` (~line 107) states: "We set only the essential cookie our authentication provider (Supabase) uses to keep you signed in." But `src/lib/supabase-client.ts` calls `createClient(...)` with no `auth.storage` option, and the repo has no `@supabase/ssr`, `createBrowserClient`, or `createServerClient` usage anywhere. `@supabase/auth-js`'s `GoTrueClient` defaults `storage` to `globalThis.localStorage` when none is given — i.e. the session is kept in the browser's `localStorage`, not a cookie.

**Impact:** A documentation-accuracy issue, not an exploitable defect; the nonce-based CSP already closes most of the practical XSS-exfiltration gap that localStorage-vs-cookie debates are usually about. It matters here because the Privacy Policy is the one place a non-technical poet is told how their session is kept, and the stated mechanism doesn't match the code.

**Direction:** Update the Privacy Policy wording to describe the actual mechanism. See R-07. *(Also reported from the DATA angle; recorded once here.)*

### F-SEC-03 — Sentry "no client-side collection" claim verified accurate in code · Informational

**Evidence:** `AGENTS.md` and `docs/TRIAGE.md` claim "there is no client-side collection." Verified: no `sentry.client*` file exists anywhere; `src/instrumentation.ts` only imports the server/edge configs. Both call `sentryInitOptions()` (`src/lib/observability.ts`), which sets `dataCollection` to an exhaustively `false`/`[]`-valued `Required<>`-typed object and a `beforeSend: scrubEvent` that strips cookies/headers/request body and truncates message/exception strings.

**Impact:** None — confirms the claim is accurate in code, not just prose.

**Direction:** No action; cited as evidence under OPS's strengths.

## Testing and quality assurance (TEST)

**Strengths:** 620/620 tests pass (59 files; confirmed this session), 90.54% stmts / 85.12% branch / 90.79% funcs / 92.42% lines, no flaky patterns found. Tests read as specifications: titles trace to ACs/issues, and assert behaviour not internals. The account delete/export paths explicitly test authorization boundaries and safe-failure. `supabase/tests/rls_test.sql` is an unusually strong security suite (34 pgTAP assertions covering cross-account writes, `share_id` un-forgeability, and that `get_shared_poem` leaks no `owner_id`). `src/lib/contrast.test.ts` parses `globals.css`'s live custom properties and asserts WCAG AA ratios against them.

### F-TEST-01 — Correct, reviewed coverage PR #537 stuck in draft 5 days, blocked by CI's audit gridlock, not its own content · **Low**

**Evidence:** PR #537 was verified sound by three independent automated review passes (2026-10-22→26); every blocking comment on the thread is the repo-wide `Audit dependencies` job, never the diff itself.

**Impact:** The TEST-side symptom of F-CI-01's structural finding — `PoemPreview.tsx`/`SharedPoemView.tsx` stay at current coverage indefinitely while it sits blocked.

**Direction:** No TEST-specific action; landing PR #546 should unblock it unchanged. See R-01.

### F-TEST-02 — Real-browser (Playwright) coverage exercises only signed-out states · **Medium**

**Evidence:** `e2e/a11y.spec.ts` and `e2e/poem-link-gestures.spec.ts` are the only two specs, both scoped to `/` and `/poems` signed-out — each file's own comments admit the signed-in/`/share/<id>` paths "need a live Supabase project this suite can't reach." `CONTRIBUTING.md` compensates by asking humans to manually run `docs/CSP-REVIEW-CHECKLIST.md` for related changes.

**Impact:** Save/share/remix/export/delete — including the native-`<dialog>` focus management in `AccountDangerZone.tsx` that has needed its own bug fixes (#470) — have zero automated real-browser coverage; jsdom cannot exercise layout, `showModal()` edge cases, iframe sandboxing, or CSP.

**Direction:** Scope a seeded/mocked Supabase fixture reachable from Playwright. See R-05 (bundled with F-UX-01).

### F-TEST-03 — `scripts/*.mjs` sit well below the rest of the codebase's coverage bar, including the privacy-export CLI entry point · **Low**

**Evidence:** `scripts/` averages 79.35%/76.35% (stmts/branch) vs. 96.53%/90.8% for `src/lib`. `export-poet-data.mjs` is 76.4%/64.28%, with lines 175-213/220-222 uncovered — `buildAdminClient()`'s env-var check, `defaultOutputPath()`, and `main()`'s arg parsing / `0o600` write / module-execution guard, i.e. the CLI entry point `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md` names for fulfilling a GDPR-style export request.

**Impact:** Lower severity than it looks — maintainer-run, not web-facing, fails loudly — but it's privacy-fulfilment and release-correctness tooling.

**Direction:** Add targeted tests for the untested branches. See R-10.

## Dependencies and supply chain (DEPS)

**Strengths:** Dependency hygiene is notably strong: a narrow, justified dependency list, a committed lockfile, a carefully engineered `scripts/check-dependency-audit.mjs` canary gate with a single tightly-scoped, self-expiring advisory exception, Dependabot grouping for peer-locked pairs (matches the prior 2026-09-28 review's R-01, now implemented), and a dedicated `check-poetic-release.yml` workflow compensating for the fact that `npm audit`/Dependabot cannot see inside the `poetic` tarball dependency.

*The five live advisories are reported under SEC as F-SEC-01 rather than repeated here.*

### F-DEPS-01 — Three permanent major-version holds in Dependabot, each independently justified · **Low**

**Evidence:** `.github/dependabot.yml`'s `ignore:` block holds `jsdom` (major — issue #86: jsdom 27+ pulls in an ESM-only `@exodus/bytes`, 500s `/share/<id>` under Turbopack on Vercel), `typescript` (major — `tech-debt/TD-PPpfid-26072429.md`: `typescript-eslint`'s peer range refuses to run past it), and `eslint` (major — same file: `eslint-config-next` still calls an ESLint-10-removed API). All three holds are current and verified against the installed toolchain this session.

**Impact:** Low — deliberate, documented, individually-justified holds; the risk is a hold's justification going stale without anyone revisiting it.

**Direction:** No action needed now; revisit periodically.

### F-DEPS-02 — `npm audit` cannot see inside the pinned `poetic` tarball dependency itself · **Low**

**Evidence:** `package.json`'s `poetic` dependency is a direct release-tarball URL, not an npm-registry package; `npm audit` has no advisory database entry for a non-registry tarball. The tarball's content is integrity-pinned via the lockfile hash, and `check-poetic-release.yml` separately watches for new upstream releases.

**Impact:** Low — a known, documented trade-off of the pinned-tarball consumption model (`AGENTS.md`), not an oversight.

**Direction:** No action needed; already compensated for as far as practical.

### F-DEPS-03 — Node 22.x (Maintenance LTS) pin · **Low**

**Evidence:** `package.json`'s `engines.node: "22.x"`. Node 22 enters end-of-life around April 2027.

**Impact:** Low; comfortably within support for the foreseeable future.

**Direction:** No action needed now; revisit as EOL approaches.

## Tooling and developer experience (TOOL)

**Strengths:** The clone-to-running path is genuinely followable — the README's script table matches `package.json` exactly. `.env.example` is a complete, commented contract. `.editorconfig`/`.prettierrc`/`eslint.config.mjs` are all committed and consistent, and `.nvmrc` agrees exactly with `engines.node`. `scripts/setup-linux.sh` is a small, correct, well-commented nvm shim.

### F-TOOL-01 — A contributor not on exactly Node 22.x has no in-repo guidance for the fix · **Low**

**Evidence:** `.npmrc`'s `engine-strict=true` + `"node": "22.x"` makes any other Node version a hard `EBADENGINE` failure. This review's own sandbox (Node 26.12.0) could only run `npm ci`/lint/typecheck/build by setting `npm_config_engine_strict=false`.

**Impact:** The pin is a legitimate, deliberate choice, but README's "Requires Node.js 22.x" gives no guidance for what to do if a contributor's global Node differs.

**Direction:** Add one sentence to README naming `nvm install 22 && nvm use`. See R-09.

### F-TOOL-02 — Every cut GitHub release is titled "Poetic", not "Poetic Fiddle" · **Low**

**Evidence:** `.github/workflows/release.yml` hardcodes `--title "Poetic ${{ steps.version.outputs.tag }}"`. Verified live: `gh release list` shows the one actual release titled `Poetic v0.1.0`. "Poetic" is a distinct, related upstream repository this one consumes.

**Impact:** Cosmetic but real — could conflate the two projects' release histories.

**Direction:** Change the literal to `"Poetic Fiddle ${{ steps.version.outputs.tag }}"`. See R-03.

### F-TOOL-03 — No up-front signal that local Supabase dev requires Docker · **Low**

**Evidence:** No `.devcontainer/`, `Dockerfile`, or `docker-compose*.yml`. `supabase start` shells out to Docker, but neither README nor `CONTRIBUTING.md` states Docker must already be running.

**Impact:** Minor — the Supabase CLI already owns the container layer.

**Direction:** Add one line to README. See R-09.

### F-TOOL-04 — One pre-existing ESLint warning ships un-suppressed on every lint run · **Low**

**Evidence:** `npm run lint` reports `AccountDangerZone.tsx:93`, against a deliberate full-page navigation (commented at the call site). Neither an inline `eslint-disable-next-line` nor a rule override silences it, and CI's `build` job does not fail on warnings.

**Impact:** A warning nobody needs to act on, left live indefinitely, makes a second, genuinely accidental warning easy to miss.

**Direction:** Add a targeted `eslint-disable-next-line`. See R-09.

## CI/CD and release engineering (CI)

**Strengths:** The `changes`/`workflow-wiring`/aggregating-`ci` pattern is unusually well engineered and self-documenting — it correctly solves GitHub's "skipped-but-required-check" trap, and `workflow-wiring` plus the scheduled `required-checks-drift.yml` make the required-check set self-auditing. The dependency-audit, changelog-rename, and release mechanisms are each deliberately designed against specific past failure modes, with the reasoning left in comments. Rollback (Vercel Instant Rollback) is clearly documented with real caveats.

### F-CI-01 — The required `Audit dependencies` check has no baseline against `main`, so 2+ simultaneous advisories create an unsequenceable, repo-wide merge deadlock · **Critical**

**Evidence:** `.github/workflows/ci.yml`'s `audit` job (lines 152–191) runs `npm run audit` over the whole tree, unconditionally, and feeds the required `ci` aggregator job under a ruleset with `strict_required_status_checks_policy: true`. Issue #541 tabulates the deadlock: PR #540 fixed `next`/`dompurify` but still failed on 3 other advisories; Dependabot PRs #535/#536 each failed on the others' advisories; no landing order worked. Issue #542 names the root cause: the gate has "no notion of which advisories were already present on `main` before the PR branched."

**Impact:** A CI *design* defect independent of today's specific advisories — #542's own diagnosis states "the same deadlock will re-form the next time any single package picks up a high-severity advisory before its fix lands." It has already cost multiple review cycles and 4+ filed issues. A tree-wide, no-baseline, strict-required gate is a single point of total repo paralysis.

**Direction:** Already in flight — do not duplicate. #542 is the tracked durable fix. See R-01.

### F-CI-02 — The migration-deploy job is permanently disabled, but a living doc still describes it as automatic · **Medium**

**Evidence:** `ci.yml`'s `deploy` job carries `if: false` (lines 338–353) with a comment explaining the live Supabase project was dropped (#418/#422). But `docs/IMPLEMENTATION-PLAN.md` §6.2 still states in the present tense that a `database.yml` workflow's `deploy` job "runs that push against the live project automatically once a migration-touching PR merges to `main`" — both the filename and the "runs...automatically" claim are stale.

**Impact:** A migration merged to `main` today does not reach production through any automated path, and nothing in the repo's docs says so plainly outside a code comment. Moot in practice while no live Supabase project exists (F-OPS-01), but the doc inaccuracy is real regardless.

**Direction:** Update `IMPLEMENTATION-PLAN.md` §6.2 to describe the current state as-built. See R-04.

### F-CI-03 — `CONTRIBUTING.md`'s audit-failure guidance only anticipates a single advisory · **Low**

**Evidence:** `CONTRIBUTING.md` tells a contributor the audit step "names a specific advisory" to fix — exactly the assumption that led PR #540's author, and Dependabot's #535/#536, to each independently hit the same dead end before #541 diagnosed the real shape of the problem.

**Impact:** Low since the pipeline's review process eventually catches this, but costs a cycle each time.

**Direction:** Moot once #542 lands; no standalone action recommended.

## Performance and scalability (PERF)

**Strengths:** `src/lib/supabase-fetch.ts` wraps every Supabase call in a 12s abort-bounded fetch, applied globally rather than per call site. `src/lib/use-poem-crud.ts` debounces live-preview rendering rather than recomputing on every keystroke. `src/app/api/account/export/route.ts` paginates its full-table export correctly.

### F-PERF-01 — `listPoems` has no pagination/limit on a poet's saved-poems query · **Low**

**Evidence:** `src/lib/poems-store.ts:170-176` — `listPoems(ownerId)` selects all rows matching `owner_id` with no `.limit()`/range, rendered in full by `PoemsDashboard.tsx`.

**Impact:** Low given the RLS-scoped, single-poet nature of the list, but flagged per the "minimal-cost architecture" goal in `AGENTS.md`.

**Direction:** Add a page size/limit if poem counts per account are expected to grow. See R-11.

## Usability and accessibility (UX)

**Strengths:** `SignInPrompt.tsx` uses a native `<dialog>` with explicit focus-capture/restore logic, proper label pairing, `aria-describedby`, and `role="alert"`/`role="status"`. `src/lib/auth-error.ts` maps every Supabase Auth error code to a specific, plain-English message. `src/lib/contrast.test.ts` extracts live hex values from `globals.css` and asserts WCAG AA for every pairing in both themes. `e2e/a11y.spec.ts` exists specifically because jsdom's `color-contrast` rule silently never runs.

### F-UX-01 — Real-browser colour-contrast coverage never reaches the public share page or any signed-in state · **Medium**

**Evidence:** `TD-PPpfid-26080109` is marked resolved by PR #194, which added `e2e/a11y.spec.ts` — but that suite only scans two signed-out routes (`/`, `/poems`), per its own comment, because a live Supabase project is needed to reach signed-in states and `/share/<id>`, and none currently exists (F-OPS-01). jsdom-based suites cover signed-in structural checks but cannot run `color-contrast` at all.

**Impact:** `/share/<id>` is the project's most public-facing surface, and the one with zero automated contrast coverage of any kind — a regression there would ship silently.

**Direction:** Extend `e2e/a11y.spec.ts` once a reachable fixture exists. See R-05.

### F-UX-02 — Internationalisation: deliberately out of scope, not a gap · Informational

**Evidence:** `lang="en"` is hardcoded; `docs/IMPLEMENTATION-PLAN.md` explicitly lists English-only as a stated MVP non-goal; `docs/REQUIREMENTS.md` §12.7 addresses it directly.

**Impact:** A reasonable, deliberate scope boundary for a solo-maintainer MVP.

**Direction:** None needed.

## Documentation (DOC)

**Strengths:** `TRIAGE.md`, `SENTRY-AGENT-ACCESS.md`, `OBSERVABILITY-PLAN.md`, `PRIVACY-EXPORT-DELETE-RUNBOOK.md`, and `CSP-REVIEW-CHECKLIST.md` all cite real, currently-existing file paths and function names. `docs/RELEASE-RUNBOOK.md`'s procedure matches `release.yml` step-for-step except for the title bug (F-TOOL-02). `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md` matches the actual account routes exactly.

### F-DOC-01 — `AGENTS.md`'s status line says M8/M9 work "remains" when `IMPLEMENTATION-PLAN.md` §4 shows every W-item delivered · **Medium**

**Evidence:** `AGENTS.md`'s "Status and plan" section states M0–M7 are delivered and that §4 "lists the W-series items that remain." But `docs/IMPLEMENTATION-PLAN.md:476-556` lists every item W5 through W16 marked **"done"**, each with a landed PR cited.

**Impact:** `AGENTS.md` is the entry point every agent and contributor reads first, and in this repo's multi-agent pipeline it is read fresh by every new session. A moment of confusion at best, a wasted investigation at worst. Rated Medium rather than High: self-correcting on reading §4, nothing is blocked by it.

**Direction:** Update both documents' headline status to say M0–M9 are delivered. See R-03.

### F-DOC-02 — The only cut GitHub release (`v0.1.0`) predates nearly the entire feature set · **Medium**

**Evidence:** `package.json`'s `version` is still `"0.1.0"`; the one GitHub release is tagged 2026-07-12, before M2 even landed. 313 commits have landed since.

**Impact:** `docs/RELEASE-RUNBOOK.md` documents a correct procedure, but GitHub's Releases page misleadingly signals the project's maturity.

**Direction:** Cut a release reflecting MVP completion. See R-03.

### F-DOC-03 — `docs/REQUIREMENTS.md` embeds a maintainer-local filesystem path · **Low**

**Evidence:** The document lists reference repositories with a `(local: /home/wallen/Code/...)` annotation.

**Impact:** Trivial; the document declares itself a working registry rather than an as-built doc.

**Direction:** Optional cleanup only, next time the file is touched for substantive reasons — not worth a standalone edit.

## Governance and project health (GOV)

**Strengths:** Licence, ownership and contribution surfaces are all present and consistent. `AGENTS.md` is unusually candid about the project's own structural limits — self-review by one person, no succession plan — rather than letting the branch-protection rule names imply a healthier picture. The "Parked issues" convention is applied correctly.

### F-GOV-01 — Single maintainer, self-review-by-design, no succession plan · **Medium**

**Evidence:** `AGENTS.md`'s "Governance" section states plainly: "There is also no succession plan: if the maintainer becomes unavailable, no one else currently holds equivalent access or repo context."

**Impact:** A real but disclosed, proportionate bus-factor risk for a solo side project.

**Direction:** No action needed now; add a genuine second CODEOWNERS reviewer if a real second contributor ever joins. No recommendation written.

### F-GOV-02 — Maintainer-flagged "obsolete" draft PR stayed open 16+ days despite two pipeline close-out attempts · **Low**

**Evidence:** PR #510, open since 2026-10-07. The maintainer applied the `obsolete` label 2026-10-11; two pipeline comments (2026-10-11, 2026-10-17) record it as void and say the void sweep will close it — it remains open, now `mergeStateStatus: DIRTY`. One comment self-diagnoses: "the engagement that posted the comment above wrote its comment to GitHub but left no verdict in the register."

**Impact:** Low stakes (docs-only draft) but shows the pipeline's close-out path can silently fail more than once.

**Direction:** Close PR #510 by hand. See R-06.

### F-GOV-03 — `main` has not advanced in 9 days due to the dependency-audit gridlock · **Medium**

**Evidence:** `main`'s last commit `f08427a` landed 2026-10-18; this review is dated 2026-10-27. Nine PRs sit open, several shaped directly by the gridlock (F-CI-01/F-SEC-01).

**Impact:** The structural fact that one new advisory can freeze all forward progress on `main` for over a week is a process-health signal in its own right.

**Direction:** Land #546, then prioritise #542. See R-01.

### F-GOV-04 — Issue tracker is majority pipeline self-bookkeeping, not product work · **Low**

**Evidence:** Of 13 open issues at review time, 7 are Pullwright pipeline-process bookkeeping, not Poetic Fiddle product/code issues; 5 concern the dependency incident; 1 is deliberately parked.

**Impact:** Inflates the apparent open-issue count without reflecting actual product neglect.

**Direction:** No action for this repo specifically. No recommendation written.

## Observability and operations (OPS)

**Strengths:** `src/lib/observability.ts`'s `dataCollectionConfig` is a literal `Required<>` typed over the Sentry SDK's own option, so a future SDK release adding a category fails typecheck rather than silently collecting. `docs/TRIAGE.md` and `docs/SENTRY-AGENT-ACCESS.md` are concrete and usable, documenting a real worked incident and an honestly-stated gap. Resilience code is consistently defensive, not a one-off patch: `draft-storage.ts` wraps all three Storage methods, `createTimeoutFetch` is wired globally, and `poems-store.ts` uses typed domain errors throughout.

### F-OPS-01 — No live Supabase project backs production; there is currently no backup/restore coverage of any kind · **High**

**Evidence:** `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md`: "As of #418 and #422, the organisation deleted the Supabase project and moved to the free tier. There is currently no live Supabase project backing the app, and therefore no backup or PITR coverage of any kind." `docs/IMPLEMENTATION-PLAN.md` §6.3 confirms the state is "indefinite, to be revisited if usage or cost changes."

**Impact:** The single most important OPS fact about the project right now, and it is current state, not resolved history: every poet-facing feature that depends on Supabase (sign-in, save, share, remix) is presently non-functional in production, by design and disclosed, degrading gracefully.

**Direction:** A disclosed business decision, not a hidden defect. When a live Supabase project is restored, re-establish a backup/PITR posture as part of that restoration. See R-02.

### F-OPS-02 — O4 (cron/uptime monitor) remains unconfigured, and currently has no live target to monitor · **Low**

**Evidence:** `docs/IMPLEMENTATION-PLAN.md` W16 states O4 needs a human to point Sentry's dashboard at the heartbeat route — outside what the pipeline's read-only Sentry credential can do.

**Impact:** Minor, already flagged as a human-only step; moot while no Supabase project is live.

**Direction:** Bundle with Supabase-project restoration. See R-02.

### F-OPS-03 — Defensive-storage pattern is applied consistently, not as a one-off patch · Informational

**Evidence:** Commit a57dc2e extended `getStorage()`'s guard from only the localStorage accessor to all three Storage methods. The same posture is systemic elsewhere: `createTimeoutFetch` is global, `probeBackendHealth()` never throws, `poems-store.ts` throws typed errors everywhere.

**Impact:** The pattern generalises rather than being patched only where an issue happened to be filed.

**Direction:** None needed; recorded as a strength.

## Data handling and privacy (DATA)

**Strengths:** The personal-data inventory in `src/app/privacy/page.tsx` matches what the code actually does. Self-service export/delete match `docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md` precisely: delete authenticates via the caller's own bearer token and cascades through database-level foreign keys (genuine hard delete, no soft-delete flag to later leak); export avoids the service-role key, so RLS — not a hand-written filter — confines every read. Both export paths page through results unconditionally, avoiding the silent-truncation bug fixed as issue #352. Test fixtures use only synthetic `*.test` domain emails — no real personal data found anywhere in the repository or a sample of git history. The NZ Privacy Act 2020 framing is used consistently and correctly.

*The Privacy Policy's cookie-vs-localStorage mismatch is reported under SEC as F-SEC-02.*

### F-DATA-01 — No live Supabase project currently backs production: backup/PITR and export/delete are currently untested against production data · **Low**

**Evidence:** Same underlying fact as F-OPS-01, reported here for its data-privacy angle: while no live project exists, the data-subject rights machinery (export, delete, RLS, cascade) is exercised only by the pgTAP suite and local Supabase, not against a production dataset, and there is no backup/PITR coverage to fall back on if a project is reinstated and immediately suffers data loss before new backup coverage is configured.

**Impact:** Not a defect — accurately documented, not a stale claim. Recorded as a DATA-specific consequence of F-OPS-01's current-state fact.

**Direction:** When a Supabase project is reinstated, confirm backup/PITR coverage is deliberately chosen as part of that reinstatement. See R-02.
