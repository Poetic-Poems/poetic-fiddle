# Poetic Fiddle — Requirements Registry

> **Living planning document.** This is a working registry of requirements,
> decisions, and open questions for Poetic Fiddle. It is deliberately *not* an
> as-built doc (it records proposals, open questions, and rationale). Any agent
> or contributor should be able to read this and resume requirements gathering
> with minimal loss. Keep it current: when a decision is confirmed, move it from
> "Open questions" to "Decisions log" with a date.

**Status:** MVP (§7) + MVP acceptance criteria (§9) + Phase-2a Fiddle-hosted
publishing (§8.1) + Phase-2a acceptance criteria (§10) + Phase-2b
connect-your-own-GitHub (§8.2) + Phase-2b acceptance criteria (§11) specified.
Next: implementation planning, or tie-off (your call).
**Last updated:** 2026-07-13

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
  DB-backed save/share (shareable permalinks). No publishing.
- **Phase 2a — Fiddle-hosted publishing:** one site per user (collection + site
  config), served by **dynamic SSR from the DB**. No user GitHub needed. *(built first)*
- **Phase 2b — Connect-your-own-GitHub:** Fiddle creates/maintains a real poetic-
  consumer repo in the user's account (via a GitHub App) that builds through
  Poetic's own Actions + Pages.
- **Phase 3 — Fuller managed lifecycle:** Blogger publishing, multiple sites,
  custom domains, framework-version management, richer configuration.

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
| D19 | 2026-07-13 | **Phase 2 builds Fiddle-hosted publishing first**, then connect-your-own-GitHub | Phase-2 R1. Serves the non-technical primary audience with no external OAuth. |
| D20 | 2026-07-13 | **Publishable unit = one site per user** (their collection + site config) | Phase-2 R1. Multiple sites deferred to Phase 3. |
| D21 | 2026-07-13 | **Fiddle-hosted sites served by dynamic SSR from the DB** (cached) | Phase-2 R1. Cheapest to build/operate; reuses the renderer; instant publish. |
| D22 | 2026-07-13 | **Blogger publishing deferred to Phase 3** | Phase-2 R1. Additive; Poetic already supports it. |
| D23 | 2026-07-13 | **Site address = path `/@handle`** under the Fiddle domain (subdomains/custom domains later) | Phase-2 R2. Simplest; ships fastest. |
| D24 | 2026-07-13 | **Per-poem "publish to site" toggle** decides site contents | Phase-2 R2. Preserves draft privacy; drives the poem visibility model (draft/unlisted/published). |
| D25 | 2026-07-13 | **Fiddle-hosted site mirrors Poetic** (index + all-poems + per-poem pages) | Phase-2 R2. Full fidelity; identical to the future GitHub path. Expands renderer extraction to include the aggregates. |
| D26 | 2026-07-13 | **Managed config UI exposes a friendly subset** (title, subtitle, author, favicon) | Phase-2 R2. Full `.poetic-config` parity deferred. |
| D27 | 2026-07-13 | **Phase-2b GitHub auth = a GitHub App** (fine-grained per-repo permissions, higher rate limits, individually revocable) | Phase-2 R3. Better security than a broad OAuth token or user-pasted PAT for writing to users' repos. |
| D28 | 2026-07-13 | **Fiddle scaffolds a real poetic-consumer repo** (`.poem` + `.poetic-config.yaml`), built by Poetic's own Actions + Pages — not pushed pre-built HTML | Phase-2 R3. Fiddle is an authoring front-end; keeps `.poem` as single source of truth (cf. D6/D15); no duplicated build. |
| D29 | 2026-07-13 | **Repo naming = a project repo, default `poems`** → Pages at `https://<user>.github.io/<repo>/`; renameable | Phase-2 R3. Won't collide with an existing user site; safe default for non-technical poets. |
| D30 | 2026-07-13 | **2a and 2b are either/or per site, switchable** (one active publish target at a time; connecting GitHub migrates the site there, reversibly) | Phase-2 R3. No double-maintenance; leans on the no-lock-in design (raw `.poem` retained regardless). |

---

## 5. Open questions

### Round 3 — tech stack & hosting (SETTLED — see D9–D11)

