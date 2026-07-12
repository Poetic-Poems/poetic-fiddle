# Poetic Fiddle — Implementation Plan

> **Living planning document.** This turns the settled requirements in
> [`REQUIREMENTS.md`](REQUIREMENTS.md) (decisions D1–D41, acceptance criteria
> AC1–AC118) into a sequenced build plan: the critical-path dependency, the
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
`docs/RENDERER-BROWSER.md` and `src/browser/render.js`. The Fiddle app itself is
not yet scaffolded, so the gating next step is the **M1** app scaffold, which in
turn unblocks **M2** (the editor — the first place M0 is consumed).

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
*Depends on: nothing. Runs parallel to M0.*
- Scaffold Next.js (App Router) + TypeScript (D9); `package.json`, ESLint config
  (the tooling `CLAUDE.md` notes is "added when the app is scaffolded"), Prettier
  to match `.editorconfig`.
- CI: app build + test workflow; add CodeQL **`javascript-typescript`** to the
  existing scan set; wire commit-format CI already present.
- Base layout, routing skeleton, and the brand shell (logo, palette D31–D33) so
  later milestones drop into a themed frame.
- **ACs:** foundational (enables AC28, AC83).

### M2 — Editor + live preview
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
*Depends on: M2.*
- Full anonymous edit/preview with no sign-in prompt (AC7).
- Draft persisted to `localStorage`, restored on reload/reopen (AC8).
- Migration hook so a draft carries into the account on first sign-in (AC9) —
  the persistence side; the auth trigger lands in M4.
- Sign-in prompt only when Save/Share is attempted (AC10).
- **ACs:** AC7–AC10, AC98.

### M4 — Authentication
*Depends on: M1 (Supabase project provisioned).*
- Supabase Auth: magic-link email **and** Google **and** email/password (D8,
  AC11); session persists across reloads (AC12).
- Complete the M3 migration: on first successful sign-in, adopt the localStorage
  draft (AC9).
- **ACs:** AC11, AC12, AC9.

### M5 — Data model, Save & dashboard
*Depends on: M4; requires the schema/RLS design pass (§6.2).*
- `poems` table (raw `.poem` `source_text` as canonical source — D15, AC16);
  title derived from the header (AC23); RLS so users touch only their own rows
  (AC87).
- Manual Save with an "unsaved changes" indicator (AC13, AC14); a failed save
  surfaces an error and never silently drops edits (AC94, AC95).
- "My poems" dashboard incl. an empty state that guides back to the editor
  (AC15, AC22).
- **ACs:** AC13–AC16, AC22, AC23, AC87, AC94, AC95.

### M6 — Share permalinks (SSR)
*Depends on: M5, M0 (`renderPoemPage` server-side).*
- Generate an unlisted permalink; visibility defaults to `unlisted` (D14, AC17,
  AC29, AC90); opaque `share_id`.
- Read-only **SSR** render with no editor chrome, viewable without JS (AC18,
  AC84); correct `<title>`/OG meta.
- Reflects current source, modulo a short render cache (D15, AC19, AC82).
- Media/song embeds show the **full** player on the share page (AC25) — behind
  the embed allow-list/sandbox (AC86).
- **ACs:** AC17–AC19, AC25, AC29, AC82, AC84, AC90.

### M7 — Remix (opt-in)
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
  later l10n (AC97); graceful degradation (AC93, AC94).
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
- Domain `poeticfiddle.com` over HTTPS (D34, AC108); **auth-email DNS**
  (SPF/DKIM/DMARC) so magic links deliver (AC109).
- **ACs:** AC92, AC104–AC118.

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

## 6. Open implementation decisions (resolve before/at build)

These are the registry's parked "later rounds" plus what surfaced from reading
the render code. Each needs a decision before the milestone that consumes it.

### 6.1 Renderer packaging & versioning *(gates M0 → M2)*
How Fiddle imports the browser-safe renderer from `poetic`. **[flag]** Options:
(a) a published npm package from `poetic` (cleanest consumption; but poetic is
`private: true` today); (b) a git dependency / git submodule pinned to a tag;
(c) a Fiddle build step that vendors a pinned, precompiled bundle. Must also
cover the **preview CSS** asset (§3.1(4)) and pin to a poetic version (AC68
pattern). **[my call]** lean towards (a) a small public package scoped to the
renderer if poetic can publish one, else (b) a tag-pinned git dependency.

### 6.2 Database schema & RLS design *(gates M5)*
A proper design pass is owed (registry parked it). Consolidated **draft** from
the registry's data-model sketches (§7, §8.1, §8.2, §15) — to be firmed up:

- `poems`: `id`, `owner_id`, `title` (derived), `source_text` (raw `.poem`),
  `status`/`visibility` (`draft|unlisted|published`, default most-private),
  `share_id` (opaque), `slug` (2a, unique per site), `allow_remix` (nullable,
  D38), `created_at`, `updated_at`.
- `users`/profile: `remix_default` (default `false`, D38), handle (2a).
- `sites` (2a): `owner_id`, `handle` (unique), `title`, `subtitle`, `author`,
  `favicon`, `publish_target` (`fiddle|github`, 2b), GitHub linkage.
- `github_connections` (2b): App installation id, account/login, status.
- **RLS:** owner full CRUD; `unlisted` readable only via `share_id`; `draft`
  never exposed; published readable (AC40, AC87). RLS is security-critical —
  design and test explicitly.

### 6.3 Hosting / environment
Vercel project (D11); Supabase project + **region chosen for data-residency and
disclosed** (D41); env-var/secret management (service keys server-only, AC88).

### 6.4 Auth email deliverability *(gates M9, informs M4)*
Sending domain for magic-link/password mail needs SPF/DKIM/DMARC (AC109).
**[flag]** Supabase's built-in SMTP vs. a dedicated transactional-email
sub-processor (the latter is disclosed per D41); pick before public launch.

### 6.5 Supabase free-tier idle-pause *(operability)*
Free projects pause after ~7 days idle (D10, AC93). No data loss, but a
keep-alive or paid-upgrade path is a later operational call — acceptable to
defer for MVP.

### 6.6 Pug precompilation toolchain *(inside M0)*
Choose how templates are precompiled to functions (pug's `compileClient`/
`compileFileClient`, or a build step emitting a module) and where that runs in
poetic's build.

---

## 7. Suggested immediate next actions

1. ~~**Kick off M0 upstream** in `poetic`~~ — **done** (poetic PR #31, commit
   `b204140`): `renderPoem`/`renderPoemPage` extracted, the three fs couplings
   broken, and the §3.3 flags resolved (see §3). Fiddle's remaining M0 threads
   are the §6.1 packaging decision and the boundary sanitiser (lands in M2/M6).
2. **Start M1** (Next.js + TS scaffold + CI + CodeQL js-ts + brand shell) — it
   needs nothing from the renderer and unblocks M2 now that M0 has landed.
3. **Run the §6.2 schema/RLS design pass** so M5 is ready when auth (M4) is.

With M0 delivered, **M1 is the immediate focus**; M2 (the editor) can begin as
soon as M1 lands and the §6.1 packaging decision is made. The rest sequences
behind them per §2.

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
