# Poetic Fiddle — Requirements Registry

> **Living planning document.** This is a working registry of requirements,
> decisions, and open questions for Poetic Fiddle. It is deliberately *not* an
> as-built doc (it records proposals, open questions, and rationale). Any agent
> or contributor should be able to read this and resume requirements gathering
> with minimal loss. Keep it current: when a decision is confirmed, move it from
> "Open questions" to "Decisions log" with a date.

**Status:** MVP (§7) + MVP acceptance criteria (§9) + Phase-2a Fiddle-hosted
publishing (§8.1) + Phase-2a acceptance criteria (§10) + Phase-2b
connect-your-own-GitHub (§8.2) + Phase-2b acceptance criteria (§11) +
cross-cutting non-functional requirements (§12) + branding (§13) + domain
(§14) + legal/privacy (§15) + user stories & personas (§16) specified.
Next: implementation planning (your call) — the requirements registry is
otherwise feature-complete.
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
  `{Section}` blocks; markdown-ish `*emphasis*` / `**strong**`; `/.classname{…}`
  spans; `====` separators; variables (`={author}=…`, `${disclaimer}`,
  `.shared.poem`); `#hashtags`; embedded media (MEGA/Suno/Audiomack). Grammar in
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
| D14 | 2026-07-12 | **Shared permalink = read-only SSR render + "Remix to edit"; unlisted by default** | Round 4. Remix copies the poem into the viewer's own new fiddle. (Remix later made opt-in, off by default — see D38.) |
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
| D31 | 2026-07-13 | **Branding = sibling sub-brand of Poetic** — shares Poetic's purple `#534AB7`; palette adds a warm amber accent `~#C88A3A` (violin wood) | Branding R1. Fiddle visibly belongs to the Poetic family (framework ↔ "Fiddle" ↔ song lyrics). See §13. |
| D32 | 2026-07-13 | **Logo = the Poetic nib re-posed as a violin** — flipped upright to stand as the body (lightly waisted), with a stylised neck + pegbox; the nib's vent hole + slit are preserved as cut-outs; single purple; authored in-house in Inkscape, not commissioned | Branding R1. Close derivation from the nib. Stylised (no detailed scroll). Canonical asset `public/poetic-fiddle-logo.svg`. Needs a lighter-on-dark variant. |
| D33 | 2026-07-13 | **Name "Poetic Fiddle"; voice = warm & literary** (serif/humanist wordmark; hides technical machinery) | Branding R1. Matches non-technical poets (D2) + written-art framing. |
| D34 | 2026-07-13 | **Domain = dedicated `poeticfiddle.com`** (own domain, not a subdomain) | Domain R1. `.com` cheapest/stable + default recall; `.ink`/`.nz`/`.art` considered. Permalink-permanent once shared; auth mail needs SPF/DKIM/DMARC. See §14. |
| D35 | 2026-07-13 | **Operator / data controller = W W Initiatives Limited** (NZ); NZ Privacy Act 2020 base, GDPR/UK-GDPR-ready; code open-sourced under Poetic-Poems (separate axis) | Legal R1. A named legal operator is required by privacy law; open code and a legal operator both hold. See §15. |
| D36 | 2026-07-13 | **Legal docs = Terms of Service + Privacy Policy + Acceptable-Use Policy**; governing law NZ | Legal R1 ([my call] on venue). |
| D37 | 2026-07-13 | **Content rights = poets retain copyright; Fiddle takes a limited operational licence only** (store/render/display/cache/back-up/serve; ends on deletion) | Legal R1. No ownership claim; no promotional use without separate consent. |
| D38 | 2026-07-13 | **Remix disabled by default** — a global per-poet switch (off) + a per-poem override | Legal R1. Artists are protective; **amends D14, AC20–AC21**. Data model: user `remix_default` (false) + poem nullable `allow_remix`. |
| D39 | 2026-07-13 | **Minimum account age = 16** | Legal R1. Single threshold satisfies GDPR's strictest child-consent age without per-country logic. |
| D40 | 2026-07-13 | **Moderation = short Acceptable-Use Policy + email takedown, actioned manually** | Legal R1. Right-sized for a small non-commercial op; removal propagates to all surfaces (AC92). |
| D41 | 2026-07-13 | **Privacy posture = data minimisation, no third-party analytics, essential/auth cookies only (no consent banner), sub-processor disclosure, deletion+export, NZ notifiable-breach compliance** | Legal R1. Consolidates AC90–AC92, AC103 with [my call] defaults. |

