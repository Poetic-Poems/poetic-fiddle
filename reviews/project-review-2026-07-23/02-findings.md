# Findings

Findings are organised by review dimension, in the checklist's order. Each
carries a stable ID (`F-<DIM>-<NN>`), a severity, the concrete evidence it
rests on, and its impact for this project specifically. Strengths are
recorded per dimension as well as weaknesses, so the reader knows what to
preserve, not just what to fix.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 7 |
| Medium | 20 |
| Low | 27 |

## Architecture and design (ARCH)

**Strengths:** The `app/` → `components/` → `lib/` layering is real and
followed consistently — route files stay thin and delegate to components;
`lib/` modules are single-purpose with unusually thorough rationale comments
explaining *why* a boundary sits where it does (e.g. `src/lib/get-shared-poem.ts`'s
header on why it is separate from `src/lib/poems-store.ts`, so the SSR share
path never transitively imports the browser Supabase client). Configuration/
secrets handling is a genuine strength: `.env.example` documents a clear
two-tier sensitivity model, and `src/lib/supabase-server.ts` builds its
client lazily specifically to avoid a module-level throw during Next's
page-config collection. The `poetic` cross-repo dependency is a deliberate,
reviewable, integrity-hashed tarball pin, and `src/lib/render-share.test.ts`
genuinely exercises that seam by importing the real `poetic/browser`
package and asserting on its actual rendered output rather than a mock.

### F-ARCH-01 — Shared analysis-toggle code is tested only against a hand-authored fixture, never against real poetic output · **Medium**

**Evidence:** `src/components/PoemPreview.tsx`'s `wireAnalysisToggles` (lines 17–62) is the shared DOM-wiring logic both the live editor preview and the SSR share page (`src/components/SharedPoemView.tsx`) depend on. Its only test, `src/components/PoemPreview.test.tsx`, builds its own `ANALYSIS_HTML`/`SELECTOR_HTML` strings by hand rather than running real `.poem` source through `renderPoem()`/`DOMPurify`. By contrast, `src/lib/render-share.test.ts` (the other side of the same pipeline) imports the real `poetic/browser` package and renders real source.

**Impact:** This is exactly the cross-tool-seam gap the review checklist calls out: the producer (poetic's Pug template markup) and consumer (Fiddle's DOM-wiring assumptions) are each tested only against their own side's assumptions. Not hypothetical — `TECH-DEBT.md` already records two prior incidents in this exact area (TD26071401, TD26071602), both resolved the same hand-authored way. A future poetic release renaming an Analysis class/id would silently break both preview surfaces with CI still green.

**Direction:** Add a test piping real `.poem` source containing `{Analysis}` through `renderPoem()` and `wireAnalysisToggles`, mirroring `render-share.test.ts`'s pattern. Addressed by R-22.

### F-ARCH-02 — `Editor.tsx` is the repo's largest and highest-fan-out module, mixing five concerns · **Medium**

**Evidence:** `src/components/Editor.tsx` is 581 lines, ~1.6x the next largest source file. It owns session-migration state-machine logic run during render, anonymous draft persistence, debounced client-side rendering, five distinct data-mutation flows against `poems-store.ts` each with its own loading/error state, and the CodeMirror + preview presentation itself. It is the sole importer of `loadPoem`, `savePoem`, `sharePoem`, `unsharePoem`, and `updateAllowRemix` together.

**Impact:** Currently proportionate — thoroughly tested (five dedicated test files) and well-commented, so not undocumented tangling. But it is the one place with a real god-object risk as Phase 2 features (docs/IMPLEMENTATION-PLAN.md §5) land; the pattern so far has been to add orchestration directly into this file rather than extracting a data/session layer.

**Direction:** Extract the non-presentational state machine (session migration, draft adoption, save/share/remix orchestration) into one or more hooks before the next feature touching save/share/session logic. Addressed by R-21.

### F-ARCH-03 — Two independently-maintained sanitisation pipelines for the same untrusted-content boundary · **Low**

**Evidence:** `src/components/PoemPreview.tsx:73` sanitises with browser DOMPurify, default config. `src/lib/render-share.ts:44-98` sanitises the same kind of output with a second, independently configured pipeline (server-side jsdom + DOMPurify, `RETURN_DOM_FRAGMENT`, plus custom embed-activation logic with its own allow-list).

**Impact:** The divergence is intentional and each side is commented with its rationale (AC24/AC25/AC86), which meaningfully lowers the risk. Still, it is two hand-maintained implementations of "sanitise poetic's rendered HTML," with no shared allow-list or config object between them.

**Direction:** Not urgent given the size of the surface; worth a shared constant/module for anything both pipelines need to agree on. Addressed by R-32.

### F-ARCH-04 — Cross-tool seam contract validation beyond the DOM-wiring gap · **N/A (recorded explicitly)**

**Evidence:** The `.poem` format's own parse/render contract is exercised with real data (`render-share.test.ts`, `poem-title.test.ts`). `src/types/poetic.d.ts` is a hand-written ambient shim with no automated check that its declared surface still matches poetic's actual exports after a version bump.

**Impact:** Low — a shim drift would most likely surface as a build-time type error or an obvious runtime `undefined`, not a silent behavioural regression.

**Direction:** No action needed beyond what's already tracked (TD26071301). No recommendation written.