### Round 4 — MVP feature & UX detail (SETTLED — see D12–D15)

### Round 5 — remaining MVP scope (SETTLED — see D16–D18)

### Phase-2 publishing requirements — round 1 (ASKED) — see §8
Sequencing; publishable unit (site = collection + config); Fiddle-hosted
mechanism; Blogger scope.

### Later / parked
- **Implementation planning** — break the MVP (§7) into build milestones; the
  poetic-side renderer extraction (a framework change) is the critical dependency.
- MVP acceptance criteria — **done, see §9**. Phase-2a acceptance criteria —
  **done, see §10**. Phase-2b acceptance criteria — **done, see §11**. Still
  parked: user stories; branding, domain, legal/privacy.

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

---

## 8. Phase 2 — publishing (requirements gathering in progress)

**Goal:** let a user turn their saved poems into a published *site* — "as much or
as little" managed as they want. Per D4, "offer both": Fiddle-hosted publishing
(primary, for non-technical poets) and connect-your-own-GitHub (advanced), plus
optional Blogger.

**Key dependency / realization:** publishing a site requires the **collection**
concept deferred from the MVP — a *site* = a set of the user's poems + **site-level
config** (title, subtitle, author, favicon, song_handlers, footer; cf.
`.poetic-config.yaml`). Phase 2 therefore brings collections + site config into
scope.

**Continuity from the MVP:** because raw `.poem` is the stored source of truth
(D15), a Fiddle-hosted site and a user-owned GitHub repo are just two renderers of
the same source — so migrating a user from Fiddle-hosted to their own GitHub later
is straightforward (no lock-in).

### Publishing models under consideration

**A. Fiddle-hosted (no user GitHub):**
- A1 — **Dynamic SSR from the DB** via the Next.js app (reuse the renderer; cache
  aggressively). Cheapest to build/operate. *[recommended]*
- A2 — Static export to a CDN/bucket (Cloudflare Pages/R2, Netlify). Adds a
  build/deploy step per publish.
- A3 — Fiddle-owned GitHub org + Pages (repo-per-user). Mirrors Poetic exactly but
  heavy operational surface (many repos, secrets, abuse handling).

**B. Connect-your-own-GitHub (advanced):**
- Cleanest approach: Fiddle creates a **real poetic-consumer repo** from the
  poetic template in the user's account, writes their `.poem` files +
  `.poetic-config.yaml`, and lets **poetic's own GitHub Actions** build + deploy
  Pages. Fiddle is an authoring front-end syncing to a genuine poetic repo — it
  does not reimplement the build. *[recommended over pushing built output]*
- Auth: use a **GitHub App** (fine-grained per-repo permissions, better security &
  rate limits) rather than a classic OAuth token. *[recommended]*

**Blogger (optional):** Poetic already supports Blogger (OAuth + API). Fiddle-
managed Blogger = user connects Google/Blogger, picks a blog, Fiddle publishes.
Additive; can be deferred.

### Phase 2, round 1 (SETTLED — see D19–D22)
Fiddle-hosted first; one site per user; dynamic SSR from the DB; Blogger → Phase 3.

### Phase 2, round 2 — Fiddle-hosted detail (SETTLED — see D23–D26; spec in §8.1)

### Phase 2, round 3 — connect-your-own-GitHub (2b) (SETTLED — see D27–D30; spec in §8.2)
GitHub App auth; scaffold a real poetic repo (not built HTML); project repo named
`poems`; 2a/2b either/or and switchable. Acceptance criteria in §11.

### Parked Phase-2 details (for later rounds)
- Visibility model unification: private draft / unlisted link / published-to-site.
- Phase 2b (GitHub): adopting a user's **pre-existing** repo; exact GitHub-App
  repo-creation API path; two-way sync (both deferred — see §8.2).
- Blogger connection/token storage; template mapping (Phase 3).
- Framework-version management for connected repos (Phase 3).

### 8.1 Phase 2a specification (Fiddle-hosted publishing) — draft

*Synthesis of D19–D26. **[my call]** = expert default, override if you disagree.*

**What it delivers:** each user can publish **one site** at `…/@handle`, served by
**dynamic SSR from the DB** (cached), mirroring real Poetic output (index +
all-poems + per-poem pages). No GitHub required.

