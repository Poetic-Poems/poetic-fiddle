# Poetic Fiddle — Requirements Registry

> **Living planning document.** This is a working registry of requirements,
> decisions, and open questions for Poetic Fiddle. It is deliberately *not* an
> as-built doc (it records proposals, open questions, and rationale). Any agent
> or contributor should be able to read this and resume requirements gathering
> with minimal loss. Keep it current: when a decision is confirmed, move it from
> "Open questions" to "Decisions log" with a date.

**Status:** MVP fully specified (see §7). Ready for implementation planning; further requirements (Phase-2 publishing, acceptance criteria) are optional next steps.
**Last updated:** 2026-07-12

---

## 1. Project framing (from the initial brief)

Poetic Fiddle will be a web app that is an easy-to-use interface to the
[Poetic](https://github.com/Poetic-Poems/poetic) framework. At its core it is a
text editor for writing poems in the `.poem` syntax, with a **real-time preview**
of the built HTML output (hence "Fiddle", à la JSFiddle).

The stated long-term vision: for logged-in users, Poetic Fiddle manages as much
or as little of the process as the user wants — potentially everything from
setting up the user's GitHub presence, to managing commits and the build,
handling user configuration, and delivering the GitHub Pages and (optionally)
Blogger sites.

### Reference repositories
- **Provider / framework:** `poetic` — https://github.com/Poetic-Poems/poetic
  (local: `/home/wallen/Code/poetic`)
- **This project:** `poetic-fiddle` — https://github.com/Poetic-Poems/poetic-fiddle
  (local: `/home/wallen/Code/poetic-fiddle`)
- **Example consumer:** `fragments-and-unity` — https://github.com/Warwick-Allen/fragments-and-unity
  (local: `/home/wallen/fragments-and-unity`) — a real, working Poetic poem collection.

---

## 2. Grounding — how the Poetic framework works (as understood)

Relevant facts for designing Fiddle:

- **Build pipeline (Node.js):** `.poem` → `poem-to-raw` → YAML (`poem-to-yaml`)
  → HTML (`build-poems`, using a **Pug** template + **markdown-it**) →
  plus `build-all-poems` generates `index.html` / `all-poems.html`.
  Dependencies: `pug`, `markdown-it`, `js-yaml`, `js-beautify`. Node >= 18.
- **The framework package is `private: true`** — not published to npm. Consumers
  get it by templating/cloning/forking the repo and syncing via
  `scripts/sync-framework.sh`, tracked by a `.poetic-version` file. Current
  framework version: `v6.0.0`.
- **Configuration:** `.poetic-config.yaml` — `title`, `subtitle`, `favicon`,
  `song_handlers`, `footer`, `blogger`, `auto_sync`, `skip_paths`.
- **Publishing targets:** GitHub Pages (Actions workflow on push to `main`);
  Blogger (optional, OAuth secrets as Actions secrets).
- **`.poem` syntax highlights:** title / optional author / date header;
  `{Section}` blocks; markdown-ish `*emphasis*` / `**strong**`; `/.ai{…}` spans;
  `====` separators; variables (`={author}=…`, `${disclaimer}`, `.shared.poem`);
  `#hashtags`; embedded media (MEGA/Suno/Audiomack). Grammar in
  `poem-syntax.ebnf`; prose spec in `docs/POEM-SYNTAX.md`.

### Renderer portability finding (2026-07-12)
Scan of `poetic/src/tools/` for in-browser feasibility:
- **Core parse is portable:** `PoemParser(content)` in `poem-to-yaml.js` is a
  class over a string — no filesystem in the parse itself (fs is only at the CLI
  boundary: `--all`, reading/writing files).
- **`markdown.js`** (markdown-it) and **`js-yaml`** run in-browser as-is.
- **Render step is the coupled part:** `poem-render.js` reads **Pug templates**
  (`poem.pug`, `poem-page.pug`) and `song-handlers.yaml` from disk via `fs`/
  `__dirname`. A browser build must **precompile the Pug templates to functions**
  and inline the handler/config data (no `fs`).
- **Conclusion:** rendering a single poem in-browser is feasible with a modest,
  one-time extraction of a browser-safe `renderPoem(text, opts)` entry point in
  the poetic repo. This is a **framework (poetic-side) change** — see `/framework-change`.
- **Dual-context bonus:** the extracted renderer is plain JS, so the *same*
  module runs client-side (live preview) **and** server/edge-side (to SSR a
  shared poem's public page with correct `<title>`/OG social-preview meta).

---

## 3. Refined phasing (working model)

- **Phase 1 — MVP:** `.poem` editor + live in-browser preview + user accounts +
  DB-backed save/share (shareable permalinks). No GitHub/Blogger publishing.
- **Phase 2 — Publishing:** deliver a poet's site. "Offer both" models: Fiddle-
  hosted publishing (primary, for non-technical poets) and connect-your-own-
  GitHub via OAuth (for advanced users). Blogger later.
- **Phase 3 — Fuller managed lifecycle:** configuration management, collections,
  auto-sync of framework version, richer site management.

---

## 4. Decisions log (confirmed)

| # | Date | Decision | Notes / rationale |
|---|------|----------|-------------------|
| D1 | 2026-07-12 | **MVP = editor + live preview + accounts + DB-backed save/share** (permalinks). No publishing in MVP. | Round 1. Validates core value before the expensive managed layer. |
| D2 | 2026-07-12 | **Primary audience = non-technical poets** | Round 1. Simplicity and hiding technical machinery are paramount. |
| D3 | 2026-07-12 | **Cost model = minimal cost, but a database is in scope** | Round 1 (custom answer). Favour free/cheap managed DB + serverless/static; avoid expensive always-on infra. |
| D4 | 2026-07-12 | **Publishing = Phase 2+, "offer both"** (Fiddle-hosted + connect-own-GitHub via OAuth) | Round 1. Automated GitHub account creation is off the table (ToS/CAPTCHA). Non-technical users get Fiddle-hosted publishing; advanced users can connect their own GitHub. |
| D5 | 2026-07-12 | **Live preview renders in-browser (client-side)** | Round 2. Zero server cost, instant preview. |
| D6 | 2026-07-12 | **Poetic exports a shared, browser-safe renderer; Fiddle imports it (single source of truth)** | Round 2. Syntax changes flow automatically; no drift. Poetic-side change via `/framework-change`. Same module also usable for server-side SSR of shared pages. |
| D7 | 2026-07-12 | **Poem unit = single poem per fiddle (MVP)** | Round 2. Collections deferred to a later phase. |
| D8 | 2026-07-12 | **Auth = passwordless (magic link + social) primary, plus email/password option** | Round 2. Low friction for non-technical users, with a familiar fallback. |
| D9 | 2026-07-12 | **Stack = TypeScript + Next.js (React) + CodeMirror 6 editor** | Round 3. Largest ecosystem → most reliable first-try agent builds; SSR available for shared pages. |
| D10 | 2026-07-12 | **Backend/Auth/DB = Supabase** (Postgres + Auth [magic link, Google, email/password] + storage, RLS) | Round 3. Least custom auth code; free tier fits minimal-cost goal (caveat: free projects pause ~7 days idle). |
| D11 | 2026-07-12 | **Hosting = free-tier serverless** (Vercel default for Next.js; Cloudflare/Netlify options) | Round 3. Near-zero cost; serverless room for SSR + Phase-2 APIs. |
| D12 | 2026-07-12 | **Anonymous editing + preview; sign-in only to save/share** | Round 4. Client-side render makes anonymous use free; drafts held in localStorage, migrated on sign-up. |
| D13 | 2026-07-12 | **Layout: split-pane on desktop, source/preview toggle on mobile** | Round 4. |
| D14 | 2026-07-12 | **Shared permalink = read-only SSR render + "Remix to edit"; unlisted by default** | Round 4. Remix copies the poem into the viewer's own new fiddle. |
| D15 | 2026-07-12 | **Canonical stored source = raw `.poem` text; render on demand** (cache HTML for share pages only) | Round 4. Poems stay current with the renderer; no stale HTML as source of truth. |
| D16 | 2026-07-12 | **Preview = full styled fidelity** (bundle Poetic's real CSS + page template) | Round 5. True WYSIWYG of the published page; exclude only site-chrome irrelevant to a lone poem. |
| D17 | 2026-07-12 | **Media/song-handler embeds rendered best-effort in preview** (full players on the shared page) | Round 5. |
| D18 | 2026-07-12 | **Signed-in users keep multiple saved poems + a simple "my poems" dashboard** | Round 5. |

---

## 5. Open questions

### Round 3 — tech stack & hosting (SETTLED — see D9–D11)

### Round 4 — MVP feature & UX detail (SETTLED — see D12–D15)

### Round 5 — remaining MVP scope (SETTLED — see D16–D18)

### Next (not yet started)
- **Implementation planning** — break the MVP (§7) into build milestones; the
  poetic-side renderer extraction (a framework change) is the critical dependency.
- **Optional further requirements** — Phase-2 publishing detail; per-feature
  acceptance criteria / user stories; branding, domain, legal/privacy.

### Later rounds (parked)
- How Fiddle consumes the shared poetic renderer (npm package vs git dependency
  vs monorepo) — packaging/versioning mechanism.
- Data model & persistence details; DB schema; RLS policies.
- Phase-2 publishing mechanics (Fiddle-hosted site structure; GitHub OAuth scopes;
  Blogger).
- Accessibility, i18n, offline/PWA; performance, security, privacy posture.

---

## 6. Ways of working locked into CLAUDE.md

Governance already in `CLAUDE.md`: protected `main` + PR-only workflow, squash
merges, Conventional Commits, as-built docs + CHANGELOG, TECH-DEBT register.

Promoted into `CLAUDE.md` from this registry (2026-07-12):
- **Architecture & stack** (D5–D11): in-browser rendering, TypeScript + Next.js,
  Supabase, CodeMirror 6, free-tier serverless hosting.
- **Relationship to the Poetic framework**: Fiddle imports a shared renderer from
  `poetic` (single source of truth); `.poem` changes belong upstream.
- **Development approach**: cost-conscious model/agent selection; minimal-cost
  architecture.

---

## 7. MVP specification (draft)

*Synthesis of decisions D1–D15. Items marked **[my call]** are expert defaults —
override if you disagree. Items marked **[TBD R5]** await Round 5.*

**Elevator:** A web page where anyone can write a `.poem` and instantly see its
rendered HTML. Signed-in users can save poems and share them via unlisted links;
viewers can "remix" a shared poem into their own new fiddle. Aimed at
non-technical poets. No GitHub/Blogger publishing (later phase).

**Roles**
- *Anonymous visitor* — full editor + live preview; drafts kept in browser
  localStorage. Prompted to sign in to save/share.
- *Registered user* — the above, plus save, list, and share their poems.

**Core flows**
1. Edit `.poem` → debounced live preview (~200 ms) **[my call]**.
2. Save (requires sign-in) → persists raw `.poem`; the localStorage draft migrates
   into the account on first sign-in **[my call]**.
3. Share → generate an unlisted permalink to a read-only SSR render.
4. Remix → copy a shared poem into the viewer's own new editable fiddle.

**Editor [my call unless noted]**
- CodeMirror 6 with a `.poem` language mode. v1: structural highlighting
  (`{sections}`, emphasis, variables, `/.ai{…}` spans, comments, `#hashtags`); a
  full Lezer grammar can follow later.
- Non-blocking parse-error indicator; on parse failure keep the last good preview.
- Preview fidelity: **full styled fidelity** — bundle Poetic's real CSS + page
  template so the preview matches the published page; exclude site-chrome
  irrelevant to a lone poem (D16).
- First-run and anonymous sessions load a friendly example `.poem` by default,
  with a link to a `.poem` syntax cheatsheet.
- Save is manual for signed-in users, with an "unsaved changes" indicator;
  autosave is a later enhancement.

**Rendering**
- Shared browser-safe renderer imported from `poetic` (single source of truth),
  used client-side (preview) and server-side (SSR share page + OG meta).
- Media/song-handler embeds: rendered best-effort in the live preview; full
  players on the shared page (D17).

**Data model (draft) [my call]**
- Auth/users via Supabase Auth.
- `poems`: `id`, `owner_id`, `title` (derived from `.poem` header), `source_text`
  (raw `.poem`), `visibility` (default `unlisted`), `share_id` (opaque),
  `created_at`, `updated_at`. RLS: owner full CRUD; unlisted read via `share_id`.
- Multiple saved poems per user, surfaced in a simple "my poems" list/dashboard
  (D18).
- Cache rendered HTML for share pages only (perf); never as the source of truth.

**Explicitly out of scope for MVP**
- GitHub Pages / Blogger publishing; connecting a user's GitHub.
- Multi-poem collections and site-level config (favicon, subtitle, index/all-poems).
- Real-time collaboration; public gallery/discovery.

**Non-functional principles**
- Mobile-first responsive; accessible (semantic HTML, keyboard, screen-reader
  friendly) — poets may rely on assistive tech.
- Minimal running cost (free tiers, in-browser compute); fast, snappy preview.
- Privacy: unlisted-by-default; no unnecessary data collection.