## Code quality and maintainability (CODE)

**Strengths:** The codebase is unusually consistent and disciplined for its size. ESLint, Prettier and TypeScript strict mode are all clean, and beyond what a linter catches: zero `any` types, zero `eslint-disable`/`@ts-ignore`/`@ts-expect-error` escape hatches, zero `TODO`/`FIXME`/`HACK`/`XXX` markers, zero stray `console.*` calls anywhere in `src/`. Nearly every module carries a doc comment explaining *why* a design choice was made, consistently cross-referencing acceptance criteria and `TECH-DEBT.md` IDs — e.g. `src/lib/poems-store.ts` gives every Supabase-backed operation its own typed `Error` subclass with a safe, user-facing message.

### F-CODE-01 — Editor.tsx is a 581-line orchestrator with 12+ pieces of state · **Medium**

**Evidence:** 13 `useState`/`useRef` hooks, render-during-render draft-migration logic, four independent async handlers each with a repeated "save-if-needed" sub-pattern, and ~200 lines of JSX. Six separate test files exist just to cover it.

**Impact:** One file reconciles draft-vs-account state, four separate Supabase write flows, and the entire editor UI — a signal the component covers more than one concern.

**Direction:** Extract save/share/unshare/allow-remix persistence into a dedicated hook (e.g. `usePoemPersistence`). Addressed by R-21.

### F-CODE-02 — Auth errors bypass the codebase's own safe-message convention · **Medium**

**Evidence:** `src/lib/poems-store.ts` wraps every Supabase-backed operation in a dedicated `Error` subclass whose message is documented as "safe to show a poet as-is." `src/components/SignInPrompt.tsx` does not follow this: it shows raw `error.message` from Supabase Auth calls directly at lines 70, 81, 92.

**Impact:** Supabase Auth's raw error strings reach the sign-in dialog unfiltered — a real inconsistency in error-handling idiom, not a style nit.

**Direction:** Route auth errors through the same safe-message pattern `poems-store.ts` uses. Addressed by R-08.

### F-CODE-03 — Identical mock/fixture boilerplate duplicated across six Editor test files · **Low**

**Evidence:** `Editor.open/.remix-permission/.remix/.save/.share/.test.tsx` each repeat the same `vi.mock(...)` blocks, an identical `SESSION` constant, and an identical `beforeEach`. No shared test-helper module exists.

**Impact:** A change to session mocking or the fixture shape must be made correctly in up to six places; three of the six files already mock a slightly different subset of `poems-store` functions from the boilerplate they otherwise share verbatim.

**Direction:** Factor shared mocks/fixtures/`beforeEach` into a small `editor-test-support.ts` helper. Addressed by R-24.

### F-CODE-04 — `err instanceof Error ? err.message : String(err)` duplicated 10 times · **Low**

**Evidence:** Verbatim in `src/components/Editor.tsx` (7 call sites) and `src/components/PoemsDashboard.tsx` (3 call sites).

**Impact:** The one piece of genuinely repeated logic in app code; any future change needs 10 hand-updated call sites.

**Direction:** Extract a one-line `errorMessage(err: unknown): string` helper. Addressed by R-24.

### F-CODE-05 — Page-header JSX repeated across three route components · **Low**

**Evidence:** `src/app/page.tsx`, `src/app/poems/[id]/page.tsx`, `src/app/poems/page.tsx` each inline the same header markup.

**Impact:** Cosmetic at three instances; a future styling change requires three synchronized edits.

**Direction:** Extract a `PageHeader` component if a fourth route header is added. Addressed by R-24.

## Security (SEC)

**Strengths:** No secrets found in the repo or its git history. RLS is default-deny and precisely scoped, backed by a 34-assertion pgTAP suite that proves cross-user access is genuinely denied, not just empty. There is defense-in-depth XSS handling of untrusted poem content at both places poem HTML is produced (client preview and server share page), each independently sanitised and further constrained by iframe sandboxing and CSP. Nonce-based CSP is correctly wired with no `unsafe-inline` regression. `SECURITY.md` has a real disclosure route (GitHub private vulnerability reporting) plus CodeQL on every PR/push.

### F-SEC-01 — `next` is one patch behind on a build that genuinely exercises Server Actions · **High**

**Evidence:** `package.json` pins `next@16.2.10`; `npm audit` reports 3 high-severity advisories fixed in `16.2.11`, including several scoped to Server Actions handling and the proxy/middleware layer. `src/lib/revalidate-share.ts` has a live `"use server"` export called from `Editor.tsx` on every save of a shared poem — not a dormant feature. `eslint-config-next` was already bumped in lockstep in PR #94; `next` itself was not.

**Impact:** These advisories target the framework's own request-handling code for a feature this app actually uses in production. Worst-case outcomes (DoS, disclosure of internal endpoint existence) are bounded — no secret disclosure or RCE implicated — so High rather than Critical.

**Direction:** Bump `next` to `^16.2.11`. Addressed by R-01.

### F-SEC-02 — Unauthenticated cache-bust of arbitrary share-page cache entries · **Low**

**Evidence:** `revalidateSharedPoem(shareId)` is a Server Action with no authorization check on `shareId` before invalidating its cache tag.