**Handle & URLs [my call]:** user picks a unique, URL-safe `handle` on first
publish → site at `/@handle`; each published poem at `/@handle/<poem-slug>` (slug
derived from the title, unique within the site).

**Poem visibility model (unifies MVP share + site) [my call]:**
- `draft` — private to owner (dashboard only).
- `unlisted` — reachable via share link (`share_id`); not on the site. (MVP share.)
- `published` — appears on the user's public site, with its own site URL.
Each poem has one status; the "publish to site" toggle sets `published`.

**Site config (managed UI — friendly subset, D26):** `title`, `subtitle`,
`author`, `favicon`, with sensible defaults for the rest of `.poetic-config.yaml`.
Advanced/full config is a later escape hatch.

**Rendering scope (impact of D25):** the shared poetic renderer extraction must
also produce the **index** and **all-poems** aggregates (not just a single poem),
so hosted output matches Poetic exactly and equals the future GitHub-Pages output.

**Data-model additions (draft) [my call]:**
- `sites` (one per user): `owner_id`, `handle` (unique), `title`, `subtitle`,
  `author`, `favicon`, timestamps.
- `poems` gains `status` (`draft|unlisted|published`) and `slug` (unique per site).

**Out of scope for 2a:** per-user subdomains and custom domains (Phase 3);
connect-your-own-GitHub (2b); Blogger (Phase 3); multiple sites (Phase 3).

### 8.2 Phase 2b specification (connect-your-own-GitHub) — draft

*Synthesis of D27–D30 (plus D4 "offer both" and D6/D15 single-source-of-truth).
**[my call]** = expert default, override if you disagree.*

**What it delivers:** an advanced user connects their own GitHub account, and
Fiddle provisions and maintains a **genuine poetic-consumer repo** in it that
builds and deploys via **Poetic's own GitHub Actions + Pages**. Fiddle is the
authoring front-end; the raw `.poem` source stays canonical. This is the
"connect-your-own-GitHub" half of D4's "offer both".

**Auth (D27):** connection is via **Fiddle's GitHub App**, installed/authorised by
the user — not a broad OAuth token or a pasted PAT. Fiddle requests only the
fine-grained permissions it needs:
- *Repository contents* (read/write) — write `.poem` files + `.poetic-config.yaml`.
- *Pages* — enable/configure GitHub Pages.
- *Workflows* — ensure Poetic's Actions workflow is present.
- *Repository creation* (account-level) — create the repo on first publish.
- *Metadata* (read, mandatory).

Disconnecting/uninstalling the App stops all syncing and leaves the repo intact
(no lock-in).

**Repo model (D28, D29):** on first publish Fiddle creates a project repo (default
name **`poems`**, renameable) from the poetic template, writes the user's
**published** `.poem` files + a generated `.poetic-config.yaml`, and relies on
Poetic's in-repo Actions to build + deploy. Public site URL =
`https://<user>.github.io/<repo>/`. If the default name collides with an existing
repo, Fiddle prompts rather than overwriting **[my call]**. Adopting a
*pre-existing* poetic repo the user already has is deferred (a later enhancement)
**[my call]** — the "ask per publish" flow was not chosen.

**Sync direction [my call]:** **one-way, Fiddle → GitHub.** Fiddle is the authoring
surface and source of truth; changes made directly on GitHub are not read back
(two-way sync deferred). Only **published** poems are written to the public repo;
`draft`/`unlisted` poems are never pushed — preserving the 2a visibility model.

**Config sync (D28, cf. D26):** the managed site-config UI (title, subtitle,
author, favicon) generates the repo's `.poetic-config.yaml`; unexposed fields get
sensible defaults. The user never hand-authors config.

**2a ↔ 2b relationship (D30):** a user's site has **one active publish target at a
time**. Connecting GitHub migrates the site to GitHub (the Fiddle-hosted `/@handle`
site is not simultaneously served); the user can switch back to Fiddle-hosted at
will, because the raw `.poem` source is retained either way.

**Framework version [my call]:** the provisioned repo is pinned to a specific
Poetic framework version at creation. Ongoing version bumps (moving a connected
repo to a newer Poetic) are a Phase-3 managed-lifecycle concern, not automatic
in 2b.