---

## 5. Open questions

### Round 3 — tech stack & hosting (SETTLED — see D9–D11)

### Round 4 — MVP feature & UX detail (SETTLED — see D12–D15)

### Round 5 — remaining MVP scope (SETTLED — see D16–D18)

### Phase-2 publishing requirements — round 1 (ASKED) — see §8
Sequencing; publishable unit (site = collection + config); Fiddle-hosted
mechanism; Blogger scope.

### Non-functional requirements — cross-cutting (SETTLED — see §12)
Accessibility, performance, browser/device support, security (incl. safe
rendering of untrusted poem content), privacy, reliability/availability,
i18n, and offline posture — consolidated across all phases.

### Later / parked
- **Implementation planning** — break the MVP (§7) into build milestones; the
  poetic-side renderer extraction (a framework change) is the critical dependency.
- MVP acceptance criteria — **done, see §9**. Phase-2a acceptance criteria —
  **done, see §10**. Phase-2b acceptance criteria — **done, see §11**. Branding
  — **done, see §13**. Domain — **done, see §14**. Legal/privacy — **done, see
  §15**. User stories & personas — **done, see §16**.

### Later rounds (parked)
- How Fiddle consumes the shared poetic renderer (npm package vs git dependency
  vs monorepo) — packaging/versioning mechanism.
- Data model & persistence details; DB schema; RLS policies.
- Phase-2 publishing mechanics (Fiddle-hosted site structure; GitHub OAuth scopes;
  Blogger).
- Non-functional requirements (accessibility, i18n, offline/PWA, performance,
  security, privacy posture) — **done, see §12**.

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
  (`{sections}`, emphasis, variables, `/.classname{…}` spans, comments,
  `#hashtags`); a full Lezer grammar can follow later.
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
  present (`{sections}`, `*emphasis*`/`**strong**`, variables,
  `/.classname{…}` spans, comments, `#hashtags`), then they are visually
  distinguished via syntax highlighting.

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

- **AC20** [D14, D38] — Given a viewer on a shared permalink page **whose owner
  has enabled remixing** (globally or per-poem), signed in or anonymous, when
  they choose "Remix", then a new, independent copy of the poem opens in the
  editor; once saved it is owned by the viewer and the original owner's poem is
  unaffected. When remixing is not enabled (the default), no Remix action is
  offered (see AC113–AC114).
- **AC21** [D38] — Given an anonymous viewer remixes a shared poem **for which
  remixing is enabled**, when they have not yet signed in, then the remix
  behaves as any other anonymous draft (AC7–AC10 apply): held in localStorage
  until they sign in and save.

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

---

## 12. Non-functional requirements (cross-cutting)

*Consolidates the "Non-functional principles" sketched in §7 and the NFR-flavoured
criteria scattered through §9–§11 (AC26–AC28, AC46–AC47, AC66–AC67) into one
cross-cutting registry, and settles the parked "accessibility, i18n, offline/PWA,
performance, security, privacy" round from §5. These apply across **all phases**
(MVP, 2a, 2b) unless a phase is named. Acceptance criteria continue the single AC
namespace (AC74+); each is Given/When/Then where testable, tagged with the
decision(s) it traces to (§4) or **[my call]** for an expert default — override if
you disagree.*

### 12.1 Accessibility

Non-technical poets may rely on assistive technology; accessibility is a
first-class requirement, not a polish item.

- **AC74** [D2] — Given any user-facing page (editor, dashboard, share view,
  published site), when it is assessed against **WCAG 2.1 AA**, then that is the
  conformance baseline the page is built and tested to.