**Impact:** Low in practice — `share_id` is a 122-bit random token, so an attacker would already need to know a specific id, and knowing it already lets them view that page anyway. Effect is a forced cache miss, not data exposure.

**Direction:** Not urgent at current design; add an ownership check if this pattern is reused for a less entropy-rich identifier. Addressed by R-25.

### F-SEC-03 — Password sign-up allows 6-character passwords with no strength guidance · **Low**

**Evidence:** `src/components/SignInPrompt.tsx:160` sets `minLength={6}`, mirroring Supabase Auth's own default minimum.

**Impact:** Low — not a bug introduced by Fiddle, and password auth is a fallback behind magic-link/Google-OAuth-first UI. Still weak for an account holding a poet's saved work.

**Direction:** Raise `minLength` to ~8-10. Addressed by R-25.

## Testing and quality assurance (TEST)

**Strengths:** Near-1:1 test-to-source mapping; the riskiest paths (RLS, sanitisation, auth, mutations) are the best-tested paths, with a 34-assertion pgTAP suite for RLS and a genuinely hostile fixture for the sanitisation boundary. Tests assert behaviour, not implementation (zero snapshots). No obvious flaky patterns. CI gate matches the local command.

### F-TEST-01 — `use-session.ts`, the app's auth-state hook, has no direct test · **Medium**

**Evidence:** No `use-session.test.ts` exists; every consumer mocks `useSession` entirely, so the hook's real logic is never executed by the suite.

**Impact:** A regression (forgetting to unsubscribe, a race between `getSession()` and a later auth event) would go uncaught. This hook gates all owner-scoped, RLS-backed operations, so it is correctness/security-adjacent.

**Direction:** Add `src/lib/use-session.test.ts` mocking the Supabase client directly. Addressed by R-10.

### F-TEST-02 — `SharedPoemView`'s hand-rolled HTML escaping is untested · **Medium**

**Evidence:** `src/components/SharedPoemView.tsx` interpolates a poet-controlled `title` into a CSP-bearing HTML template via a local, non-exported `escapeHtml`, with no test file.

**Impact:** `escapeHtml` looks correct on inspection, but nothing would fail if a future edit narrowed the escaped set. The title is derived from user-supplied `.poem` source, so this is attacker-reachable input into raw HTML with no automated backstop.

**Direction:** Add `SharedPoemView.test.tsx` with a hostile title and assert the `srcDoc` doesn't break out of the `<title>` tag or CSP `<meta>` attribute. Addressed by R-10.

### F-TEST-03 — No coverage tool is configured anywhere in the toolchain · **Low**

**Evidence:** No `test.coverage` block in `vitest.config.ts`; no coverage dependency or script.

**Impact:** Proportionate to project stage, but it's also how F-TEST-01/02 went unnoticed — a coverage report would have surfaced both automatically.

**Direction:** Add `@vitest/coverage-v8` and a `coverage` script. Addressed by R-26.

### F-TEST-04 — No documented/scripted watch-mode workflow for local test-driven work · **Low**

**Evidence:** `package.json`'s only test script is `"test": "vitest run"` (single-shot).

**Impact:** Minor — the full suite already runs in ~6.9s.

**Direction:** Add a `test:watch` script. Addressed by R-26.

## Dependencies and supply chain (DEPS)

**Strengths:** A lean, justified direct dependency set (12 runtime deps, all traceable to a real feature). Lockfile is committed and genuinely pins, including the non-registry `poetic` tarball with a real integrity hash. The `poetic` pin is documented, not incidental, and verified current as of this review. A transitive vulnerability (postcss XSS) was proactively force-patched via `overrides`. Dependabot is configured and demonstrably working (steady stream of merged bump PRs). The jsdom major-version hold (TD26071901) is a model of how to document a deliberate hold.

### F-DEPS-01 — The two automated channels that should surface `next`'s known high-severity issues are both currently silent · **High**

**Evidence:** No Dependabot PR bumps `next` even though sibling package `eslint-config-next` went `16.2.10`→`16.2.11` same-day in merged PR #94; `dependabot.yml` has no ignore rule for `next`. `gh api .../dependabot/alerts` returns exactly one alert total (an already-fixed, unrelated postcss issue) — none of the `next`/`fast-uri`/`sharp` GHSAs appear as alerts.

**Impact:** Both standing automated signals for this exact class of problem are quiet right now; absent this review's manual audit, nobody would currently be notified.

**Direction:** Open the `next` bump manually now; confirm Dependabot security updates are enabled in repo settings. Addressed by R-01.

### F-DEPS-02 — No mechanism detects a new `poetic` release; the pin happens to be current today, but nothing would notice if it weren't · **Medium**

**Evidence:** `poetic` installs from a GitHub release-tarball URL, which Dependabot's npm updater doesn't support. No script/workflow polls `Poetic-Poems/poetic`'s releases.

**Impact:** `poetic` is this app's single source of truth for rendering — the dependency where currency matters most — yet it's the one with zero automated freshness signal. Latent, not active (currently up to date).

**Direction:** Add a small scheduled workflow comparing the pinned tag against `poetic`'s latest release, mirroring the existing `td-tooling-drift.yml` pattern. Addressed by R-19.

### F-DEPS-03 — `engines.node` and the README's stated minimum Node version disagree, and nothing enforces either locally · **Low**