**Data-model additions (draft) [my call]:**
- `github_connections` (per user): App installation id, GitHub account/login,
  connection status, timestamps.
- `sites` gains `publish_target` (`fiddle|github`) and GitHub linkage
  (`repo_owner`, `repo_name`, `pages_url`, `last_synced_at`).

**Open implementation question [flag]:** the exact GitHub API path for a GitHub
App to *create a new repo* in a user's account (installation permissions +
user-to-server token nuances) needs verification at build time; record in
`TECH-DEBT.md` when scaffolding.

**Out of scope for 2b:** adopting a user's pre-existing repo; two-way sync;
pushing pre-built HTML; Blogger (Phase 3); framework-version management UI
(Phase 3); custom domains (Phase 3).

---

## 9. MVP acceptance criteria

*Testable acceptance criteria derived from the MVP specification (§7,
decisions D1–D18). Each criterion is written as Given/When/Then and tagged
with the decision(s) it verifies, for traceability back to §4. Intended for
scoping implementation tickets and QA sign-off — it complements, and does not
replace, the narrative spec in §7.*

### 9.1 Editor & live preview

- **AC1** [D5, D9] — Given the editor page is open, when the user types or
  pastes `.poem` text, then a live HTML preview updates automatically without
  a page reload, rendered entirely in the browser (no server round-trip).
- **AC2** — Given the user is actively typing, when fewer than ~200 ms have
  elapsed since the last keystroke, then the preview does not yet re-render
  (debounced); it updates once typing pauses.
- **AC3** [D6] — Given a `.poem` document, when it is rendered, then the
  output is produced by the renderer imported from the `poetic` repo (no
  Fiddle-local copy of the parser/renderer).
- **AC4** — Given the current `.poem` text contains a syntax error, when the
  preview would re-render, then the editor shows a non-blocking error
  indicator and the preview keeps showing the last successfully rendered
  output (it does not blank out or crash).
- **AC5** — Given a first-time visit or a fresh anonymous session with no
  saved draft, when the editor loads, then it is pre-populated with a
  friendly example `.poem`, and a link to a `.poem` syntax cheatsheet is
  visible.
- **AC6** [D9] — Given the editor, when `.poem` structural elements are
  present (`{sections}`, `*emphasis*`/`**strong**`, variables, `/.ai{…}`
  spans, comments, `#hashtags`), then they are visually distinguished via
  syntax highlighting.

### 9.2 Anonymous use & drafts

- **AC7** [D12] — Given a visitor who is not signed in, when they use the
  editor and preview, then both function fully with no sign-in prompt
  required to edit or preview.
- **AC8** [D12] — Given an anonymous visitor's in-progress `.poem`, when they
  reload the page or close and reopen the tab in the same browser, then their
  draft is restored from localStorage.
- **AC9** [D12] — Given an anonymous visitor with a localStorage draft, when
  they sign in for the first time, then the draft is migrated into their
  account (not lost, not silently discarded).
- **AC10** — Given an anonymous visitor attempts to Save or Share, when the
  action requires an account, then they are prompted to sign in before the
  action completes.

### 9.3 Authentication

- **AC11** [D8] — Given a visitor at the sign-in prompt, when they choose to
  authenticate, then magic-link email and at least one social provider
  (Google) are offered, alongside an email/password option.
- **AC12** [D8, D10] — Given a user has successfully authenticated, when they
  return to the editor, then they are recognised as signed in (session
  persists across reloads) via Supabase Auth.

### 9.4 Save

- **AC13** [D1, D18] — Given a signed-in user with unsaved editor changes,
  when they choose Save, then the raw `.poem` source text is persisted to the
  database under their account.
- **AC14** — Given a signed-in user with changes since the last save, when
  those changes are pending, then an "unsaved changes" indicator is visible;
  it clears once Save completes.
- **AC15** [D18] — Given a signed-in user with more than one saved poem, when
  they open their "my poems" list, then all of their saved poems are shown
  (not just the most recent).
- **AC16** [D15] — Given a saved poem, when it is reopened for editing, then
  the raw `.poem` text is loaded and re-rendered on demand (there is no
  separately-editable stored HTML).

### 9.5 Share (permalink)

