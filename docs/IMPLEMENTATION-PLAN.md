# Poetic Fiddle — Implementation Plan

> **Living planning document.** This turns the settled requirements in
> [`REQUIREMENTS.md`](REQUIREMENTS.md) (decisions D1–D42, acceptance criteria
> AC1–AC122) into a sequenced build plan: the critical-path dependency, the
> milestones that deliver the MVP, and the implementation decisions still to
> make. It is *not* an as-built doc — it records intended sequencing and open
> questions. Keep it current: as a milestone is delivered, note it here and let
> `CHANGELOG.md` carry the user-visible history. Items marked **[my call]** are
> expert defaults — override if you disagree; items marked **[flag]** are
> genuine unknowns to resolve at build time (record them in `TECH-DEBT.md` when
> scaffolding).

**Status:** Drafted 2026-07-13. Requirements are feature-complete; nothing here
adds scope. **M0 (the poetic-side renderer-extraction spike) is delivered** —
merged upstream in poetic PR #31 (squash commit `b204140`); see poetic's
`docs/RENDERER-BROWSER.md` and `src/browser/render.js`. **M1 (the Fiddle app
scaffold) is delivered** — Next.js (App Router) + TypeScript under `src/`,
ESLint/Prettier, Vitest, CI (`build.yml`, CodeQL `javascript-typescript`), and
the brand shell (logo, palette, light/dark). **M2 (the editor + live preview)
is delivered** — CodeMirror 6 with a `.poem` StreamLanguage mode, a debounced
in-browser preview via the §6.1 tag-pinned `poetic` dependency, and
DOMPurify-sanitised rendering inside a sandboxed iframe. **M3 (anonymous
drafts) is delivered** — the draft autosaves to `localStorage` on every
keystroke and restores on load, with no sign-in prompt during ordinary
editing; Save and Share are stubbed with a sign-in prompt shown only when
attempted. **M4 (authentication) is delivered** — Supabase Auth (magic link,
Google, email/password) via `@supabase/supabase-js`, with the M3 draft
migrating into the session on first sign-in. **The §6 implementation decisions
are all resolved** (2026-07-16): the schema/RLS design (§6.2), auth-email
provider (§6.4), idle-pause posture (§6.5), Pug precompilation (§6.6, settled
upstream by M0) and minimum-age evidence (§6.7). **M5 (data model, Save &
dashboard) is delivered** — the `poems`/`profiles` schema and RLS with pgTAP
tests (PR #35), Save with an unsaved-changes indicator (PR #36), and the "My
poems" dashboard with save-and-resume (PR #37). One caveat it inherits: auth
mail reaches only project-team addresses until §6.4's custom SMTP is
configured (TD26071601), so testing M5's ownership rules with a genuine
second account depends on that. **M6 (share permalinks, SSR) is delivered**
(PR #38) — `sharePoem`/`getSharedPoem` in `poems-store.ts`, a read-only
`/share/[share_id]` SSR page (correct `<title>`/Open Graph meta, poetic's own
CSS, full sandboxed media embeds, no client-side JS required), server-side
DOMPurify sanitisation as the untrusted-content boundary, and a Next Data
Cache reader invalidated on the owner's next save. **M7 (remix) is
delivered** (PR #42) — the remix flow (AC20, AC21, AC113) and the per-poet
and per-poem permission controls (AC114) on top of M5's
`remix_default`/`allow_remix` schema and RLS.

---

## 1. Guiding constraints (carried from the registry & CLAUDE.md)

- **Single-source renderer (D6, AC3, AC99).** Fiddle never forks or
  re-implements the `.poem` parser/renderer. It imports a browser-safe renderer
  **exported by the `poetic` repo**; `.poem` behaviour has one source. The
  extraction is therefore a **framework (poetic-side) change** — see
  `/framework-change`.
- **Minimal running cost (D3, D11, AC28, AC47, AC67).** Free-tier serverless +
  managed DB + in-browser compute; add paid infrastructure only when a
  capability genuinely requires it.
- **Cost-conscious delivery (CLAUDE.md).** Prefer the cheapest model/agent
  likely to complete each task correctly first time; delegate well-scoped
  milestone slices to lower-cost subagents.
- **PR-only workflow (CLAUDE.md).** Every change lands via a squash-merged PR
  whose title is Conventional-Commits-formatted; `main` takes no direct commits.
- **Traceability.** Each milestone below names the acceptance criteria it
  satisfies, so tickets and QA sign-off map back to §9–§16 of the registry.

---

## 2. Critical path & dependency map

Everything a viewer *sees* depends on one artefact: a **browser-/edge-safe
`renderPoem`** exported from `poetic`. It gates the live preview (client-side)
and the SSR share page (server-side), and — via its aggregate variant — the
Phase-2a hosted site.

```
        ┌───────────────────────────────────────────────┐
   M0   │ poetic: browser-safe renderPoem  (framework)  │  ← critical path
        └───────────────┬───────────────────────────────┘
                        │ imported by
        ┌───────────────▼───────────────┐
   M1   │ Fiddle app scaffold + CI      │  (parallel with M0; no renderer needed)
        └───────┬───────────────┬───────┘
                │               │
        ┌───────▼──────┐ ┌──────▼───────────┐
   M2   │ Editor +     │ │ M4 Auth          │
        │ live preview │ │ (Supabase)       │
        └───────┬──────┘ └──────┬───────────┘
        ┌───────▼──────┐        │
   M3   │ Anon drafts  │        │
        │ (localStorage│        │
        │  + migration)│        │
        └───────┬──────┘        │
                └──────┬────────┘
                ┌──────▼───────┐
        M5      │ Data model + │
                │ Save + RLS + │
                │ dashboard    │
                └──────┬───────┘
                ┌──────▼───────┐
        M6      │ Share (SSR   │  ← re-uses M0 renderer server-side
                │  permalink)  │
                └──────┬───────┘
                ┌──────▼───────┐
        M7      │ Remix        │  (opt-in, off by default — D38)
                └──────────────┘

   M8  Non-functional hardening (a11y, security/CSP, perf, responsive) — runs
       ALONGSIDE M2–M7, not after them (untrusted-content sanitisation lands
       with the first render surface).
   M9  Legal / branding / domain surface (ToS, Privacy, AUP, logo dark variant,
       DNS + auth-email alignment).
```

Two independent tracks can start immediately: **M0** (upstream, in `poetic`)
and **M1** (the Fiddle scaffold, which needs nothing from the renderer). The
editor (M2) is the first place the two tracks meet.

---

## 3. M0 — Renderer extraction spike (poetic-side, critical path)

> **✅ Delivered 2026-07-13** in **poetic PR #31** (squash commit `b204140`,
> under poetic's `[Unreleased]`). `renderPoem`/`renderPoemPage` are exported from
> poetic `src/browser/render.js`; the three fs couplings are broken (precompiled
> Pug templates, inlined song-handler data, config-as-argument) and the output is
> byte-for-byte identical to the CLI build (asserted over the poem corpus). The
> §3.3 flags are resolved: the parse-object vs YAML round-trip is byte-identical
> (the date stays a quoted `YYYY-MM-DD` **string**, never a `Date`); a single
> in-editor poem needs no `$ref` resolution; and the untrusted-content risk is
> settled as **poetic stays unchanged, Fiddle sanitises at the boundary**
> (DOMPurify + strict CSP + allow-listed/sandboxed embeds). Deferred and tracked
> as poetic `TECH-DEBT.md`: renderer packaging/versioning **TD26071301** (§6.1)
> and the aggregate index/all-poems renderers **TD26071302** (§3.2(3)). Full
> detail: poetic `docs/RENDERER-BROWSER.md`. **Fiddle-side follow-ups:** make the
> §6.1 packaging decision and implement the boundary sanitiser (lands with M2/M6).

**This was the highest-value, highest-risk piece and the true first step.** It is
a change to the `poetic` repo, delivered via `/framework-change`; Fiddle then
consumes the result (§6.1 packaging).

### 3.1 What already exists (from a read of `poetic/src/tools/`)

The pipeline is `.poem` text → `new PoemParser(text).parse()` → poem-data object
→ augment (`slug`, display `date`) → `renderFragment` / `renderPage`
(`poem-render.js`).

- **Portable as-is (runs in a browser/edge runtime):**
  - `PoemParser` (`poem-to-yaml.js`) — a class over a string; no filesystem in
    the parse itself (fs is only at the CLI boundary).
  - `markdown.js` (markdown-it), `js-yaml`, `date-utils.js`, `slugify.js`.
- **fs-coupled — must be broken for a browser build:**
  1. **Pug templates.** `renderFragment`/`renderPage` call
     `pug.compileFile(poem.pug | poem-page.pug)` (also `_poem-content.pug`) via
     `__dirname`. → **Precompile templates to JS functions** at poetic's build
     time and ship the compiled functions (no runtime `fs`, no `pug` compiler in
     the browser bundle).
  2. **Song handlers.** `song-handlers.js` reads `src/song-handlers.yaml` from
     disk (`BUILTIN_HANDLERS_PATH`, `fs.readFileSync`). → **Inline the handler
     data** into the module.
  3. **Config.** `poetic-config.js` reads `.poetic-config.yaml` from disk. The
     render functions already accept a `config` **object** parameter, so the
     browser entry just takes config as an argument — no fs.
  4. **Preview CSS (D16, AC24).** `public/poetic.css` (+ `custom.css`) is not
     part of the renderer but must be **bundled by Fiddle** so the preview has
     full styled fidelity. Decide whether poetic exports the CSS as a package
     asset or Fiddle vendors a pinned copy (§6.1).

### 3.2 Deliverables

1. **`renderPoem(text, opts)`** — a browser-safe entry point in `poetic` that
   chains parse → augment → `renderFragment`, returning a fragment for the live
   preview. `opts` carries `{ config }` (D26 friendly subset + defaults).
2. **`renderPoemPage(text, opts)`** — full-document variant (wraps `renderPage`)
   for SSR share pages, including `<title>` / Open Graph meta (D6, AC18).
3. **Aggregate renderers for Phase 2a (D25, AC41–AC42):** data-driven `index`
   and `all-poems` renderers. `build-all-poems.js` today concatenates *built
   HTML files off disk*; the hosted path needs a variant that renders from an
   in-memory list of poems (no fs, no pre-existing HTML). *Can be deferred to
   the start of Phase 2a, but flag it now so the M0 API shape anticipates it.*
4. **A packaging/versioning mechanism** so Fiddle imports the above (§6.1) —
   the registry's parked "how Fiddle consumes the shared renderer" question.

### 3.3 Risks / unknowns to resolve *inside* the spike

- **[flag] Parsed-object shape vs. YAML round-trip.** The build path today is
  `.poem` → parse → **write YAML** → re-read YAML → `renderFragment`. The
  in-browser path skips the file round-trip (parse → object → render). Confirm
  `renderFragment` consumes the raw `parse()` object identically (watch `Date`
  handling and any YAML normalisation).
- **[flag] `$ref` resolution is a multi-file, build-time concern.** A single
  in-editor poem has no cross-file `$ref`s; confirm the render path tolerates
  their absence (it should — `$ref` resolution happens before render).
- **[flag] SECURITY — untrusted content is the headline risk (AC85–AC86).**
  `markdown.js` is constructed with `html: true` and an explicit *"the sole
  author is trusted; no sanitisation is performed"* assumption. In Fiddle, poem
  content is **untrusted** and is rendered on surfaces other people view (share
  pages AC18, hosted sites AC41). The extracted renderer's output must therefore
  be **sanitised and/or CSP-constrained** before it reaches a viewer, and media
  embeds (MEGA/Suno/Audiomack) must be **allow-listed and sandboxed** (AC86).
  **[my call]** keep `poetic` unchanged (its trusted-author model is valid for
  poem-collection repos) and have **Fiddle sanitise the renderer's HTML output
  at the boundary** (e.g. DOMPurify) plus a strict Content-Security-Policy —
  rather than changing markdown-it's `html` setting upstream. Decide during the
  spike; record the residual gap in `TECH-DEBT.md` (the registry pre-flagged
  this at AC85).

### 3.4 Exit criteria (definition of done for M0)

- `renderPoem(text)` and `renderPoemPage(text)` run in a plain JS runtime with
  **no `fs`/`__dirname`** access and produce output byte-comparable to the CLI
  build for a corpus of sample poems (reuse poetic's golden fixtures).
- The module is importable by Fiddle through the chosen packaging mechanism
  (§6.1) and pinned to a specific poetic version (AC68 pattern).
- A documented answer to each **[flag]** above, and a Fiddle-side sanitisation
  strategy confirmed (even if the sanitiser itself is implemented in M2/M6).

---

## 4. MVP build milestones (Phase 1)

Delivers the MVP spec (§7) and its acceptance criteria (AC1–AC32), under the
cross-cutting NFRs (§12). Each milestone is independently reviewable/PR-able.

### M1 — App scaffold & CI backstops

> **✅ Delivered 2026-07-13.** Next.js 16 (App Router) + TypeScript scaffolded
> via `create-next-app` under `src/`; Tailwind CSS v4 for styling; ESLint
> (`eslint-config-next` + `eslint-config-prettier`) and Prettier, both matching
> `.editorconfig`; Vitest + React Testing Library with a smoke test per
> component. `.github/workflows/build.yml` runs lint/typecheck/format-check/
> test/build on every PR and push to `main`; CodeQL's `javascript-typescript`
> scan is added to `codeql.yml`'s matrix; `dependabot.yml` now watches the
> `npm` ecosystem. Brand shell: `BrandHeader` (logo + "Poetic Fiddle" wordmark
> in Fraunces) in the root layout, palette (`#534AB7`/`#C88A3A`) as CSS custom
> properties feeding Tailwind's theme, full light/dark support via
> `prefers-color-scheme` — the single monochrome-purple logo reads fine on
> both backgrounds, so no separate light-on-dark variant was needed for this.
> Routing is just `/` (a placeholder landing page); no `/editor` route yet.

*Depends on: nothing. Ran parallel to M0.*
- Scaffold Next.js (App Router) + TypeScript (D9); `package.json`, ESLint config
  (the tooling `CLAUDE.md` notes is "added when the app is scaffolded"), Prettier
  to match `.editorconfig`.
- CI: app build + test workflow; add CodeQL **`javascript-typescript`** to the
  existing scan set; wire commit-format CI already present.
- Base layout, routing skeleton, and the brand shell (logo, palette D31–D33) so
  later milestones drop into a themed frame.
- **ACs:** foundational (enables AC28, AC83).

### M2 — Editor + live preview

> **✅ Delivered 2026-07-14.** CodeMirror 6 (`@uiw/react-codemirror`) with a
> v1 `.poem` `StreamLanguage` mode (`src/lib/poem-syntax.ts`): structural
> highlighting for sections, version labels, emphasis, variables, spans,
> comments, hashtags. A ~200ms debounced in-browser preview
> (`src/components/Editor.tsx`) calls `renderPoem` from the §6.1 tag-pinned
> `poetic` dependency (`github:Poetic-Poems/poetic#v6.0.1` — poetic cut a
> release exposing `poetic/browser` before this milestone landed, so no
> interim main-HEAD-SHA pin was needed after all); a parse error surfaces a
> non-blocking message and the last good preview stays visible.
> `src/components/PoemPreview.tsx` renders the DOMPurify-sanitised output
> inside a sandboxed `<iframe>` bundling poetic's own CSS (copied into a
> generated module by `scripts/sync-poetic-css.mjs`, run via `postinstall`),
> so app-shell and poem styles never collide. A friendly example `.poem`
> pre-populates the editor on first load, linking to poetic's
> `POEM-SYNTAX.md` at the pinned tag. Media-embed markup renders as a plain
> link (poetic's Suno/Audiomack/Mega handlers without `poetic.js` loaded);
> full sandboxed embeds and the Analysis section's show/hide toggle (its
> `onclick` handlers are stripped by DOMPurify — see `TECH-DEBT.md`
> TD26071401) remain M8 work.

*Depends on: M0 (renderer), M1 (scaffold).*
- CodeMirror 6 with a v1 `.poem` mode: structural highlighting for `{sections}`,
  `*emphasis*`/`**strong**`, variables, `/.classname{…}` spans, comments,
  `#hashtags` (AC6); a full Lezer grammar is a later enhancement.
- Debounced (~200 ms) in-browser preview via `renderPoem` (AC1, AC2, AC80); no
  server round-trip (D5).
- Non-blocking parse-error indicator; keep last good preview on failure (AC4).
- Friendly example `.poem` on first run + cheatsheet link (AC5).
- Full styled fidelity: bundle poetic's CSS + page template (AC24); best-effort
  media embeds in preview (AC25).
- **Sanitise rendered output here** (first untrusted-render surface) — see M8.
- **ACs:** AC1–AC6, AC24, AC25, AC80.

### M3 — Anonymous drafts

> **✅ Delivered 2026-07-14.** `src/lib/draft-storage.ts` wraps a versioned
> `localStorage` key (`loadDraft`/`saveDraft`/`clearDraft`), tolerant of
> storage being unavailable (private browsing, quota — AC98). `Editor.tsx`
> initialises from a stored draft (falling back to the example poem) and
> autosaves on every keystroke, with no sign-in prompt anywhere in the edit/
> preview path (AC7, AC8). `loadDraft`/`clearDraft` are the migration hook
> (AC9): M4's sign-in handler calls `loadDraft()` to adopt the draft into the
> newly authenticated session and `clearDraft()` once it's saved to the
> account. Save and Share toolbar buttons open a `SignInPrompt` dialog —
> sign-in itself isn't wired up until M4, so this stands in for that flow —
> shown only on Save/Share, never during editing (AC10).

*Depends on: M2.*
- Full anonymous edit/preview with no sign-in prompt (AC7).
- Draft persisted to `localStorage`, restored on reload/reopen (AC8).
- Migration hook so a draft carries into the account on first sign-in (AC9) —
  the persistence side; the auth trigger lands in M4.
- Sign-in prompt only when Save/Share is attempted (AC10).
- **ACs:** AC7–AC10, AC98.

### M4 — Authentication

> **✅ Delivered 2026-07-15.** `@supabase/supabase-js` browser client
> (`src/lib/supabase-client.ts`, from `NEXT_PUBLIC_SUPABASE_URL`/
> `NEXT_PUBLIC_SUPABASE_ANON_KEY`); a `useSession` hook
> (`src/lib/use-session.ts`) subscribes to `onAuthStateChange` so the session
> persists across reloads (AC12). `SignInPrompt` offers magic-link email
> (primary), "Continue with Google", and a password fallback with a
> sign-in/sign-up toggle (D8, AC11). `Editor` adopts the M3 `localStorage`
> draft into the session on first sign-in via the existing `loadDraft`/
> `clearDraft` hook point (AC9), and gates the Save/Share sign-in prompt on
> session state; a signed-in user's email and a sign-out control appear in
> the toolbar. No `@supabase/ssr`/middleware yet — every auth surface today
> is client-only, so the plain browser client (localStorage-backed session)
> is sufficient; server-side session reading is deferred to whichever of
> M5/M6 first adds a server route that needs it. Two manual dashboard steps
> (enabling the Google provider in Supabase, setting the env vars in Vercel)
> remain outstanding — tracked as `TECH-DEBT.md` TD26071501.

*Depends on: M1 (Supabase project provisioned).*
- Supabase Auth: magic-link email **and** Google **and** email/password (D8,
  AC11); session persists across reloads (AC12).
- Complete the M3 migration: on first successful sign-in, adopt the localStorage
  draft (AC9).
- **ACs:** AC11, AC12, AC9.

### M5 — Data model, Save & dashboard

> **✅ Delivered 2026-07-17.** `poems`/`profiles` per §6.2, as Supabase CLI
> migrations, with RLS and pgTAP tests in CI (PR #35). `savePoem`
> (`src/lib/poems-store.ts`) inserts on a first save and updates the same row
> thereafter, with an "unsaved changes"/"Saving…"/"Saved" indicator and an
> error that never drops edits (PR #36). The "My poems" dashboard
> (`/poems`, `PoemsDashboard`) lists the signed-in poet's saved drafts,
> most-recently-updated first, with an empty state linking back to the
> editor; each poem links to `/poems/[id]`, which loads it via `loadPoem`
> and hands it to `Editor` as `initialPoemId` — the poem's id then lives in
> the URL, so opening it (or reloading that URL) restores the same row
> instead of losing which poem was open (PR #37).

*Depends on: M4. Schema/RLS designed — build to §6.2.*
- `poems` + `profiles` per §6.2, as committed Supabase CLI migrations: raw
  `.poem` `source_text` as canonical source (D15, AC16); title derived from the
  header (AC23); a saved poem defaults to `draft` (§6.2, clarifying AC29
  against AC90); RLS so users touch only their own rows, with pgTAP tests in CI
  (AC87).
- Manual Save with an "unsaved changes" indicator (AC13, AC14); a failed save
  surfaces an error and never silently drops edits (AC94, AC95).
- "My poems" dashboard incl. an empty state that guides back to the editor
  (AC15, AC22).
- **ACs:** AC13–AC16, AC22, AC23, AC87, AC94, AC95.

### M6 — Share permalinks (SSR)

> **✅ Delivered 2026-07-17** (PR #38). `sharePoem()` (`src/lib/poems-store.ts`)
> moves a poem out of `draft` so §6.2's trigger mints (or, idempotently, keeps)
> its `share_id`; `getSharedPoem()` reads it back through the `get_shared_poem`
> RPC. `/share/[share_id]` (`src/app/share/[share_id]/page.tsx`) is a Server
> Component: `generateMetadata` sets `<title>`/Open Graph from the already-
> derived `title` column, and the page itself renders `renderPoem`'s HTML
> fragment (not `renderPoemPage` — its page template's relative asset links and
> site nav assume poetic's own on-disk build layout, which doesn't fit Fiddle's
> routing, and AC24 already excludes that site-level chrome) through
> `sanitizeSharedPoemHtml()` (`src/lib/render-share.ts`): DOMPurify-over-`jsdom`
> as the untrusted-content boundary, then a transform that turns each
> allow-listed song-handler embed (MEGA, Audiomack — Suno has no `embed_url`)
> into a real, always-visible, sandboxed `<iframe>`, so the share page shows
> the full player (AC25) rather than the editor preview's click-to-load button.
> `SharedPoemView` renders that HTML inside an isolated `srcDoc` iframe (the
> same style-isolation technique as `PoemPreview`) with its own strict CSP as a
> sanitisation backstop, viewable with no client-side JS (AC84). Reads go
> through `getCachedSharedPoem` (`src/lib/shared-poem-cache.ts`), an
> `unstable_cache` reader tagged per poem; the editor's Share/Save flows call
> the `revalidateSharedPoem` Server Action (`updateTag`) after any save that
> touches an already-shared poem, so the permalink is never a frozen snapshot
> (AC19, AC82). `listPoems` now lists every status, not just `draft`, so a
> shared poem stays reachable from "My poems" (marked "Shared") for its owner
> to keep editing.

*Depends on: M5, M0 (`renderPoem` server-side).*
- Generate an unlisted permalink; visibility defaults to `unlisted` (D14, AC17,
  AC29, AC90); opaque `share_id`.
- Read-only **SSR** render with no editor chrome, viewable without JS (AC18,
  AC84); correct `<title>`/OG meta.
- Reflects current source, modulo a short render cache (D15, AC19, AC82).
- Media/song embeds show the **full** player on the share page (AC25) — behind
  the embed allow-list/sandbox (AC86).
- **ACs:** AC17–AC19, AC25, AC29, AC82, AC84, AC90.

### M7 — Remix (opt-in)

> **✅ Delivered 2026-07-18** (PR #42, permission controls below) — the remix
> flow (AC20, AC21, AC113) and the permission controls (AC114).
> `/remix/[share_id]` (`src/app/remix/[share_id]/page.tsx`) is a Server
> Component reading the same `getCachedSharedPoem` path as the share page and
> handing `poem.source` to the editor as `initialSource` — with no poem id, so
> the copy is independent by construction: the first Save inserts a new row
> owned by the remixer (`savePoem({ id: null, … })`) and RLS would refuse an
> update to the original regardless (AC20). Anonymous, `initialSource` is
> written straight to the localStorage draft, so a remix is just an anonymous
> draft and M3/M4's adopt-on-sign-in path carries it into the account (AC21);
> the draft migration is skipped when `initialSource` is present, so a stale
> draft can't overwrite the poem the URL names. The share page offers Remix
> only when `allowRemix` — already resolved against `remix_default` and
> `allow_remix` by the `get_shared_poem` RPC (§6.2), which coalesces a missing
> value to `false` — and it is a plain `<Link>`, so it needs no client-side JS
> (AC84). The route re-checks the permission itself rather than trusting the
> page that links to it: with remixing off, `/remix/<share_id>` 404s exactly
> as an unknown id does (AC113), so a guessed URL confirms nothing.
>
> **AC114:** `profiles.remix_default` and `poems.allow_remix` (M5's migration,
> `supabase/migrations/20260716104021_poems_and_profiles.sql`) are the poet's
> global default and per-poem nullable override; the existing `poems_update_own`
> and `profiles_update_own` RLS policies already scope writes to their owner,
> and `supabase/tests/rls_test.sql` already covers the allow/deny resolution
> (§6.2). The "My poems" dashboard (`src/components/PoemsDashboard.tsx`) shows
> and toggles `remix_default`, labelled off-by-default; the poem editor
> (`src/components/Editor.tsx`) shows and sets the per-poem `allow_remix`
> override (inherit / always allow / never allow) via `updateAllowRemix` in
> `src/lib/poems-store.ts`, saving the poem first if it hasn't been saved yet.

*Depends on: M6.*
- **Remixing is off by default** (D38): a global per-poet switch (`remix_default`,
  default `false`) + a per-poem nullable `allow_remix` override.
- Share page offers a Remix action **only** when enabled (AC113); Remix opens an
  independent copy owned by the remixer, original unaffected (AC20).
- Anonymous remix behaves as any anonymous draft (AC21).
- **ACs:** AC20, AC21, AC113, AC114.

### M8 — Non-functional hardening *(cross-cutting; not a tail phase)*
*Runs alongside M2–M7; each item lands with the surface it protects.*
- **Security (with M2/M6):** boundary sanitisation of untrusted render output +
  strict CSP (AC85); embed provider allow-list + sandboxed iframes (AC86);
  secrets server-only (AC88); HTTPS + Supabase-managed sessions (AC89).
- **Accessibility (WCAG 2.1 AA baseline, AC74):** keyboard operability + visible
  focus + no traps incl. CodeMirror (AC75, AC79); AA contrast in light/dark
  (AC76); 200%/320px reflow (AC77); `prefers-reduced-motion` (AC78).
- **Responsive (AC26, AC83):** split-pane desktop, source/preview toggle mobile;
  evergreen-browser support.
- **Performance (AC80–AC82):** interactive-fast editor load; cached SSR with
  edit-time invalidation.
- **Privacy/i18n/reliability:** data minimisation + no third-party analytics
  (AC91, AC103); full Unicode poem content (AC96); English-only UI authored for
  later l10n (AC97); graceful degradation (AC93, AC94); the §6.5 keep-alive
  cron (dormant on Pro, insurance against a future free-tier drop — AC93).
- **Observability:** durable server-side error reporting + logs with
  agent-readable triage access — planned and sequenced separately in
  [`OBSERVABILITY-PLAN.md`](OBSERVABILITY-PLAN.md) (O1–O4), within the same
  D41/AC84/AC103 constraints.
- **ACs:** AC74–AC100 (as they attach to each surface).

### M9 — Legal, branding & domain surface
*Depends on: M1 (shell); can finalise late but before public launch.*
- Published + linked ToS, Privacy Policy, Acceptable-Use Policy (D36, AC111);
  operator = **W W Initiatives Limited** named as controller (D35, AC110);
  content-licence + copyright-retention wording (D37, AC112); min-age 16 (D39,
  AC115); takedown address + removal-from-every-surface (D40, AC116); cookie/
  sub-processor/analytics posture (D41, AC117); breach handling (AC118).
- Account/poem/export deletion propagating to all surfaces (AC92).
- Branding assets: logo **light + dark** variants (AC106), favicon set, wordmark;
  warm/literary voice in UI copy (AC107).
- Domain `www.poeticfiddle.com` over HTTPS (D34, AC108) — **done** (§6.3);
  **auth-email DNS** (AC109) — **done** via TD26071601/§6.4: SMTP2GO CNAMEs are
  in the zone (link-tracking CNAME and `p=reject` DMARC observable in public
  DNS), and delivery to a non-team address was confirmed 2026-07-16.
- **ACs:** AC92, AC104–AC118.

### M8/M9 — remaining work, decomposed into selectable items

An as-built audit (2026-07-21, against `main` @ `10a4167`) found the following
M8/M9 items already delivered with their surfaces: render-boundary
sanitisation on both preview and SSR share (AC85's sanitisation half), embed
allow-list + sandboxed iframes (AC86), secrets server-only (AC88), SSR share
caching with edit-time invalidation via cache tags (AC81–AC82), no third-party
analytics (AC91, AC103), observability O1–O3, and the M9 items ToS + Privacy
published and linked, operator named (AC110), content-licence wording (AC112),
min-age in legal pages, and domain + auth-email DNS (AC108–AC109).

What follows is the remainder, as discrete items an agent can select and
finish in one PR each. Items marked **[human]** need Warwick for at least one
step; everything else is agent-selectable as-is. Priorities: **P1** before
public launch, **P2** soon after, **P3** insurance/polish.

- **W2 (P1, S)** — **Keyboard operability** (AC75, AC79). CodeMirror captures
  Tab with no documented escape (`Editor.tsx` mounts `<CodeMirror>` with no
  keymap config); no visible custom focus styles exist. Add the standard
  Esc-then-Tab escape hatch, document it in the UI, and add `:focus-visible`
  styles in `globals.css`.
- **W3 (P1, S)** — **`prefers-reduced-motion`** (AC78). Zero occurrences in
  code today. Audit transitions/animations and gate them.
- **W4 (P1, S)** — **AA contrast verification, light + dark** (AC76). Colour
  tokens in `globals.css` have never been contrast-checked. Verify all
  token pairings, fix failures, and add an automated contrast test so
  regressions fail CI.
- **W5 (P1, S)** — **320 px / 200 % reflow** (AC77). Responsive utilities
  exist but nothing targets the AC's 320 px floor. Verify every page at
  320 px width and 200 % zoom; fix overflow/clipping.
- **W6 (P1, M)** — **Mobile source/preview toggle** (AC26, AC83). Desktop
  split-pane is in (`Editor.tsx` `lg:grid-cols-2`) but mobile renders a
  vertical stack, not the planned toggle. Add a source/preview switch below
  the `lg` breakpoint.
- **W7 (P1, S)** — **Terms page stale copy**. `terms/page.tsx` still says
  Save and Share "aren't available yet" — they shipped (M5/M6). Re-read the
  whole page against as-built behaviour, not just that line.
- **W8 (P1, S)** — **Standalone AUP page** (D40, AC111). Acceptable use lives
  only as a section inside Terms; D40 wants a short standalone published
  policy. Extract to `/aup` (or `/acceptable-use`) and link it in the footer.
- **W9 (P1, S) [human]** — **Takedown address + process** (D40, AC116). No
  dedicated takedown/abuse contact is published. Warwick picks the mailbox
  (e.g. `takedown@poeticfiddle.com` forwarding, or the existing address,
  which requires no new infrastructure); an agent then publishes address +
  process in the AUP/legal pages.
- **W10 (P1, S)** — **Breach-handling statement** (AC118). Nothing user-facing
  today. Add wording to the Privacy Policy per the NZ notifiable-breach
  scheme (REQUIREMENTS.md §15).
- **W11 (P2, S)** — **Surface min-age 16 at sign-up** (D39, AC115). The age
  term exists in Terms/Privacy but `SignInPrompt.tsx` never mentions it. Add
  the one-line prompt wording.
- **W12 (P1, M)** — **Poem deletion** (AC92, first half). `poems-store.ts` has
  save/list/load/share/unshare/remix but no delete; the dashboard has no
  delete control. Add poem deletion that also revokes any share link and
  invalidates the share cache tag.
- **W13 (P1, L)** — **Account deletion** (AC92, second half). Today deletion
  is by email request only. Add self-service account deletion propagating to
  all surfaces (poems, shares, profile) — needs a server-side route using the
  service-role key, so treat as a security-sensitive change with its own
  careful review.
- **W14 (P2, M)** — **Data export** (AC92). No export flow exists. Add
  download-my-data (poems + profile as JSON/`.poem` files).
- **W15 (P2, S–M)** — **Branding: theme-aware logo + favicon set** (AC106).
  `poetic-fiddle-logo.svg` has hard-coded fills and no dark variant;
  favicons are a bare `favicon.ico` + `icon.svg`. Make the logo respect
  theme (currentColor or media-query variant), add apple-touch/manifest
  icons. Visual change — flag the PR for Warwick's eye.
- **W16 (P3, M) [human]** — **Keep-alive cron + O4 monitors** (§6.5, AC93;
  OBSERVABILITY-PLAN O4). Deliberately dormant insurance; nothing built. When
  picked up: heartbeat route + `vercel.json` cron + uptime monitor per the
  §6.5 decision; Warwick sets the `CRON_SECRET` env var in Vercel.

**MVP non-goals to verify absent (AC30–AC32, AC48–AC51, AC101–AC103):** no
publishing/GitHub/Blogger UI, no collections/site-config, no realtime
collaboration or public gallery, no PWA beyond localStorage, no UI l10n, no
third-party analytics.

---

## 5. Phase 2a / 2b outline (post-MVP)

Kept light — detailed sequencing is a follow-up once the MVP lands. Both re-use
the MVP renderer and data model.

- **Phase 2a — Fiddle-hosted publishing (§8.1, AC33–AC51).** New heavy
  dependency: the **aggregate renderers** (index + all-poems) from M0 §3.2(3).
  Adds `sites` (one per user, `/@handle`), `poems.status`
  (`draft|unlisted|published`) + per-site `slug`, dynamic cached SSR site pages,
  and the friendly site-config UI (title/subtitle/author/favicon).
- **Phase 2b — Connect-your-own-GitHub (§8.2, AC52–AC73).** New heavy
  dependency: **Fiddle's GitHub App** (fine-grained perms; least privilege).
  Scaffolds a genuine poetic-consumer repo (default `poems`), one-way
  Fiddle→GitHub sync of *published* poems + generated `.poetic-config.yaml`,
  built by poetic's own Actions/Pages; 2a↔2b single active target, switchable.
  **[flag]** the exact GitHub-App *repo-creation* API path needs build-time
  verification (registry pre-flagged this) → `TECH-DEBT.md`.
- **Phase 3 (parked):** Blogger, subdomains/custom domains, multiple sites,
  framework-version management, full `.poetic-config` parity.

---

## 6. Implementation decisions

The registry's parked "later rounds" plus what surfaced from reading the render
code. Each needed a decision before the milestone that consumes it; **all are
now resolved** — none gates a milestone. What remains from them is execution:
§6.2 is built by M5, §6.5's cron by M8, and §6.4's SMTP configuration is a
dashboard task tracked as TD26071601.

### 6.1 Renderer packaging & versioning *(gates M0 → M2)* — ✅ **DECIDED 2026-07-13**

**Decision: (b) a tag-pinned release-tarball dependency.** Fiddle's
`package.json` depends on `poetic`'s GitHub release asset for an exact
release tag, e.g.:

```jsonc
"dependencies": {
  "poetic": "https://github.com/Poetic-Poems/poetic/releases/download/v6.0.0/poetic-6.0.0.tgz"
}
```

`package-lock.json` freezes the resolved tarball URL and its `integrity`
hash, satisfying the AC68 pinned-version pattern; bumping to a newer poetic
release is a deliberate, reviewable `package.json` edit — the version now
appears twice in the URL (path and filename) instead of once as a tag ref.
`import { renderPoem, renderPoemPage } from 'poetic/browser'` and `import
'poetic/browser/poetic.css'` resolve through poetic's `exports` map (below) —
the same mechanism covers the **preview CSS** asset (§3.1(4)), so no separate
vendoring decision was needed there.

**Why (b) over the alternatives:** poetic is a public repo with a clean semver
tag history, so a release-tarball dependency needs no deploy keys/PATs and
works today; unlike a git-protocol dependency, it also needs no SSH key in
hosted CI/CD and isn't subject to npm 11+'s `EALLOWGIT` fresh-install block
(`Poetic-Poems/poetic-fiddle#61`). (a) a published npm package is the cleaner
long-term shape but requires flipping `private: true` (or standing up a
separate scoped package) plus a publish workflow — process overhead not
justified for a single consumer yet. (c) a submodule or vendored/precompiled
bundle reintroduces manual-sync drift risk against the single-source-of-truth
goal (D6). Re-evaluate towards (a) if a second consumer of the renderer
appears.

**What made this decidable now:** poetic PR #33 resolved poetic's own
tech-debt item TD26071301 by exposing `./browser` and `./browser/poetic.css`
via poetic's `package.json` `exports` map, and poetic PR #34 added the
browser-safe aggregate renderers (index/all-poems), completing the browser
surface. poetic's `package.json` remains `private: true` (no npm-registry
publish) — irrelevant to a git dependency, which installs straight from the
tagged commit.

**Known friction, tracked as Fiddle `TECH-DEBT.md` TD26071301** (a different
repo's register from poetic's own TD26071301 above — same ID format, distinct
namespace): poetic ships no TypeScript declarations for `./browser`, and its
CommonJS (`require`) source needs `transpilePackages: ['poetic']` in Fiddle's
`next.config`. Neither blocks M2; both should land with the first import.

### 6.2 Database schema & RLS design *(built by M5)* — ✅ **DECIDED 2026-07-16**

The design pass the registry parked. Scope: the tables M5 actually needs, plus
the forward-compatibility choices that stop Phase 2a/2b needing a rewrite. The
committed migrations become the source of truth once M5 lands; the SQL below is
the agreed shape, not a transcript of the final files.

**Migrations mechanism [my call].** Supabase CLI migrations committed under
`supabase/migrations/*.sql` and applied with `supabase db push` — schema changes
are then reviewable in the PR that needs them, matching the PR-only workflow.
`.github/workflows/database.yml`'s `deploy` job runs that push against the
live project automatically once a migration-touching PR merges to `main`.
Hand-run dashboard SQL is the fallback only, never the record.

#### Tables (M5)

```sql
create type public.poem_status as enum ('draft', 'unlisted', 'published');

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  remix_default boolean not null default false,          -- D38
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.poems (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',                  -- derived, AC23
  source_text text not null,                             -- canonical, D15/AC16
  status      public.poem_status not null default 'draft',
  share_id    text unique,                               -- opaque, minted on Share
  allow_remix boolean,                                   -- nullable override, D38
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint poems_shared_has_share_id
    check (status = 'draft' or share_id is not null)
);

create index poems_owner_recent_idx on public.poems (owner_id, updated_at desc);
```

A `profiles` row is created by an `after insert` trigger on `auth.users`, so
every account has one before M7 reads `remix_default`.

#### The decisions inside that shape

1. **A saved poem defaults to `draft`** — private to its owner, no `share_id` at
   all. This resolves AC29 ("defaults to `unlisted`") against AC90 ("the most
   private applicable state — *draft where drafts exist*") in favour of AC90,
   because M5 is where DB-backed drafts start existing. An un-shared poem is
   therefore unreachable *by construction*, not merely by an unguessed URL.
   AC29's intent — never publicly listed — still holds exactly. Registry
   updated.
2. **`share_id` is minted lazily, by the database.** A `before insert or update`
   trigger fills `share_id` when a poem leaves `draft`, and the
   `poems_shared_has_share_id` constraint makes the invariant unbreakable from
   the client. The client only ever sets `status`; it cannot forget to mint an
   id, nor supply its own. The same trigger maintains `updated_at`.
   Value: `replace(gen_random_uuid()::text, '-', '')` — 32 hex chars, 122 bits
   of entropy, no pgcrypto dependency, URL-safe. Ample against enumeration.
3. **Share pages read through a `security definer` RPC — not an anon `SELECT`
   policy, and not the service-role key.** This is the security-critical
   choice. A policy like `using (status = 'unlisted')` would satisfy "unlisted
   is readable" while letting anyone with the anon key *enumerate every unlisted
   poem in the database* — the exact opposite of AC87's "reachable only via
   their opaque `share_id`". So `poems` gets **no anon policy at all**, and M6
   calls:

   ```sql
   create function public.get_shared_poem(p_share_id text)
   returns table (title text, source_text text, allow_remix boolean, updated_at timestamptz)
   language sql stable security definer set search_path = '' as $$
     select p.title, p.source_text,
            coalesce(p.allow_remix, pr.remix_default, false),
            p.updated_at
     from public.poems p
     left join public.profiles pr on pr.id = p.owner_id
     where p.share_id = p_share_id
       and p.status in ('unlisted', 'published');
   $$;

   revoke all on function public.get_shared_poem(text) from public;
   grant execute on function public.get_shared_poem(text) to anon, authenticated;
   ```

   Exact-id lookup only; returns nothing for a `draft` (AC87); resolves the
   effective remix flag server-side so M7 never exposes `profiles` to a viewer
   (AC113–AC114); returns no `owner_id`, so a share link leaks no user graph.
   `set search_path = ''` is mandatory on a `security definer` function —
   without it the definer's privileges can be turned against a caller-controlled
   search path. The join to `profiles` is a **left** join deliberately: an inner
   join would make a poem with a missing profile row vanish from its own share
   page, whereas this degrades to `allow_remix = false` — the safe direction
   (D38).
4. **No service-role key for M6.** Because the RPC runs safely under the anon
   key, the SSR share page needs no privileged credential —
   `SUPABASE_SERVICE_ROLE_KEY` stays unset (as `.env.example` advises) until
   account deletion (AC92, M9) genuinely requires `auth.admin`. A key that is
   never set is a key that cannot leak (AC88).
5. **Title is derived app-side at save** (AC23), using the `poetic` parser
   Fiddle already imports, and stored as a plain column — a cache of the
   `.poem` header, never separately editable. A generated column is impossible
   here: the header only yields a title by running the JS parser.
6. **The render cache is Next's data cache, not a table** — tagged per poem and
   invalidated on the owner's save (AC19, AC82, AC43). No stale HTML is ever
   stored as truth (D15), and the schema stays lean.
7. **No age column.** The minimum-age gate (D39, AC115) is a statement at the
   sign-in prompt, not stored data — see §6.7.
8. **Phase 2a/2b tables are deferred to their phases**, but `poem_status`
   ships with `published` in it from the start, so AC38's "exactly one of
   draft/unlisted/published" holds without an enum migration later. `sites`,
   `poems.slug`, and `github_connections` land with 2a/2b respectively.

#### RLS

Both tables get `enable row level security` and therefore **default-deny**;
every policy below is scoped `to authenticated` and matches on ownership:

| Table | Policy | Rule |
|-------|--------|------|
| `poems` | select / insert / update / delete | `(select auth.uid()) = owner_id` |
| `profiles` | select / update | `(select auth.uid()) = id` |

`(select auth.uid())` rather than bare `auth.uid()` so Postgres caches it as an
initplan instead of re-evaluating per row. Anonymous users get **no** table
policy — their only read path is `get_shared_poem`, and their only write path is
localStorage (AC7, AC21). Account deletion cascades from `auth.users` through
both tables (AC92).

**Testing (AC87 demands it explicitly).** RLS is security-critical and silently
fails open when misconfigured, so it gets pgTAP tests run in CI via
`supabase test db` against a local Supabase (the `supabase/setup-cli` action;
Actions minutes are free on this public repo). The cases that must fail are as
important as the ones that must pass: owner CRUD succeeds; a second user reading
or updating another's poem returns nothing; anon `select` on `poems` returns
nothing; `get_shared_poem` returns an unlisted poem by id, **refuses a draft**,
and coalesces `allow_remix` correctly through both the per-poem override and
`remix_default`.

### 6.3 Hosting / environment
Vercel project (D11) — **created, `www.poeticfiddle.com` live** since
2026-07-13 (Root Directory = repo root; Next.js auto-detected). Supabase
project **"Poetic Fiddle"** — **created** 2026-07-13
([ixerygypaevxzmiknokg.supabase.co](https://ixerygypaevxzmiknokg.supabase.co)),
region **`ap-southeast-1` (Southeast Asia, Singapore)** — data-residency choice
disclosed per D41 (see REQUIREMENTS.md §15). Client wiring landed with M4
(`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`); the variable
contract the app codes against is captured in `.env.example` (copy to
`.env.local` for local dev; set the same variables in Vercel for deploys) —
see README.md "Environment & secrets".

The Supabase organisation is on the **Pro** plan, because of *other* projects
on the same account rather than any Fiddle requirement — nothing in Fiddle's
architecture needs paid infrastructure, so AC28/AC47 ("no paid infrastructure
*required*") still hold, and the design stays free-tier-viable so the plan can
be dropped again (§6.5). Pro's practical effect here is that idle-pausing does
not apply (AC93).

Auth mail still needs custom SMTP before anyone outside the project team can
sign in — see §6.4 and `TECH-DEBT.md` TD26071601.

`poeticfiddle.com` (Cloudflare Registrar + DNS, registered 2026-07-13; see
REQUIREMENTS.md §14) is wired to Vercel: Vercel's own domain setup redirects
the apex → `www` (308), so **`www.poeticfiddle.com` is the canonical host**
(kept as-is per D34-status-update rather than reversed to match D23's original
apex-only examples — those examples now read `www.poeticfiddle.com/@handle`).

### 6.4 Auth email deliverability *(blocks real sign-in; informs M4, gates M9)* — ✅ **DECIDED 2026-07-16**

**Decision: SMTP2GO as the custom SMTP provider**, sending as
`no-reply@poeticfiddle.com`.

**This is more urgent than "before public launch".** Supabase's built-in mailer
is not merely rate-limited — it **refuses to deliver to any address that is not
part of the project's team**, caps at **2 messages/hour**, and carries no
delivery or uptime SLA; Supabase documents it as not for production use. So
magic-link and password mail cannot reach *any* real user today. M4 is
delivered and correct in code, but nobody outside the project team can complete
a sign-in until this is configured — which also blocks testing M5's ownership
and RLS behaviour with a genuine second account. Configuring custom SMTP raises
the cap to 30 messages/hour (adjustable in the dashboard).

**Why SMTP2GO:** a free tier of 1,000/month (200/day) comfortably covers
Fiddle's auth-only volume, with CNAME-based domain verification (return-path,
DKIM and link-tracking) for `poeticfiddle.com` — whose zone is already on
Cloudflare (§6.3) — and standard SMTP that Supabase's custom-SMTP setting
consumes directly. Resend's free tier permits only **one** verified domain,
which is committed to another project, so a second domain there would force a
paid plan. AWS SES is cheaper at high volume but needs a sandbox-removal request
and more IAM surface than auth mail justifies; Brevo stamps its own branding on
the free tier. SMTP2GO's one caveat is a reduced free-tier cap until the sending
domain is three months old — immaterial at auth-mail volume.

**Where the credential lives — Supabase, not Vercel, not this repo.** Supabase
Auth sends the mail itself, server-side; Fiddle's application code never
composes or sends an email. So the SMTP2GO username and password are **not**
Fiddle environment variables: they do not belong in `.env.local`, in Vercel's
environment variables, or in `.env.example`'s contract, and no code change is
needed to adopt them. Outstanding manual steps are tracked as `TECH-DEBT.md`
**TD26071601**:

1. **SMTP2GO → Verified Senders:** add the sender domain `poeticfiddle.com`;
   SMTP2GO emits three `CNAME` records (return-path, DKIM and link-tracking).
2. **Cloudflare DNS:** add those `CNAME`s to the `poeticfiddle.com` zone, left
   **DNS-only (not proxied)**. They carry SPF alignment via the return-path
   subdomain, so no root SPF `TXT` edit is needed.
3. **SMTP2GO → SMTP Users:** use (or create) an SMTP user and note its username
   and password — sending is the only capability an SMTP user has (AC88).
4. **Supabase → Authentication → Emails → SMTP Settings:** enable custom SMTP
   with host `mail.smtp2go.com`, port `465` (SSL; `587` STARTTLS is the
   fallback), the SMTP2GO username and password, sender
   `no-reply@poeticfiddle.com`, sender name "Poetic Fiddle". The password is a
   secret held by Supabase — it must not be pasted into an agent workspace or
   any tracked file.
5. Send a magic link to a non-team address to confirm delivery (AC109), then
   raise Auth → Rate Limits above 30/hour only if a real need appears.

SMTP2GO joins the disclosed sub-processor list (D41) as the transactional-email
provider — named in REQUIREMENTS.md §15 and in the published Privacy Policy
(`src/app/privacy/page.tsx`).

### 6.5 Supabase idle-pause *(operability)* — ✅ **DECIDED 2026-07-16**

**Decision: implement the daily keep-alive cron, as insurance rather than a
live need.** The Supabase organisation is on the **Pro** plan — an upgrade
forced by *other* projects on the same account, not by anything Fiddle needs —
and Pro projects are never paused for inactivity, so AC93's failure mode is
currently dormant.

It is implemented anyway because the constraint that made the upgrade necessary
is external to Fiddle and may lift: a future drop back to the free tier would
otherwise silently re-arm a real outage mode. A free project pauses after
**7 days without database activity** (data is preserved; restore is manual),
and the moment that bites hardest is just after launch — when the first visitor
to a permanent share link (D34) arrives before there is enough organic traffic
to keep the project warm.

**Shape [my call]:** a Vercel cron (once daily — the Hobby limit, and ~7× the
frequency needed) hits an app route guarded by a `CRON_SECRET`, which calls a
trivial RPC that writes to a single-row heartbeat table. A *write*, not a read,
because the pause timer tracks database activity. Free, ~30 lines, and it keeps
AC28/AC47's "no paid infrastructure *required*" intact — a claim the Pro
upgrade does not falsify, since Fiddle itself still requires none. Lands with
M8 (operability); worth noting it works around a resource-saving measure —
widely done and not prohibited, but a deliberate choice rather than an
oversight.

### 6.6 Pug precompilation toolchain *(inside M0)* — ✅ **RESOLVED 2026-07-13 (upstream)**

Settled by M0 and already as-built in `poetic`: **a build step emitting a
module**, not runtime `compileClient`. `src/tools/build-templates.js` (run via
`npm run build:generated`) precompiles `src/templates/*.pug` into
`src/tools/poem-templates.js` as standalone functions — `inlineRuntimeFunctions`
makes each self-contained (no `pug` compiler, no `fs`, no `__dirname` in the
browser bundle), each is wrapped in an IIFE so the inlined runtimes cannot
collide, and `pretty: false` / `compileDebug: false` match `poem-render.js`'s
runtime options exactly. The emitted output is asserted byte-identical to the
runtime compile over poetic's whole poem corpus (`test/poem-templates.test.js`),
so the CLI and browser render paths cannot silently diverge. Nothing is owed on
the Fiddle side.

### 6.7 Minimum-age evidence *(informs M4's prompt, gates M9)* — ✅ **DECIDED 2026-07-16**

**Decision: a statement, not stored data.** The sign-in prompt carries "By
continuing you confirm you're 16 or older and agree to the Terms" beneath the
sign-in options; nothing about age is collected or persisted (hence no column
in §6.2's `profiles`).

This satisfies D39/AC115's "states a minimum age of 16 and does not knowingly
create accounts for under-16s" at the lowest friction for a non-technical poet
(D2) — a magic-link or Google sign-in stays one click — and is the strongest
available reading of D41's data minimisation: a date of birth would be personal
data Fiddle has no other use for. The trade is accepted deliberately: a
statement is weaker evidence than a ticked checkbox if ever challenged, which
is proportionate for a small non-commercial service. If legal review before
launch (§15's "not legal advice" caveat) wants affirmative consent recorded,
the upgrade is a checkbox plus an `age_confirmed_at` timestamp on `profiles` —
one column and one click, addable without touching anything else.

---

## 7. Suggested immediate next actions

1. ~~**Kick off M0 upstream** in `poetic`~~ — **done** (poetic PR #31, commit
   `b204140`): `renderPoem`/`renderPoemPage` extracted, the three fs couplings
   broken, and the §3.3 flags resolved (see §3). poetic PR #33 also resolved
   the §6.1 packaging groundwork (TD26071301 — `exports` map for
   `poetic/browser`); Fiddle's remaining M0 threads are the §6.1 **consumption
   mechanism** decision and the boundary sanitiser (lands in M2/M6).
2. ~~**Start M1**~~ — **done**: Next.js + TS scaffold, CI (`build.yml` +
   CodeQL js-ts), and the brand shell are in place (see §4).
3. ~~**Settle the §6.1 packaging decision**~~ — **done**: a tag-pinned
   release-tarball dependency on `poetic` (see §6.1).
4. ~~**Start M2**~~ — **done**: the editor + live preview (see §4).
5. ~~**Start M3**~~ — **done**: anonymous drafts (see §4).
6. ~~**Start M4**~~ — **done**: Supabase authentication (see §4).
7. ~~**Run the §6.2 schema/RLS design pass**~~ — **done**, along with every
   other open §6 decision (see §6).
8. ~~**Configure custom SMTP**~~ — **done** (§6.4, TD26071601): SMTP2GO is
   configured, so sign-in reaches addresses outside the project team.
9. ~~**Start M5**~~ — **done**: the §6.2 migrations, Save, and the dashboard
   (see §4).
10. ~~**Start M6**~~ — **done**: share permalinks, SSR (see §4).
11. ~~**Start M7**~~ — **done**: the remix flow (AC20, AC21, AC113) is in
    (see §4).
12. ~~**Finish M7**~~ — **done**: the remix permission controls (AC114) — the
    per-poet global switch (`profiles.remix_default`) and the per-poem
    override (`poems.allow_remix`), with dashboard and editor controls (see
    §4).

13. **Work through W1–W16** — the M8/M9 remainder, decomposed in §4
    ("M8/M9 — remaining work, decomposed into selectable items") into
    discrete, one-PR items. All are agent-selectable except the single
    human step inside each of W9 and W16.

With M0–M7 delivered and §6 resolved, **the W-items of §4 are the immediate
next step**, P1 items first.

---

## Appendix — milestone → acceptance-criteria coverage

| Milestone | Acceptance criteria |
|-----------|---------------------|
| M0 renderer spike | AC3, AC42 (enables AC1, AC18, AC24, AC41); AC85–AC86 strategy |
| M1 scaffold & CI | foundational (AC28, AC83) |
| M2 editor + preview | AC1–AC6, AC24, AC25, AC80 |
| M3 anon drafts | AC7–AC10, AC98 |
| M4 auth | AC9, AC11, AC12 |
| M5 data + save | AC13–AC16, AC22, AC23, AC87, AC94, AC95 |
| M6 share (SSR) | AC17–AC19, AC25, AC29, AC82, AC84, AC90 |
| M7 remix | AC20, AC21, AC113, AC114 |
| M8 NFR hardening | AC74–AC100 (per surface) |
| M9 legal/brand/domain | AC92, AC104–AC118 |
| non-goals (QA-absent) | AC30–AC32, AC48–AC51, AC101–AC103 |