**Evidence:** `package.json` pins Node `22.x`; `README.md` says "Requires Node.js >=20.9". No `engine-strict` in `.npmrc`.

**Impact:** Low direct risk, but this project already had one Node-runtime/module-format production incident (TD26071901), making an inaccurate stated minimum a worse-than-average place for this inconsistency to sit unnoticed.

**Direction:** Align README with `package.json`. Addressed by R-07.

### F-DEPS-04 — Two devDependency major-version holds (`typescript`, `eslint`) are undocumented, unlike the jsdom precedent this repo already established · **Low**

**Evidence:** `typescript` pinned `^5` (latest `7.0.2`, two majors ahead); `eslint` pinned `^9` (latest `10.7.0`, one major ahead). Dependabot proposed both (PR #9, #10, closed unmerged) with no ignore rule or documented reason.

**Impact:** Low — dev-only tooling, lint/typecheck clean on current pins — but the undocumented decision leaves no institutional memory of whether this was a deliberate risk call.

**Direction:** Merge current-generation bumps if low-risk, or add a `TECH-DEBT.md` entry matching jsdom's style. Addressed by R-27.

## Tooling and developer experience (TOOL)

**Strengths:** Formatter/linter/editor config are all committed and consistent (`.editorconfig`, `.prettierrc`, `eslint.config.mjs`). README's commands table is accurate as far as it goes. The `poetic` CSS-sync postinstall hook is well-designed for the common case, resolving via the dependency's own `exports` map. `.githooks/` is real, not aspirational — `commit-msg` and `post-checkout` are present, executable, and behave exactly as CLAUDE.md describes, failing open when offline.

### F-TOOL-01 — `npm run dev` silently ships a broken editor pane when `.env.local` isn't configured, and README doesn't flag this as a prerequisite · **High**

**Evidence:** `src/lib/supabase-client.ts` throws at module-evaluation time if the two `NEXT_PUBLIC_SUPABASE_*` vars are unset; `Editor.tsx` statically imports from that module. Verified live: `npm run dev` with no `.env.local` starts cleanly and serves HTTP 200 (the throw only executes client-side, since `Editor` loads via `next/dynamic(..., { ssr: false })`), confirmed present in the shipped client bundle. No `src/app/error.tsx` exists to turn this into a friendly message. README sequences env setup as a separate, later section, not a prerequisite before `npm run dev`.

**Impact:** This is the single most likely way a newcomer's "clone → follow instructions" path breaks in practice: the failure is silent at the HTTP layer (200 OK) and visible only in the browser console.

**Direction:** Reorder README so env setup precedes `npm run dev`, and add a `src/app/error.tsx` recognising this specific error. Addressed by R-06.

### F-TOOL-02 — README steers newcomers toward a live Supabase cloud project; the repo's own local-only dev path (`supabase start`) goes unmentioned · **Medium**

**Evidence:** `supabase/config.toml` and migrations fully support `supabase start` — the same command `database.yml`'s `test` job and `package.json`'s `test:db` script both depend on. README only describes provisioning real cloud credentials.

**Impact:** A newcomer wanting to develop data-layer features is pointed exclusively at cloud credentials, when the repo already ships a fully local, zero-cloud dev loop.

**Direction:** Add a "Local-only Supabase" note to README. Addressed by R-15.

### F-TOOL-03 — README's commands table omits two real, developer-relevant `package.json` scripts · **Low**

**Evidence:** `package.json` defines `start` and `test:db`; neither appears in README's table.

**Impact:** Minor — `npm start` is guessable, but `test:db` requires knowing the Supabase CLI is involved at all.

**Direction:** Add both rows. Addressed by R-28.

### F-TOOL-04 — The WSL npm-shadowing workaround (`scripts/setup-linux.sh`) is documented only in its own header comment and an agent-only skill file · **Low**

**Evidence:** No reference anywhere in README.md/CLAUDE.md; the only mention is in `.claude/skills/td/SKILL.md` (agent tooling, not human-facing).

**Impact:** A human contributor on WSL has no signpost to this script.

**Direction:** One line in README pointing to it. Addressed by R-28.

### F-TOOL-05 — No `.nvmrc`/`.node-version` file, despite `engines.node` being pinned and tooling built around `nvm` · **Medium**

**Evidence:** `scripts/setup-linux.sh` runs `nvm use node` before every command, but no `.nvmrc` exists to make that resolve to `22.x`; `.npmrc` has no `engine-strict=true` either.

**Impact:** Nothing lets `nvm`/`fnm`/`asdf`/Volta auto-select the pinned version, and nothing locally enforces it — only CI enforces it, after the fact.

**Direction:** Add a one-line `.nvmrc` (`22`). Addressed by R-07.

### F-TOOL-06 — `sync-poetic-css.mjs`'s postinstall step fails with a raw Node stack trace, not an actionable message · **Low**

**Evidence:** `scripts/sync-poetic-css.mjs:16` calls `require.resolve(...)` with no `try`/`catch`.

**Impact:** Low — only fires on a deliberate `poetic` bump gone wrong, and fails loudly (correctly), but with a generic trace instead of a pointer to the fix.

**Direction:** Wrap in `try`/`catch` and rethrow with a message naming the pinned version. Addressed by R-28.

## CI/CD and release engineering (CI)

**Strengths:** Pipeline coverage is genuinely broad and well-separated across five workflows, each documenting its own rationale inline. `database.yml`'s live-migration push (TD26071805) is now solid — gated on the pgTAP suite passing first, failing loudly on error. `release.yml`'s versioning is coherent and race-safe against re-runs. `commit-format.yml` correctly avoids `pull_request_target`, so a fork PR never runs the check with write-scoped secrets.

### F-CI-01 — Branch protection does not actually require `build.yml`, `commit-format.yml`, or `database.yml`'s `test` job to pass before merge, contradicting CLAUDE.md's own description of the gate · **High**

**Evidence:** `gh api repos/Poetic-Poems/poetic-fiddle/rulesets/18828479` shows the active ruleset enforces deletion protection, non-fast-forward, 1 approving code-owner review, CodeQL at `high_or_higher`, and Copilot code-quality — but no `required_status_checks` rule naming `build`/`commit-format`/`database.yml`'s `test` job. A merged PR (#96) happened to show all checks green, but nothing in the ruleset requires that.

**Impact:** A PR with failing lint/typecheck/tests/build, or a non-Conventional-Commits title, could be merged today provided it gets one code-owner approval — the exact scenario `build.yml` exists to prevent. This matters more in a repo CLAUDE.md explicitly describes as multi-agent, where autonomous agents may push/merge at any time.

**Direction:** Add a `required_status_checks` rule to the ruleset naming `build`, `commit-format`, and `database.yml`'s `test` job. Addressed by R-03.

### F-CI-02 — GitHub's auto-generated release notes and the hand-maintained `CHANGELOG.md` are two independent, unreconciled records of "what shipped" · **Medium**

**Evidence:** `release.yml` creates each release with `--generate-notes` (from merged PR titles), a separate content stream from `CHANGELOG.md`'s manually curated `[Unreleased]` section. No step reconciles the two; `package.json`'s version (`0.1.0`) still matches the sole existing tag even as `CHANGELOG.md` already lists substantial shipped features.

**Impact:** Once a second release is cut, the two records will describe the same version differently, with no process step or automated check keeping them aligned.

**Direction:** Have `release.yml` pull its body from `CHANGELOG.md`'s section for the version being tagged, or add a check that a version-bump PR renames `[Unreleased]`. Addressed by R-20.

### F-CI-03 — `database.yml` pins the `setup-cli` action version but not the Supabase CLI version it installs · **Medium**

**Evidence:** Both jobs use `supabase/setup-cli@v3` with `version: latest`, in contrast to `build.yml`'s exact Node/npm pinning.

**Impact:** A new Supabase CLI release landing between two runs can change `supabase start`/`test db`/`db push` behaviour without any corresponding repo change, for both the PR-gating and production-touching jobs.

**Direction:** Pin `version:` to an exact release and bump deliberately. Addressed by R-13.

### F-CI-04 — CI installs npm via a floating major-version tag (`npm@12`), unlike Node's exact pin · **Low**

**Evidence:** `build.yml` runs `npm install -g npm@12`, installing whatever the newest `12.x.y` is at run time.

**Impact:** Low — npm's within-major compatibility is strong — but avoidable in an otherwise carefully-pinned pipeline, and this project already hit an npm-version-specific bug once (TD26071804).

**Direction:** Pin an exact npm version. Addressed by R-13.

## Performance and scalability (PERF)

**Strengths:** Database access is well-shaped for the workload — an index matches the dashboard's only query shape exactly, and no N+1 pattern exists anywhere in the reviewed code. `src/lib/shared-poem-cache.ts` — despite its name inviting suspicion — is Next's `unstable_cache`, bounded, tag-scoped, and actively invalidated, not a memory-growth risk.

### F-PERF-01 — Draft autosave writes to `localStorage` synchronously on every keystroke, unlike the debounced render on the same path · **Low**

**Evidence:** `saveDraft` runs on every `onChange` event with no debounce, while the (more expensive) `renderPoem()` call one line below is deliberately throttled to 200ms.

**Impact:** Not currently user-visible at this app's poem sizes, but the asymmetry is real — the cheaper-per-call operation (render) is debounced while the costlier synchronous one (storage I/O) isn't.

**Direction:** Fold `saveDraft` into the same or a shorter debounce. Addressed by R-23.

### F-PERF-02 — No timeout/abort handling on outbound Supabase calls; a stalled request leaves the UI stuck rather than erroring · **Medium**

**Evidence:** No `createClient` call configures a request timeout or `AbortController`; `Editor.tsx` sets `saving = true` before `await savePoem(...)`, cleared only in a `finally` that never runs if the request neither resolves nor rejects.

**Impact:** The failure mode is a UI stuck in "Saving…" indefinitely with no error message and no recovery short of reloading — defeating the app's otherwise careful "your work is still here" recovery design.

**Direction:** Wrap the Supabase client's `fetch` or individual call sites with an `AbortController`-based timeout. Addressed by R-09.

### F-PERF-03 — No performance budget or documented limit for live-preview re-render cost · **Low**

**Evidence:** `PoemPreview.tsx` replaces the entire preview iframe's `srcDoc` on every debounced render tick (a deliberate design choice for style isolation); no benchmark or documented ceiling exists anywhere in `docs/`.

**Impact:** Low given the project's actual scale (personal, human-typed `.poem` documents).

**Direction:** No action needed at current scale. No recommendation written.

## Usability and accessibility (UX)

**Scope note:** This is a manual, code-reading review, not an automated accessibility scan — no `axe-core`/`jest-axe`/`pa11y` tooling exists in the repo. Contrast ratios were computed by hand from CSS values using the WCAG relative-luminance formula.

**Strengths:** Errors are consistently surfaced on-screen via `role="alert"`/`role="status"` — meaningful given there is no client-side error collection, so on-screen messaging is the only record a failure leaves. Native `<dialog>` for the sign-in modal gets focus-trapping, Escape-to-close, and focus-return for free. All interactive controls are native elements — no div-with-onClick pseudo-buttons found. The team's own backlog (`docs/IMPLEMENTATION-PLAN.md` W4/W5/W6) honestly tracks unverified contrast/reflow/mobile-toggle gaps rather than overclaiming.

### F-UX-01 — CodeMirror editor has no accessible name for screen-reader users · **High**

**Evidence:** `Editor.tsx`'s `<label htmlFor="poem-source">` targets an `id` that CodeMirror's React wrapper puts on the outer `<div>`, not on the actual editable element (`role="textbox"`, no `id`/`aria-label`). `docs/REQUIREMENTS.md` AC79 explicitly requires the editor be labelled; PR #89 closed out that backlog entry without fixing the labelling.

**Impact:** The app's core interaction is an unlabelled textbox to screen readers, contradicting an explicit, closed-out acceptance criterion.

**Direction:** Add `EditorView.contentAttributes.of({ "aria-label": "Your poem" })` to the extensions array. Addressed by R-02.

### F-UX-02 — Parse-error status text fails AA contrast in light mode · **Medium**

**Evidence:** `text-amber-600` (`#d97706`) on white computes to ≈3.18:1, below AC76's 4.5:1 requirement (dark mode variant is fine).

**Impact:** The message explaining why a poem won't render is under-contrast in the default light theme.

**Direction:** Replace with a contrast-checked token. Addressed by R-14.

**Note:** As of this review, open PR #99 ("feat(a11y): verify and fix WCAG AA contrast for globals.css tokens (W4)") already changes this exact class from `text-amber-600` to `text-amber-700`, resolving this finding once merged. R-14 should be treated as already in flight for this half of its scope.

### F-UX-03 — Share page has no visible page heading · **Medium**

**Evidence:** `src/app/share/[share_id]/page.tsx` has no `<h1>` outside the sandboxed iframe, unlike every other route.

**Impact:** The app's primary cold-distribution surface gives screen-reader users no page-level orientation until they enter the nested iframe.

**Direction:** Render the poem title as a visible `<h1>` in the page's own DOM. Addressed by R-14.

### F-UX-04 — No automated accessibility testing exists · **Low**

**Evidence:** No `axe-core`/`jest-axe`/`pa11y` in `package.json`.

**Impact:** Green CI says nothing about labelling/contrast — exactly how F-UX-01/02 shipped unnoticed.

**Direction:** Add a `jest-axe`/`vitest-axe` smoke test. Addressed by R-33.

**Note:** Open PR #99 adds a dedicated, narrowly-scoped `src/lib/contrast.test.ts` that verifies `globals.css`'s colour-token pairings (closing `docs/IMPLEMENTATION-PLAN.md`'s W4 item) and, in doing so, files two further contrast gaps as TD26072401/TD26072402 (vendored `poetic.css` colours; CodeMirror syntax-highlight colours). That test is a real, narrower sibling of this finding — it covers colour contrast, not labelling/ARIA/keyboard structure, which is where F-UX-01 (this review's other High UX finding) actually was. R-33's broader axe-based smoke test remains the right way to close the labelling gap that a contrast-only test can't catch.

### F-UX-05 — Editor/dashboard render as a blank gap until client JS hydrates · **Low**

**Evidence:** `EditorClient.tsx`, `PoemsDashboardClient.tsx` use `next/dynamic(..., { ssr: false })` with no `loading` fallback.

**Impact:** On slow connections, an empty area with no loading indicator, despite the app already having a good "Loading…" pattern elsewhere.

**Direction:** Pass a `loading` fallback reusing that pattern. Addressed by R-29.

### F-UX-06 — Session bootstrap race can pop an unwarranted sign-in prompt · **Low**

**Evidence:** `use-session.ts` starts `session` at `null`, resolved async; `Editor.tsx` treats `null` as "signed out" with no separate loading state.

**Impact:** An already-signed-in poet clicking Save/Share before session resolution sees a confusing false sign-in prompt.

**Direction:** Add a `"loading"` state to `useSession()`. Addressed by R-29.

### F-UX-07 — Sign-in form gives no visible "in progress" feedback · **Low**

**Evidence:** `SignInPrompt.tsx` only disables buttons during `pending`; no text/status change.

**Impact:** Unreliable feedback for screen-reader and low-attention users during network requests.

**Direction:** Add pending-state button text or a `role="status"` message. Addressed by R-29.

## Documentation (DOC)

**Strengths:** README's command table matches `package.json` exactly. `docs/TRIAGE.md` and `docs/SENTRY-AGENT-ACCESS.md` describe the Sentry wiring with unusual precision and it is verifiably correct against the code. `docs/REQUIREMENTS.md` and `docs/IMPLEMENTATION-PLAN.md` each carry an explicit self-declaration opting them out of CLAUDE.md's as-built rule on their own terms. `TECH-DEBT.md`'s Ledger rows cross-check against real PRs.

### F-DOC-01 — CLAUDE.md's Status section says the data layer is "not yet" built, contradicting the codebase and IMPLEMENTATION-PLAN.md itself · **High**

**Evidence:** `CLAUDE.md`'s Status section reads: "the data layer (save, dashboard, share) is not yet [built]." This is false on two counts: the codebase (`poems-store.ts`, `PoemsDashboard.tsx`, share/remix routes, all tested) and the very doc CLAUDE.md points to (`docs/IMPLEMENTATION-PLAN.md` marks M5-M7 all done; `CHANGELOG.md` documents these as shipped and the app as live at www.poeticfiddle.com).

**Impact:** CLAUDE.md is the project's own instruction file, read first by every agent before it touches the repo. An agent trusting this line could duplicate already-built work or misjudge project maturity when scoping new work.

**Direction:** Rewrite the Status section to state the current milestone and point to the remaining hardening work as "not yet." Addressed by R-04.

### F-DOC-02 — README's Node version guidance is stale against `engines.node`, and the mismatch is a real functional trap · **Medium**

**Evidence:** README says "Requires Node.js >=20.9"; `package.json` pins `22.x` since PR #65, whose message explains the pin exists because jsdom's chain throws `ERR_REQUIRE_ESM` on Node < 22.12. README's line was never updated.

**Impact:** A newcomer on Node 20.9–22.11 gets a working `npm run dev` for most of the app but a 500 specifically on the share/remix routes.

**Direction:** Change README's line to `Requires Node.js 22.x`. Addressed by R-07.

### F-DOC-03 — docs/OBSERVABILITY-PLAN.md embeds a dated "Update" narrative of a fixed bug inside its Problem Statement · **Medium**

**Evidence:** A blockquote headed "Update (2026-07-19)" narrates, past-tense, the jsdom incident's resolution — exactly the "previously.../fixed by..." phrasing CLAUDE.md's documentation principles ban outside `CHANGELOG.md`. Unlike REQUIREMENTS.md/IMPLEMENTATION-PLAN.md, this doc never declares itself exempt from the as-built rule.

**Impact:** The same incident is already narrated in `CHANGELOG.md` and `TECH-DEBT.md`'s `TD26071901`. A third, dated retelling is exactly the drift risk the rule calls out.

**Direction:** Trim the blockquote to a one-line as-built statement linking to `TD26071901`. Addressed by R-18.

### F-DOC-04 — docs/TRIAGE.md and docs/SENTRY-AGENT-ACCESS.md narrate rejected alternatives with no as-built exemption · **Low**

**Evidence:** Both plain-runbook docs narrate discarded past attempts ("was trialled and dropped/removed/abandoned").

**Impact:** Minor — functions as ADR-style rationale — but still the prohibited "previously" phrasing in docs with no stated exemption.

**Direction:** Trim to a "Rejected: X (reason)" one-liner. Addressed by R-30.

### F-DOC-05 — README never links the live app, though CHANGELOG documents it as already deployed · **Low**

**Evidence:** `CHANGELOG.md` states the app is live at www.poeticfiddle.com; README never mentions it.

**Impact:** Minor — a reader at the repo root has no way to find the live product without checking the changelog.

**Direction:** Add a one-line "Live at..." near the top of README. Addressed by R-30.

## Governance and project health (GOV)

**Strengths:** LICENCE (MIT) matches `package.json` exactly. Branch protection is genuinely configured via an active ruleset, not just documented. CODEOWNERS is functional. Issue/PR hygiene is fast with no stale backlog. `docs/IMPLEMENTATION-PLAN.md` is a genuine, structured roadmap (M0-M9, Phase 2 outline).

### F-GOV-01 — No CONTRIBUTING file · **Medium**

**Evidence:** No `CONTRIBUTING*` file anywhere; the equivalent content lives in `CLAUDE.md`, which is framed as agent operating instructions, not a human-facing contribution guide.

**Impact:** A human contributor has no canonical, discoverable entry point, even though the workflow is well specified elsewhere.

**Direction:** Add a short root `CONTRIBUTING.md` pointing to CLAUDE.md's relevant sections. Addressed by R-16.

### F-GOV-02 — No issue or pull-request templates · **Low**

**Evidence:** No `.github/ISSUE_TEMPLATE/` or `PULL_REQUEST_TEMPLATE.md`.

**Impact:** Nothing structurally prompts a test plan or acceptance-criteria link; low impact today since the sole contributor already writes structured PR bodies by habit.

**Direction:** Add a minimal PR template and issue forms. Addressed by R-16.

### F-GOV-03 — The two CODEOWNERS accounts approving/merging every PR appear to be the same individual, so review is not independent · **Medium**

**Evidence:** `@warwickallen` and `@Warwick-Allen` are two distinct GitHub accounts, but every sampled approval on a `warwickallen`-authored PR comes from `Warwick-Allen`, and both trace to "Warwick Allen" per LICENCE/CLAUDE.md's git user.

**Impact:** The branch-protection rule technically requires code-owner review, but if both logins are one person, the gate is self-approval through an alternate account. This matters more here because CLAUDE.md names PR review as the primary control on autonomous-agent output.

**Direction:** Document explicitly that review is currently a single-human checkpoint under two accounts, or add a second genuine reviewer as the project grows. Addressed by R-17.

### F-GOV-04 — Bus factor is one human; no maintainer-succession statement · **Low**

**Evidence:** All 76 non-bot commits authored by "Warwick Allen"; both CODEOWNERS lines resolve to that individual.

**Impact:** Bounded by the project's own stated maturity — a bus-factor-of-one human is the designed-in state, not a hidden gap.

**Direction:** No action needed at current scale. No recommendation written.

## Observability and operations (OPS)

**Strengths:** Data minimisation is enforced in code, not just policy — `sendDefaultPii: false`, `tracesSampleRate: 0`, and a `scrubEvent` function that deletes cookies/headers before send, verified against the installed Sentry SDK's actual default integrations. No console logging anywhere in `src/`. Three deliberate swallow points are all captured with opaque tags only. Agent read-access is genuinely least-privilege and internally consistent between `docs/TRIAGE.md` and `docs/SENTRY-AGENT-ACCESS.md`. The SDK fails open by design when `SENTRY_DSN` is unset.

### F-OPS-01 — `revalidateSharedPoem` failures are silently swallowed with no Sentry capture · **Medium**

**Evidence:** Three call sites in `Editor.tsx` do `revalidateSharedPoem(...).catch(() => {})` — an empty catch. `docs/OBSERVABILITY-PLAN.md` flags this exact gap as an open `[flag]` that was never resolved in code.

**Impact:** If cache-tag invalidation fails right after a save, the share page can serve a stale render for up to 5 minutes with zero record anywhere — unlike the app's other three deliberate-swallow points, which are all captured.

**Direction:** Wrap the call sites with `reportSwallowedError`, resolving the plan's own open flag. Addressed by R-11.

### F-OPS-02 — No documented backup/restore path for stateful data · **Low**

**Evidence:** No document states the Supabase Pro project's actual backup/PITR coverage, retention window, or restore steps.

**Impact:** Poems are real user-authored creative work with no in-app export path; no documented recovery procedure exists under pressure.

**Direction:** Add a short paragraph stating the actual backup/PITR guarantee and manual restore steps. Addressed by R-31.

### F-OPS-03 — No timeout on outbound Supabase writes; a hung save surfaces as a raw platform error, not the app's own friendly message · **Low**

**Evidence:** `@supabase/postgrest-js`'s retry logic explicitly excludes non-idempotent methods (inserts/updates), so every save gets no retry and no client-side deadline.

**Impact:** A hung save blocks until the hosting platform's own function timeout fires, surfacing a generic platform timeout rather than the app's considered error message.

**Direction:** Consider a short `AbortSignal.timeout()` deadline. Addressed by R-09.

## Data handling and privacy (DATA)

**Strengths:** RLS is default-deny and precisely scoped; the one anonymous read path is a `security definer` RPC deliberately designed to prevent enumeration. Cascade deletes are correctly wired at the schema level. Storage/transmission protections rely on unmodified, sound platform defaults. No real personal data or secrets found anywhere in the repository. Sub-processor disclosure in the Privacy Policy is specific and accurate for the processors it covers.

### F-DATA-01 — Privacy Policy says poem/account storage "isn't available yet," but it is fully live · **High**

**Evidence:** `src/app/privacy/page.tsx`'s "Saving and sharing poems" section states storage "isn't available yet." But `poems-store.ts` implements a fully wired save/list/load/share/unshare flow against live tables, called directly from `Editor.tsx` with no feature flag, and the app has already captured a real production Sentry incident confirming it is live.

**Impact:** A poet reading the Privacy Policy today is told their poem text is not being stored server-side, when it demonstrably is. Given the policy explicitly targets GDPR/NZ Privacy Act compliance, this inaccuracy is rated above what the project's maturity alone would suggest, because the harm (a false statement about whether creative writing is persisted) reaches the user's actual expectations, not just the prototype's internal state.

**Direction:** Update the section to describe the feature as live now. Addressed by R-05.

### F-DATA-02 — No self-service delete path for a poem or an account, despite the schema already supporting it · **Medium**

**Evidence:** `poems-store.ts` exports no delete function, though RLS/grant machinery for `delete` already exists in the migration. Both privacy/terms pages describe deletion as available only "by emailing."

**Impact:** Honestly disclosed and proportionate for a pre-launch project, but every deletion request today is a manual, ungoverned DB operation with no audit trail, while the schema-level cost of self-service deletion is already paid for.

**Direction:** Add a "Delete this poem" action to the dashboard. Addressed by R-12.

### F-DATA-03 — No internal runbook for handling an export/delete request · **Low**

**Evidence:** No document describes the operational steps (which SQL, which Admin API call) for actually fulfilling an export/delete request.

**Impact:** Low risk at current scale, but turns a routine subject-access request into an ad hoc scramble.

**Direction:** A short internal runbook mirroring `TRIAGE.md`'s style. Addressed by R-31.