- **AC17** [D14, D18] — Given a signed-in user with a saved poem, when they
  choose Share, then an unlisted permalink is generated and the poem's
  visibility defaults to `unlisted` (not publicly listed anywhere).
- **AC18** [D14] — Given a valid share permalink, when anyone opens it,
  signed in or not, then they see a read-only, server-rendered (SSR) view of
  the poem, with no editor controls.
- **AC19** [D15] — Given a shared poem is edited and re-saved by its owner,
  when the permalink is subsequently opened, then it reflects the current
  source — the share page is not a frozen snapshot, modulo any short-lived
  render cache.

### 9.6 Remix

- **AC20** [D14] — Given a viewer on a shared permalink page, signed in or
  anonymous, when they choose "Remix", then a new, independent copy of the
  poem opens in the editor; once saved it is owned by the viewer and the
  original owner's poem is unaffected.
- **AC21** — Given an anonymous viewer remixes a shared poem, when they have
  not yet signed in, then the remix behaves as any other anonymous draft
  (AC7–AC10 apply): held in localStorage until they sign in and save.

### 9.7 "My poems" dashboard

- **AC22** [D18] — Given a signed-in user with zero saved poems, when they
  open the dashboard, then it shows an empty state that guides them back to
  the editor, not an error.
- **AC23** [D18] — Given a signed-in user's dashboard, when a poem's title is
  displayed, then it is derived from the `.poem` header (not a
  separately-entered title field).

### 9.8 Rendering fidelity & media

- **AC24** [D16] — Given the live preview, when a poem renders, then it uses
  Poetic's actual CSS and page template (not a simplified Fiddle-only style),
  excluding only site-level chrome that doesn't apply to a single poem (e.g.
  site nav, index links).
- **AC25** [D17] — Given a poem containing a media/song-handler embed (MEGA,
  Suno, Audiomack), when previewed in the editor, then a best-effort
  representation is shown; when viewed on a shared permalink page, the full
  player is shown.

### 9.9 Non-functional

- **AC26** [D13] — Given the app on a mobile-width viewport, when the editor
  is open, then source and preview are presented as a toggle rather than a
  fixed split pane; desktop uses split-pane.
- **AC27** — Given any core page (editor, dashboard, share view), when
  navigated via keyboard alone or inspected with a screen reader, then all
  primary controls are reachable and labelled — no keyboard traps, no
  unlabelled controls.
- **AC28** [D3, D11] — Given normal MVP usage patterns, when the app is
  hosted, then no paid infrastructure is required to run it (free-tier
  hosting + DB is sufficient), consistent with the minimal-cost goal.
- **AC29** — Given a new poem, when its visibility is not explicitly changed
  by the user, then it defaults to `unlisted`, never publicly listed — there
  is no publishing surface in the MVP at all (see 9.10).

### 9.10 Non-goals (verify absent)

*Confirms the explicitly-out-of-scope items from §7 have no MVP-facing
surface — a negative checklist for QA sign-off.*

- **AC30** — No UI exists for GitHub Pages / Blogger publishing, or for
  connecting a user's GitHub account.
- **AC31** — No UI exists for multi-poem collections or site-level config
  (favicon, subtitle, index/all-poems aggregate pages).
- **AC32** — No real-time multi-user collaboration (concurrent co-editing) or
  public gallery/discovery surface exists.

---

## 10. Phase 2a acceptance criteria

*Testable acceptance criteria derived from the Phase-2a specification (§8.1,
decisions D19–D26). Numbering continues from §9 in a single acceptance-criteria
namespace across the registry. Each criterion is written as Given/When/Then and
tagged with the decision(s) it verifies, for traceability back to §4.*

### 10.1 Site creation & handle

- **AC33** [D20, D23] — Given a signed-in user who has not yet published, when
  they choose to publish for the first time, then they are prompted to choose
  a unique, URL-safe handle, and their site becomes reachable at `/@handle`.
- **AC34** [D23] — Given a user attempts to choose a handle that is already
  taken, when they submit it, then they are told it is unavailable and
  prompted to choose another (no two users can hold the same handle).
- **AC35** [D20] — Given a signed-in user, when they have published, then
  they have exactly one site (Phase 2a supports one site per user; not
  multiple).