- **AC75** — Extends AC27: given keyboard-only navigation across the editor,
  preview, dialogs, and forms, when the user tabs through, then focus order is
  logical, focus is always visible, and there are no keyboard traps.
- **AC76** — Given text and interactive controls (including Fiddle's own chrome
  around Poetic's bundled preview CSS), when colour contrast is measured, then it
  meets AA (≥ 4.5:1 for body text, ≥ 3:1 for large text and UI components).
- **AC77** — Given a core page, when the browser is zoomed to 200% or text is
  resized, then content and function are preserved with no loss, and the page body
  reflows without horizontal scrolling down to a 320px-wide viewport.
- **AC78** — Given a user with `prefers-reduced-motion` set, when the app renders,
  then no essential information is conveyed by motion and non-essential animation
  is suppressed.
- **AC79** [D9] — Given the CodeMirror editor, when accessed with a keyboard and a
  screen reader, then it is labelled, operable, and does not trap focus (an
  accessible-editor configuration is required, not the raw default).

### 12.2 Performance & responsiveness

The core promise is an *instant* fiddle; performance is part of the product, not
an afterthought.

- **AC80** [D5] — Given a typical poem, when the user pauses typing past the
  ~200 ms debounce (AC2), then the in-browser preview re-renders within a small,
  interactive budget so editing feels real-time, with no network round-trip for
  the render.
- **AC81** — Given a mid-range mobile device on a typical connection, when the
  editor page loads, then it becomes interactive quickly (target: a couple of
  seconds), and heavy renderer assets load without blocking first paint.
- **AC82** [D21, D15] — Given SSR share pages (AC18) and Phase-2a site pages
  (AC41), when requested, then they serve quickly via caching: an unchanged page
  may be served from cache, and the cache is invalidated on the owner's next edit
  (AC19/AC43) — cheap to operate without serving stale content as truth.

### 12.3 Browser & device support

- **AC83** [D13] — Given current evergreen browsers (latest two major versions of
  Chrome, Edge, Firefox, Safari) on desktop and mobile, when the app is used, then
  it is supported, with a mobile-first responsive layout (split-pane on desktop,
  source/preview toggle on mobile, AC26).
- **AC84** — Given a supported browser, when a required capability is missing, then
  there is a graceful fallback; the editor/preview require JavaScript (documented),
  but SSR share and published-site pages remain viewable without client-side JS.

### 12.4 Security

Fiddle renders **untrusted** poem content to HTML on surfaces viewed by other
people (SSR share pages AC18, Phase-2a public sites AC41); safe rendering is the
headline security requirement.

- **AC85** [my call] — Given a poem authored by one user, when it is rendered on a
  surface viewed by others (share page, public site), then it **cannot inject
  active content** (scripts, inline event handlers, arbitrary iframes) that
  executes in the viewer's session — the shared renderer's escaping is verified,
  and output is sanitised and/or constrained by a strict Content-Security-Policy.
  *(The shared poetic renderer's escaping guarantees must be confirmed at build
  time; record any gap in `TECH-DEBT.md` when scaffolding — cf. §8.2's flag
  pattern.)*
- **AC86** [D17, my call] — Given a media/song-handler embed (MEGA/Suno/Audiomack),
  when it is rendered, then it is limited to a provider **allow-list** and isolated
  (e.g. sandboxed iframes) so an embed cannot script or navigate the host page.
- **AC87** [D10] — Given the database, when access is attempted, then Supabase
  **row-level security** enforces that a user can read/write only their own poems,
  unlisted poems are reachable only via their opaque `share_id`, and drafts are
  never exposed to others (AC40).
- **AC88** [D27] — Given server-side secrets (Supabase service keys, the Phase-2b
  GitHub App private key, any OAuth secrets), when the app runs, then they are
  never shipped to the client; the GitHub App holds only least-privilege
  fine-grained permissions (AC53) and remains individually revocable (AC54).
- **AC89** — Given any request, when it is served, then it is over HTTPS, and
  authentication sessions/tokens are handled by Supabase Auth (AC12) and not
  exposed to other origins.

### 12.5 Privacy & data protection

- **AC90** [D14] — Given a newly created or shared poem, when the user has not
  explicitly changed its visibility, then it defaults to the most private
  applicable state (unlisted; draft where drafts exist), and nothing a user writes
  becomes public without an explicit publish action (Phase 2+) — reinforcing AC29.
- **AC91** [my call] — Given normal operation, when data is collected, then Fiddle
  collects only what it needs (account identity, poem source, site config) and adds
  no tracking/analytics beyond what is disclosed (data minimisation).
- **AC92** [my call] — Given a signed-in user, when they choose to, then they can
  delete individual poems and their whole account and export their raw `.poem`
  source; deleting a poem removes it from every surface (dashboard, share link,
  published site).

### 12.6 Reliability & availability

- **AC93** [D10] — Given the Supabase free tier, when a project is idle ~7 days and
  is paused (a known caveat), then no user data is lost across the pause; a
  keep-alive/upgrade path is a later operational concern, acceptable for MVP.
- **AC94** [D12] — Given failure conditions, when they occur, then the app degrades
  gracefully: a parse error keeps the last good preview (AC4); an anonymous draft
  survives reload via localStorage (AC8); a failed save surfaces an error and does
  not silently discard edits.
- **AC95** [D15] — Given a successful Save, when the session later ends, then the
  raw `.poem` source is durably persisted (AC13) and retrievable from the dashboard
  (AC15) — a Save never quietly loses work.

### 12.7 Internationalisation & localisation

- **AC96** [my call] — Given a poem written in any language or script, when it is
  edited and rendered, then full Unicode/UTF-8 content is handled and displayed
  correctly (poem content is not assumed to be English or Latin-script).
- **AC97** [my call] — Given the product roadmap, when the UI is built, then it
  ships English-only (UI localisation deferred) but is authored without hard-coded
  assumptions that would preclude later localisation.

### 12.8 Offline / PWA

- **AC98** [D12, D5] — Given an anonymous visitor, when they edit and preview, then
  no account and no network round-trip for rendering is required (D5), and the
  in-progress draft persists locally (AC8). A full offline/installable-PWA
  experience is deferred; this posture is stated, not built.

### 12.9 Maintainability & operability

- **AC99** [D6] — Given the codebase, when it is maintained, then the governance in
  `CLAUDE.md` holds (as-built docs, `CHANGELOG.md` for notable changes,
  `TECH-DEBT.md` for deferred work), and the `.poem` renderer is imported from
  `poetic`, not forked (AC3) — so `.poem` behaviour has a single source.
- **AC100** [my call, D3] — Given MVP scale, when operability is considered, then
  observability is minimal (platform-provided logs/metrics suffice); richer
  monitoring is added only when a capability requires it, consistent with the
  minimal-cost goal.

### 12.10 Non-goals (verify absent)

*Confirms the NFR-adjacent deferrals above are genuinely out of scope for now.*

- **AC101** — No offline/installable-PWA behaviour beyond localStorage draft
  persistence (AC98).
- **AC102** — No UI localisation / non-English UI strings in the initial build
  (AC97); poem *content* internationalisation (AC96) is in scope, UI l10n is not.
- **AC103** — No third-party analytics/tracking or non-disclosed data collection
  (AC91).

---

## 13. Branding

*Synthesis of D31–D33. **[my call]** = expert default, override if you disagree.
An initial violin mark has been sketched from Poetic's nib as a working
prototype; final artwork is refined in Inkscape when the app is scaffolded.*

**Identity & relationship to Poetic (D31).** Poetic Fiddle is a **sibling
sub-brand** of the Poetic framework, not an independent identity. It shares
Poetic's primary purple **`#534AB7`** and derives its logo directly from
Poetic's fountain-pen-nib mark, so Fiddle visibly belongs to the Poetic family.
The mark deliberately carries three linked readings: the **Poetic framework**
(the nib), the **"Fiddle"** in the name (a violin), and **song lyrics** as a
form of poem (the fiddle/violin).

**Logo mark (D32).** A **stylised violin** derived from Poetic's nib mark
(`poetic/public/poetic-logo.svg`): the nib is **flipped upright to stand as the
violin body** (lightly reshaped to give it a waist) and topped with a **stylised
neck + pegbox** (no detailed scroll). The nib's **vent hole and slit are
preserved as cut-outs** (visible on coloured/dark surfaces), keeping the lineage
to Poetic explicit. The whole mark is a **single purple**. Authored **in-house in
Inkscape** from the nib source (**ImageMagick** for rasterising favicon/PNG
fallbacks); not commissioned and not machine-generated. Canonical asset:
**`public/poetic-fiddle-logo.svg`**. A **lighter-on-dark variant** is still
needed for dark surfaces (AC106).

**Palette (D31/D33).** Primary **`#534AB7`** (Poetic purple) + a warm **amber
accent `~#C88A3A`** (violin wood) that warms the cool purple and reads as
hand-crafted. The mid purple is low-contrast on dark backgrounds, so the asset
set **must include a lighter-on-dark variant** of the mark, and Fiddle's own
chrome must still meet the AA contrast baseline (AC76) in both light and dark.

**Name & voice (D33).** Public brand name is **"Poetic Fiddle"**. Voice is
**warm and literary** — encouraging and human, a little lyrical, never
technical-sounding — matching the non-technical-poet audience (D2) and the
written-art framing. Wordmark direction: **serif/humanist**. UI copy hides the
technical machinery and speaks to poets, not developers.

**Assets to produce (at scaffolding) [my call]:** primary mark (SVG, light +
dark variants); favicon (SVG + 32/16 px PNG fallbacks, cf. the nib's favicon
note); wordmark/lockup; and the app's own `.poetic-config` favicon used on
hosted `/@handle` sites.

### 13.1 Acceptance criteria (branding)

- **AC104** [D31] — Given any Fiddle surface, when brand colours are applied,
  then the primary colour is Poetic's `#534AB7` and the identity reads as part
  of the Poetic family (shared mark lineage), not an unrelated brand.
- **AC105** [D32] — Given the logo, when it is inspected, then it is a
  violin/fiddle formed from **Poetic's nib mark rotated into a violin body**
  (not stock/clip-art), preserving the nib's vent hole and slit as cut-outs.
- **AC106** [D33] — Given the mark on a dark background, when displayed, then a
  light-on-dark variant is used so it meets the AA contrast baseline (AC76).
- **AC107** [D33, my call] — Given user-facing copy, when written, then it uses
  the warm/literary voice and avoids exposing technical machinery to the poet
  (cf. D2).

---

## 14. Domain

*Synthesis of D34.*

**Primary domain (D34).** Poetic Fiddle is served from a **dedicated domain,
`poeticfiddle.com`**, chosen because it is the cheapest/most stable at renewal
and because non-technical visitors default to typing `.com` (protecting
word-of-mouth recall). Alternatives considered and rejected for now: **`.ink`**
(the aesthetic favourite — a pen-nib nod — but typically pricier at renewal),
**`.nz`**, **`.art`**. The name `poeticfiddle` was unregistered on every
candidate TLD at planning time; registrability is confirmed at the registrar
before purchase.

**Consequences to design for:**
- **Permalink permanence.** Share links (D14) and every `/@handle` site (D23)
  embed this domain; once poems are shared the domain is **effectively
  permanent**. A later domain change requires a permanent redirect from the old
  domain to avoid breaking public links.
- **Auth-email deliverability.** Magic-link/password auth (D8/D10) sends email;
  the sending domain needs **SPF/DKIM/DMARC** configured (or auth mail is routed
  through the provider's authenticated sending domain).
- **Single-brand surface.** The `/@handle` model (D23) means poets' public sites
  live as **paths under the Fiddle domain** (`poeticfiddle.com/@handle`);
  per-user subdomains / custom domains remain Phase 3 (AC48).

### 14.1 Acceptance criteria (domain)

- **AC108** [D34, D23, AC89] — Given the app and all `/@handle` sites, when their
  canonical URLs are formed, then they resolve under the single primary domain
  `poeticfiddle.com` over HTTPS.
- **AC109** [D8, D10] — Given auth email, when it is sent, then it originates
  from an authenticated sending domain (SPF/DKIM/DMARC aligned) so magic links
  are deliverable.

---

## 15. Legal & privacy

*Synthesis of D35–D41, consolidating the privacy criteria already in §12
(AC90–AC92, AC103). **[my call]** = expert default, override if you disagree.
**Not legal advice** — confirm the operator/controller framing and the document
wording with a professional before launch.*

**Operator / data controller (D35).** The running service is operated by **W W
Initiatives Limited** (a New Zealand company; "Datum Process" is a trading name
of the same company), which is the **data controller / "agency"**. The
compliance baseline is the **NZ Privacy Act 2020**, with documents written to
also satisfy **GDPR / UK-GDPR** because poets may be anywhere. This is distinct
from the **code licence**: the source is **open-sourced under the Poetic-Poems
org** — open code and a named legal operator are independent axes and both hold.

**Legal documents (D36).** Three published, linked documents: **Terms of
Service**, **Privacy Policy**, and an **Acceptable-Use Policy**. Governing law
and venue: **New Zealand** [my call].

**Content ownership & licence (D37).** Poets **retain full copyright** in their
poems. By using Fiddle they grant only a **limited operational licence** — to
store, render, display, cache, back up and (where the poet publishes or shares)
serve their `.poem` content — for the sole purpose of running the service; the
licence ends when the content is deleted (cf. AC92). Fiddle claims **no
ownership** and does not use poems for promotion without separate consent.

**Remix permission (D38 — amends D14, AC20–AC21).** Remixing is **disabled by
default**. Each poet has a **global remix switch (default off)** plus a
**per-poem override**, because artists are often protective of their work. A
shared poem is remixable only when its owner has enabled remixing (globally or
on that poem); otherwise the share page offers read-only viewing with no Remix
action. Data-model addition [my call]: a user-level **`remix_default`** (default
`false`) and a per-poem nullable **`allow_remix`** override on `poems`.

**Minimum age (D39).** Accounts require users to be **16 or older** — a single
threshold that satisfies GDPR's strictest child-consent age without per-country
logic.

**Content moderation / takedown (D40).** A short **Acceptable-Use Policy** (no
unlawful, infringing or abusive content) plus a **published takedown
email** actioned manually — right-sized for a small, non-commercial operation.
Removal takes content off **every** surface (dashboard, share link, published
site), consistent with AC92.

**Privacy posture (D41 — consolidates AC90–AC92, AC103 with [my call]
defaults):**
- **Data minimisation (AC91):** collect only account identity (email), poem
  source, and site config; **no third-party analytics/tracking** (AC103).
- **Cookies [my call]:** only **essential/authentication** cookies (the Supabase
  Auth session) — no advertising/analytics cookies — so **no consent banner** is
  required under ePrivacy's essential-cookie exemption.
- **Sub-processors [my call]** (disclosed in the Privacy Policy): **Supabase**
  (Postgres/Auth/storage), the **hosting provider** (Vercel/Cloudflare/Netlify),
  the **transactional-email provider**, and **Google** (as an optional sign-in
  provider). The Supabase project **region** is chosen deliberately for
  data-residency and disclosed.
- **User rights (AC92):** signed-in users can delete individual poems, delete
  their whole account, and export their raw `.poem` source; deletion propagates
  to all surfaces.
- **Default privacy (AC90):** poems default to the most private applicable
  state; nothing becomes public without an explicit publish action.
- **Breach handling [my call]:** comply with the **NZ Privacy Act 2020
  notifiable-privacy-breach scheme** (notify the Privacy Commissioner and
  affected individuals where a breach is likely to cause serious harm).
- **Security** is already specified in §12.4 (AC85–AC89): safe rendering of
  untrusted poems, row-level security, secrets never shipped to the client,
  HTTPS.

### 15.1 Acceptance criteria (legal & privacy)

- **AC110** [D35] — Given the Privacy Policy and ToS, when the operator is
  identified, then they name **W W Initiatives Limited** (NZ) as the controller,
  with the NZ Privacy Act 2020 as the stated baseline and GDPR/UK-GDPR
  accommodated.
- **AC111** [D36] — Given the app, when a user looks for legal terms, then a
  Terms of Service, a Privacy Policy, and an Acceptable-Use Policy are published
  and linked.
- **AC112** [D37] — Given a poet's content, when the ToS describes rights, then
  the poet retains copyright and grants only a limited operational licence that
  ends on deletion; Fiddle claims no ownership.
- **AC113** [D38] — Given a shared poem whose owner has **not** enabled remixing
  (global switch off and no per-poem override), when it is viewed, then the share
  page shows **no Remix action**; when remixing is enabled, Remix produces an
  independent copy (cf. AC20).
- **AC114** [D38] — Given a poet's account, when they set the global remix switch
  or a per-poem override, then that setting governs whether each poem may be
  remixed, **defaulting to off**.
- **AC115** [D39] — Given account sign-up, when age is gated, then the service
  states a **minimum age of 16** and does not knowingly create accounts for
  under-16s.
- **AC116** [D40] — Given infringing or abusive content, when a valid takedown
  request is received at the published address, then the content can be removed
  from **every** surface (dashboard, share link, site).
- **AC117** [D41, AC103] — Given normal operation, when the app runs, then it
  sets only essential/auth cookies, uses no third-party analytics, and discloses
  its sub-processors in the Privacy Policy.
- **AC118** [D41] — Given a notifiable privacy breach, when one occurs, then it
  is handled per the NZ Privacy Act 2020 scheme (Privacy Commissioner + affected-
  individual notification where serious harm is likely).

---

## 16. User stories & personas

*A narrative lens over §4–§15, not a new decision round: personas ground the
"non-technical poets" primary audience (D2) in concrete people, and the user
stories re-tell the already-settled scope (§7, §8.1, §8.2) as first-person
goals. Every story is tagged with the persona(s) it belongs to and the
acceptance criteria (§9–§12) that make it testable — no new scope or criteria
are introduced here.*

### 16.1 Personas

**P1 — Anonymous visitor ("just trying it out").**
Anyone who lands on Fiddle with no account — via a search result, a shared
permalink, or word of mouth. No technical comfort assumed. Goal: see what
Fiddle does with zero commitment, and write or paste a poem to watch it
render. Converts to **P2** the moment they sign in to save or share.

**P2 — Non-technical poet (primary persona, D2).**
A hobbyist or semi-serious poet or songwriter who writes for themselves,
friends, family, or a small following — no coding background, may never have
used GitHub, Markdown, or YAML. Wants the editor to feel like a word
processor, not a developer tool. Goals: write comfortably, keep work safe
(save), show a poem to someone (share), and — later — have "my own little
page" for their poems without learning GitHub (Phase 2a). Protective of their
work by default (unlisted shares, remix off — D38).

**P3 — Advanced / technically-comfortable poet (Phase 2b).**
A poet who is also comfortable with GitHub — perhaps already runs a personal
site, or wants full ownership and portability of their published output.
Comfortable installing a GitHub App and understanding "this creates a repo in
my account." Not a separate account tier: the same person may start as **P2**
and grow into **P3** behaviour simply by connecting GitHub, and can switch
back at will (D30).

**P4 — Reader / viewer (non-account).**
The recipient of a shared permalink, or a visitor to a poet's published
site — a friend, family member, or audience member. Almost never signs up; no
editing surface is shown to them. Goals: read the poem comfortably (including
on mobile and with assistive tech), and optionally remix it into their own
fiddle if the poet has allowed that (D38).

### 16.2 User stories

**MVP**

- **US1** [P1 · AC1, AC5, AC7] — As an anonymous visitor, I want to open
  Fiddle and immediately see an example poem rendering live, so that I
  understand what it does before I write anything myself.
- **US2** [P1 · AC8] — As an anonymous visitor, I want my in-progress poem to
  still be there if I accidentally close the tab, so that I don't lose work I
  haven't saved anywhere yet.
- **US3** [P2 · AC11, AC12] — As a non-technical poet, I want to sign in with
  a magic link or Google instead of inventing a password, so that creating an
  account isn't a chore.
- **US4** [P1→P2 · AC9] — As a visitor who's been drafting anonymously, I
  want my draft to carry over automatically when I finally sign in, so that
  trying Fiddle before committing doesn't cost me the poem I already wrote.
- **US5** [P2 · AC13, AC14] — As a signed-in poet, I want a clear Save action
  and an "unsaved changes" indicator, so that I always know whether my latest
  edits are safe.
- **US6** [P2 · AC15, AC22, AC23] — As a signed-in poet with several poems, I
  want a simple list of everything I've saved, so that I can find and reopen
  any of them.
- **US7** [P2 · AC17, AC18] — As a signed-in poet, I want to send someone a
  link to one poem without making it public to the world, so that I can share
  selectively (a family group chat, not a search engine).
- **US8** [P4 · AC18, AC24] — As a reader following a shared link, I want to
  see the poem exactly as the poet intended — proper styling, no editor
  chrome — so that reading it feels like reading a finished piece, not a
  work-in-progress.
- **US9** [P4 · AC20, AC21, AC113] — As a reader who loves a shared poem, I
  want to remix it into my own fiddle when the poet has allowed that, so that
  I can riff on it without asking them to send me the source text by another
  channel.
- **US10** [P2 · AC4] — As a poet who isn't a programmer, I want a typo in my
  `.poem` syntax to show a gentle warning rather than break the preview, so
  that one mistake doesn't feel like I've broken the app.

**Phase 2a — Fiddle-hosted publishing**

- **US11** [P2 · AC33, AC34] — As a non-technical poet ready to go public, I
  want to pick a simple web address for my poems, so that I can tell people
  "read my poems at poeticfiddle.com/@myname" without touching a hosting
  provider.
- **US12** [P2 · AC36, AC37] — As a publishing poet, I want a single toggle
  per poem to put it on my public site or take it down, so that publishing
  feels as easy as flipping a switch, not running a deploy.
- **US13** [P2 · AC44, AC45] — As a publishing poet, I want to set my site's
  title, subtitle, author name, and favicon from a form, so that I never have
  to write or understand a config file.
- **US14** [P2 · AC40] — As a publishing poet, I want poems I haven't
  published to stay completely invisible on my public site, so that drafts
  and private shares never leak to my audience by accident.

**Phase 2b — connect-your-own-GitHub**

- **US15** [P3 · AC52, AC53] — As a technically-comfortable poet, I want to
  connect my own GitHub account with narrow, specific permissions, so that I
  get full ownership of my published site without handing Fiddle broad access
  to my account.
- **US16** [P3 · AC55, AC57] — As a self-hosting poet, I want Fiddle to set
  up a real, working poetic repo for me with sensible defaults, so that I get
  a working GitHub Pages site without hand-building one myself.
- **US17** [P3 · AC62, AC63] — As a poet who's connected GitHub, I want the
  option to switch back to Fiddle-hosted publishing if owning a repo turns
  out to be more than I wanted, so that trying the advanced path isn't a
  one-way door.
- **US18** [P3 · AC54] — As a poet who's connected GitHub, I want to revoke
  Fiddle's access at any time and keep my repo exactly as it is, so that
  disconnecting doesn't threaten the site I've already built.

**Cross-cutting**

- **US19** [P2, P3, P4 · AC74–AC79] — As a poet or reader using assistive
  technology, I want every core page to be fully operable by keyboard and
  screen reader, so that Fiddle doesn't quietly exclude me.
- **US20** [P2 · AC85, AC87, AC90] — As a poet sharing my work, I want
  confidence that other people's poems can't inject anything malicious into a
  page I'm viewing, and that my own drafts stay private by default, so that I
  can trust the platform with things I've written.