### 10.2 Poem visibility & publishing

- **AC36** [D24] — Given a signed-in user's saved poem, when they toggle
  "publish to site" on, then the poem's status becomes `published` and it
  appears on their public site at `/@handle/<slug>`.
- **AC37** [D24] — Given a published poem, when the owner toggles "publish to
  site" off, then the poem's status reverts to a non-published state and it no
  longer appears on the site.
- **AC38** [D24] — Given the unified visibility model, when a poem's status is
  inspected, then it is exactly one of `draft`, `unlisted`, or `published` (no
  poem is in more than one state simultaneously).
- **AC39** [D23] — Given a poem is published, when its site URL is generated,
  then the slug is derived from the poem's title and is unique within the
  owner's site (collisions are disambiguated).
- **AC40** [D24] — Given a poem with status `draft` or `unlisted`, when
  anyone other than the owner views the owner's public site, then that poem
  does not appear on it (draft/unlisted privacy is preserved).

### 10.3 Site pages & rendering fidelity

- **AC41** [D21, D25] — Given a user's published site, when it is requested,
  then it is served by dynamic SSR from the database (no static build/deploy
  step) and includes at minimum an index page, an all-poems aggregate page,
  and one page per published poem — mirroring real Poetic output.
- **AC42** [D25] — Given a site's index and all-poems pages, when rendered,
  then they are produced using the same shared poetic-renderer extraction used
  elsewhere in Fiddle (no Fiddle-local reimplementation of the aggregate
  templates).
- **AC43** [D15, D21] — Given a published site page, when requested repeatedly
  without intervening edits, then a cached render may be served, but it must
  reflect the latest published content after an edit — consistent with the
  MVP's "no stale HTML as source of truth" principle.

### 10.4 Site configuration

- **AC44** [D26] — Given a user managing their site, when they open site
  settings, then they can edit `title`, `subtitle`, `author`, and `favicon`
  via a friendly UI (not a raw YAML/config file).
- **AC45** [D26] — Given site-config fields the managed UI does not expose,
  when the site is rendered, then sensible defaults are applied automatically
  (the user is never required to hand-author `.poetic-config.yaml`).

### 10.5 Non-functional

- **AC46** [D19, D21] — Given normal Phase-2a usage, when a user publishes and
  views their site, then no user-side GitHub account or OAuth connection is
  required at any point.
- **AC47** [D3, D11, D21] — Given Phase-2a hosting, when the app serves
  published sites, then no paid infrastructure is required beyond what Phase 1
  already uses (dynamic SSR plus caching on the existing free-tier stack),
  consistent with the minimal-cost goal.

### 10.6 Non-goals (verify absent)

*Confirms the explicitly-out-of-scope items from §8.1 have no Phase-2a-facing
surface — a negative checklist for QA sign-off.*

- **AC48** — No UI exists for per-user subdomains or custom domains; every
  Phase-2a site is reachable only at `/@handle` under the Fiddle domain.
- **AC49** — No UI exists for connecting a user's own GitHub account or repo
  (Phase 2b is not present).
- **AC50** — No UI exists for Blogger publishing.
- **AC51** — No UI exists for creating or managing more than one site per
  user.

---

## 11. Phase 2b acceptance criteria

*Testable acceptance criteria derived from the Phase-2b specification (§8.2,
decisions D27–D30). Numbering continues from §10 in the single acceptance-criteria
namespace across the registry. Each criterion is Given/When/Then and tagged with
the decision(s) it verifies, for traceability back to §4.*

### 11.1 Connection & authentication

- **AC52** [D27, D4] — Given a signed-in Fiddle user who wants to publish to
  their own GitHub, when they start the connection flow, then they authenticate
  by installing/authorising Fiddle's **GitHub App** — not by pasting a personal
  access token or granting a broad OAuth scope.
- **AC53** [D27] — Given the GitHub App is installed, when Fiddle is granted
  access, then it holds only the fine-grained permissions it needs (repository
  contents, Pages, workflows, and repository creation) and no broader account
  access.
- **AC54** [D27] — Given a user who has connected GitHub, when they later
  revoke/uninstall the GitHub App, then Fiddle stops syncing, reports the
  connection as disconnected, and retains no write access — while the repo itself
  is left intact (no lock-in).

### 11.2 Repo creation & structure

- **AC55** [D28] — Given a connected user publishing to GitHub for the first
  time, when Fiddle provisions their repo, then it creates a genuine
  poetic-consumer repo containing their published `.poem` files and a generated
  `.poetic-config.yaml` — not pre-built HTML.
- **AC56** [D28] — Given the provisioned repo, when its site is built, then the
  build and Pages deploy are performed by **Poetic's own GitHub Actions workflow**
  in the repo (Fiddle does not build or push rendered HTML itself).
- **AC57** [D29] — Given repo creation with defaults, when the repo is named,
  then it defaults to a project repo named `poems` and the site is served at
  `https://<user>.github.io/<repo>/`; the user may choose a different repo name.
- **AC58** [D29] — Given the target repo name already exists in the user's
  account, when Fiddle would create it, then the collision is detected and the
  user is prompted for another name — Fiddle does not silently overwrite an
  existing repo.

### 11.3 Publishing & sync

- **AC59** [D28, D15] — Given a user publishes or updates poems on their
  GitHub-connected site, when Fiddle syncs, then it commits the raw `.poem` source
  (the canonical source of truth) to the repo.
- **AC60** [D24] — Given the per-poem "publish to site" model carried from 2a,
  when a poem is `published` on a GitHub-connected site, then it is written to the
  repo; when it is `draft` or `unlisted`, then it is **not** written to the public
  repo (visibility privacy is preserved).
- **AC61** [D28] — Given Fiddle is the authoring surface, when poems are edited,
  then sync is one-way (Fiddle → GitHub); changes made directly on GitHub are not
  guaranteed to be read back into Fiddle (two-way sync is out of scope for 2b).

### 11.4 Publish-target switching (2a ↔ 2b)

- **AC62** [D30] — Given a user with a Fiddle-hosted (2a) site, when they connect
  GitHub and publish there, then the site has a single active publish target
  (GitHub) and the Fiddle-hosted `/@handle` site is not simultaneously served.
- **AC63** [D30] — Given a user who has switched to GitHub publishing, when they
  choose to switch back to Fiddle-hosted, then they can (the switch is reversible;
  no lock-in), because Fiddle retains the raw `.poem` source either way.
- **AC64** [D30] — Given a switch of publish target, when it takes effect, then
  exactly one target serves the public site at a time (either `/@handle` or the
  GitHub Pages URL, never both).

### 11.5 Configuration sync

- **AC65** [D26, D28] — Given the managed site-config UI (title, subtitle,
  author, favicon), when a user publishes to GitHub, then those values are written
  into the repo's `.poetic-config.yaml` (the user does not hand-author it), with
  sensible defaults for fields the UI does not expose.

### 11.6 Non-functional

- **AC66** [D6, D15] — Given a user's GitHub-published site, when it renders, then
  it is produced by Poetic's own framework in the repo (the same single source of
  truth), so its output matches what Fiddle-hosted (2a) would produce from the
  same `.poem` source.
- **AC67** [D3, D11] — Given 2b operation, when Fiddle provisions and syncs
  repos, then it requires no paid infrastructure beyond the existing free-tier
  stack — the build and hosting cost is borne by the user's own GitHub account
  (Actions + Pages).
- **AC68** [D28] — Given a newly provisioned repo, when it is created, then it is
  pinned to a specific Poetic framework version; ongoing framework-version updates
  are a later phase (Phase 3), not automatic in 2b.

### 11.7 Non-goals (verify absent)

*Confirms the explicitly-out-of-scope items from §8.2 have no Phase-2b-facing
surface — a negative checklist for QA sign-off.*

- **AC69** — No GitHub write access is obtained via a broad OAuth token or a
  user-pasted PAT (App-only).
- **AC70** — No pushing of pre-built HTML to a Pages branch (Poetic's Actions
  build in-repo).
- **AC71** — No two-way sync from GitHub back into Fiddle.
- **AC72** — No flow to adopt/connect a user's pre-existing external repo (a
  later enhancement).
- **AC73** — No simultaneous dual publishing to both `/@handle` and GitHub (single
  active target, per D30); no Blogger publishing and no framework-version
  management UI (both Phase 3).
