# Changelog

All notable changes to poetic-fiddle are recorded here.
Patch-level fixes and routine documentation updates are omitted unless they
affect behaviour visible to users of the app.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Next.js app scaffold: a landing page with the Poetic Fiddle brand
  shell (logo, wordmark, purple/amber palette), supporting light and dark
  themes.
- The app is live at [www.poeticfiddle.com](https://www.poeticfiddle.com/),
  deployed via Vercel.
- `.poem` editor with a live preview: CodeMirror 6 with structural syntax
  highlighting, a friendly example poem pre-populated on first visit, and a
  debounced (~200ms) in-browser preview rendered via poetic's browser-safe
  renderer inside a sandboxed, DOMPurify-sanitised iframe.
- Anonymous drafts: the in-progress poem autosaves to the browser's
  `localStorage` and is restored on reload, with no sign-in required to edit
  or preview. Save and Share buttons prompt for sign-in only when clicked.
- Authentication via Supabase: magic-link email, Google, and email/password
  sign-in, with the session persisting across reloads. Signing in for the
  first time adopts any anonymous `localStorage` draft into the session and
  clears it.
- Saving a poem to your account: signed in, the Save button stores the poem
  and keeps updating that same poem on every later save. The toolbar says
  whether you have unsaved changes, and a save that fails says so and leaves
  your work untouched. A saved poem's title comes from the poem's own header,
  and a poem that isn't finished enough to parse still saves.
- A Privacy Policy page (`/privacy`), linked from the site footer on every
  page, covering what Poetic Fiddle collects and how it's used.
- A Terms of Service page (`/terms`), linked from the site footer alongside
  the Privacy Policy, covering acceptance of terms, the service, accounts,
  content ownership, acceptable use, availability, liability, termination,
  and governing law.
- A "My poems" dashboard (`/poems`), linked from the editor toolbar when
  signed in: lists your saved poems, most recently updated first, with an
  empty state guiding you back to the editor. Opening a poem from the list
  (`/poems/<id>`) restores it in the editor with its id preserved, so
  reloading that page resumes editing the same poem instead of losing track
  of which one it was.
- Share permalinks: the Share button saves your poem if needed, then shows a
  `/share/<id>` link you can copy. Anyone with the link sees a read-only,
  server-rendered view of the poem — no sign-in and no JavaScript required —
  with the poem's own styling, a correct page title, and Open Graph preview
  details. A shared poem's link always reflects your latest save, and its
  "My poems" listing is now marked "Shared". Media/song embeds (MEGA,
  Audiomack) show the full player on the share page, restricted to those two
  providers and sandboxed.
- An Unshare control next to a poem's share link: it stops the poem's
  `/share/<id>` permalink from serving, moving the poem back to a draft.
- Clicking Copy on a share link now confirms the copy: the button reads
  "Copied!" for a couple of seconds, with a screen-reader announcement to
  match (#67).
- Remixing a shared poem, where its poet has allowed it: the share page then
  offers a Remix action that opens your own copy in the editor, at
  `/remix/<id>`. The copy is independent — saving it creates a new poem of
  your own and never touches the original — and remixing without signing in
  behaves like any other anonymous draft, held in your browser until you sign
  in and save. Remixing stays **off unless a poet turns it on**: by default a
  shared poem offers no Remix action, and its `/remix/<id>` address is not
  found even if typed directly.
- Remix permission controls: the "My poems" dashboard has a setting for
  whether others may remix your poems by default (off unless you turn it on),
  and the editor has a per-poem override — inherit your default, always
  allow, or never allow — so a single poem can be opened for remixing (or
  closed off) regardless of your account-wide setting.
- Server-side error reporting and structured logs via Sentry, so a share-page
  read or render that fails and degrades to a friendly message now leaves a
  durable, searchable record for diagnosis instead of vanishing. Collection is
  server-side only (no browser SDK, the share page stays JS-free), scrubbed of
  poem content and request cookies/headers, and off until configured.
- Visible `:focus-visible` outlines, in a colour that meets AA non-text
  contrast in both light and dark, on every focusable control including the
  CodeMirror editor. A line next to the editor documents its Esc-then-Tab
  escape hatch (press Esc, then Tab, to move focus out of the editor instead
  of indenting).
- A `prefers-reduced-motion: reduce` safety net in `globals.css` that
  suppresses CSS transitions/animations app-wide for users who request it
  (AC78).
- An automated WCAG AA contrast test (`src/lib/contrast.test.ts`) covering
  every `globals.css` colour-token pairing, in both light and dark, so a
  future token change that drops below 4.5:1 (or 3:1 for non-text UI like the
  focus ring) fails CI (AC76).
- A standalone Acceptable Use Policy page (`/aup`), linked from the site
  footer and from the Terms of Service, so the AUP is a published policy in
  its own right rather than a section inside Terms (D40, AC111).
- A self-service "Delete" action on each poem in the My poems dashboard, with
  an inline confirmation step, so removing a poem no longer requires emailing
  the maintainer (AC92, TD26072414). Deleting an already-shared poem also
  invalidates its share page's cache, so the permalink stops serving right
  away rather than staying visible until the cache's next natural expiry.
- A "Danger zone" section on the My poems dashboard with self-service account
  deletion (AC92, W13): confirming (by typing the account's own email)
  deletes the account outright, cascading to every saved poem, share, and
  profile row, and signs the browser out. Deletion is by irreversible
  removal, not a soft delete — a deleted account's shares stop resolving
  immediately.
- A minimum-age statement on the sign-in prompt — "By continuing you confirm
  you're 16 or older and agree to the Terms" — linking to the Terms of
  Service (D39, AC115, W11).

### Changed

- **CI is one workflow (`.github/workflows/ci.yml`) behind one required
  status check (`CI`).** `build.yml` and `database.yml` are merged into it.
  The app build and the pgTAP data-layer suite are now conditional on what
  the diff touches, and the always-running `CI` job asserts that none of them
  failed — a skipped job counts as a pass, a failed or cancelled one does
  not. This is what lets the data layer become a *required* check for the
  first time: `database.yml`'s trigger-level `paths: supabase/**` filter meant
  the job simply did not report on a pull request that touched nothing under
  `supabase/`, and a required check that never reports blocks the merge
  rather than passing it. A pull request that changes only prose now starts
  no Postgres and runs no `next build`, while one that touches migrations
  must get them past pgTAP before it can merge.
- The Terms of Service's "Acceptable use" section now links to the
  standalone Acceptable Use Policy (`/aup`) instead of restating it.
- Bumped the pinned `poetic` dependency from v6.0.1 to v6.1.1, deliberately
  skipping v6.1.0. A poem's title can now include restricted inline markup —
  `*em*`, `**strong**` and `~~struck~~` (Markdown-standard double-tilde
  strikethrough) — rendered in the visible heading of both the live preview
  and the share page; a single `~` stays literal. v6.1.0 shipped this feature
  with a since-corrected single-tilde strikethrough syntax, which the app
  never ships.
- The Privacy Policy now discloses **SMTP2GO** as the sub-processor that
  delivers authentication emails (the magic-link and password sign-in
  messages).
- The Privacy Policy now discloses **Sentry** as the sub-processor that
  records server-side errors and diagnostic logs, hosted in the EU region and
  receiving no poem content.
- The Privacy Policy's "Saving and sharing poems" section now describes the
  live Save/Share feature (Supabase storage, row-level security, share-link
  revocation, and deletion by request) instead of saying storage "isn't
  available yet".
- The Privacy Policy's "Saving and sharing poems" section now describes
  self-service account deletion from the My poems dashboard's Danger zone,
  keeping the mailto address as a fallback for poets who can't sign in,
  instead of saying account deletion requires emailing the maintainer.
- The Terms of Service's "Termination" section now describes self-service
  account deletion from the My poems dashboard's Danger zone, keeping the
  mailto address as a fallback for poets who can't sign in, matching the
  Privacy Policy, instead of saying account deletion requires emailing the
  maintainer.
- The Acceptable Use Policy and Privacy Policy publish a designated takedown
  address (`takedown@poeticfiddle.com`) and describe the removal process:
  valid requests result in content being removed from every surface — the
  poet's dashboard, any active share links, and the published site (D40,
  AC116).
- The Privacy Policy describes the privacy breach notification process: if a
  breach is likely to cause serious harm, the Office of the Privacy
  Commissioner and affected individuals are notified without unreasonable
  delay — individuals at the email address associated with their account —
  and suspected breaches can be reported to the published privacy contact,
  per the NZ Privacy Act 2020 notifiable-breach scheme (D41, AC118).
- A Source/Preview toggle in the editor below the `lg` breakpoint, so mobile
  users can switch between the two views without horizontal scrolling; the
  split-pane layout at `lg` and above is unchanged (AC26, AC83).

### Fixed

- Poem text in the preview and share views now meets AA contrast. Poetic's
  byline, song-segment, song-link, postscript and empty-section text was a
  grey calibrated against the white card that poetic's own site paints behind
  a poem; Fiddle renders the poem fragment straight onto poetic's page
  background, where that grey was 4.17:1, below the 4.5:1 AA threshold. The
  pinned `poetic` dependency moves to v6.3.0, which darkens it to 4.54:1
  there, stops fading the song-segment marker to 2.65:1 with `opacity`, and
  gives the empty-section notice and the analysis headings the dark-mode
  colours they were missing (3.07:1 and 1.67:1 against the dark background).
  `src/lib/contrast.test.ts` now measures poetic's stylesheet the way a
  browser paints it — inherited colours, backdrops and opacity resolved, over
  poems put through poetic's own renderer — in both colour schemes.
- The postscript's "See more" control works again in the preview and share
  views. Poetic clamps a long postscript to five lines and offers the control
  to reveal the rest; it used to be a CSS-only checkbox, and became a scripted
  button in the version the pin moved to, which left a long postscript
  truncated with no way to read it. The preview now drives the control itself,
  as it already did for the Analysis section.
- A share page's postscript is readable with client-side JavaScript disabled
  (AC84), and the preview and share views no longer clamp a postscript short
  enough that revealing it would show a line or less. The pinned `poetic`
  dependency moves to v6.4.0, which leaves a postscript unclamped by default
  instead of always-clamped-until-lifted; both views now measure rendered
  postscripts against the preview budget themselves, the same way poetic's
  own script would, and apply the clamp (and the "See more" control) only
  when there is a full line or more to reveal.
- The editor's mobile preview pane now clamps a long postscript, matching a
  published Poetic page at the same viewport width. Below `lg`, the preview
  iframe stays mounted at zero size while the source pane shows, so it used
  to measure a zero-size box and never clamp; a `ResizeObserver` on the
  iframe now re-measures whenever it changes size, including the moment the
  preview pane itself becomes visible, not only on window resize or the next
  keystroke.
- Link text (`text-link`, e.g. the legal-page and editor share links) only
  met AA contrast in light mode — 2.61:1 against the dark background, well
  below the 4.5:1 threshold. Dark mode now uses a lighter tint of the same
  brand purple; the button background it's derived from (`brand-primary`) is
  unchanged so white button text stays AA in both schemes (AC76).
- The editor's "Couldn't parse the poem yet" status message used
  `text-amber-600` in light mode, at 3.19:1 — now `text-amber-700` (5.02:1)
  (AC76).
- The poem title is now visible in the preview panel, via poetic's
  `h2.poem-title` heading.
- Fixed three sources of horizontal overflow at a 320px viewport width
  (AC77): the site footer's three legal links no longer force a single
  unbroken row, the editor's share-link URL now wraps instead of
  overflowing its box, and the "My poems" dashboard's per-poem delete
  confirmation (`Delete this poem? / Delete forever / Cancel`) now wraps
  instead of forcing the row wider than the viewport.
- The poem title no longer appears twice in the preview panel. The app had
  been overriding poetic's stylesheet to unhide a second, redundant copy of
  the title (the `.poem-info` section's `title` span); poetic's own
  `display: none` rule for that span is left in place instead.
- A missing space in the Privacy Policy's "What we collect" list, where
  "Account information." ran into the following sentence with no space
  between them in some rendering paths.
- The Analysis section's "Show analysis"/"Hide analysis" buttons now work in
  the live preview. They previously did nothing, because DOMPurify strips
  the inline `onclick` handlers poetic's template relies on; the preview now
  rewires the same show/hide behaviour after sanitisation.
- The Analysis section's "Synopsis"/"Full Analysis" selector buttons (shown
  when an analysis has both forms) now work in the live preview, for the
  same reason and via the same rewiring approach as the show/hide buttons.
- A poem's song-embed button ("Load Audiomack Player" etc.) now works in the
  live preview instead of doing nothing when clicked. The preview can't run
  an in-place player (poetic.js, which normally activates the button, is
  never loaded, and the preview iframe's sandbox has no `allow-scripts`), so
  a click opens the embed URL in a new tab instead, checked against the same
  host allow-list (`src/lib/embed-hosts.ts`) the share page's player uses.
- "My Poems" no longer 404s. The M5 schema migrations had been merged but
  never applied to the live Supabase project, so `poems`/`profiles` were
  missing from its schema cache; the migrations are now pushed and the
  dashboard loads saved drafts correctly.
- A merge to `main` that touches `supabase/migrations/` now pushes those
  migrations to the live Supabase project automatically
  (`.github/workflows/database.yml`'s `deploy` job), so a merged schema
  change can no longer sit unapplied against production the way the above
  fix had to be applied by hand.
- Opening a shared link no longer 500s if reading the poem fails for any
  reason. The share page now shows its existing "poem not found" state
  instead of an unhandled server error, matching how a genuinely unknown
  share id was already handled.
- Shared poem links now render for everyone, including signed-out visitors
  (#52). `/share/<id>` was returning a hard 500 to _every_ visitor because the
  page's server-side sanitiser loads `jsdom`, and jsdom 27+ pulls in the
  ESM-only `@exodus/bytes`; since Vercel `require()`s jsdom rather than bundling
  it, that CommonJS-`require()`-of-an-ESM-module threw `ERR_REQUIRE_ESM` on the
  Turbopack server build. Pinning jsdom to 26.x (whose encoding dependencies are
  all CommonJS) removes the offending package from the tree entirely, so the
  module load can no longer fail. (The "when not authenticated" framing in the
  report was incidental — the signed-out SSR path was simply where it was first
  noticed.)
- Shared poem links render again after a second regression (#86): a Dependabot
  PR bumped jsdom past the 26.x pin above, reintroducing the same `/share/<id>`
  500 in production. The pin is restored, and Dependabot is now configured to
  ignore jsdom major-version updates so it can't silently propose that bump
  again.
- The CodeMirror editor's content-editable element now has an accessible
  name for screen readers. Its visible `<label>` targets an `id` that
  CodeMirror's React wrapper places on the outer wrapper `<div>`, not on the
  `role="textbox"` element itself, so the editor was announced with no name;
  it now also carries an `aria-label` set directly on that element (AC79).
- The sign-in dialog no longer shows raw Supabase Auth error text. Magic-link,
  Google, and password sign-in/sign-up failures now show a safe, mapped
  message (falling back to a generic one for unrecognised error codes),
  matching the safe-message convention `poems-store.ts` already used for
  saved-poem errors.
- A missing `.env.local` no longer breaks the editor silently. Because the
  editor loads via `next/dynamic(..., { ssr: false })`,
  `src/lib/supabase-client.ts`'s missing-env-var throw only fired in the
  browser console — `npm run dev` still started cleanly and served HTTP 200
  with a blank editor pane. A root `src/app/error.tsx` boundary now catches
  it and shows an actionable message pointing at `.env.example`; the README
  also sequences environment setup before the commands table.
- The `.poem` editor's syntax-highlight colours (comments, section markers,
  headings, variables, links, etc.) now meet AA contrast in both light and
  dark mode. They previously used one fixed colour per token, which could
  only ever pass against one of the two backgrounds the editor actually
  renders (`#fff` in light mode, one-dark's `#282c34` in dark mode) — the
  editor now switches between a light-tuned and a dark-tuned colour set
  along with the rest of the theme.
- A stalled Supabase write (save, share, unshare, remix-default, allow-remix)
  no longer leaves the UI stuck in "Saving…" indefinitely. Every Supabase
  request now carries a 12s timeout, so a hung write fails with the app's
  existing typed error (e.g. `PoemSaveError`) instead of hanging until the
  hosting platform's own function timeout. Reads are bounded as well, though
  over several attempts, since postgrest-js retries idempotent requests.
- The editor preview and shared-poem view now render fully styled again, and
  their Analysis toggles work again. The site-wide nonce-based CSP (see
  Security, below) also governs a `srcdoc` iframe's document, since it has no
  response of its own to carry a policy and so inherits its parent's; the
  preview and shared-poem iframes' inline `<style>` carried no nonce, so
  `style-src` silently dropped poetic's entire stylesheet, which also broke
  the Analysis show/hide and syno/full toggles (they depend on that CSS).
  Both components now thread the request's nonce onto their inline `<style>`.
  The site-wide CSP also grants `frame-src` to the shared-poem view's
  song-embed hosts (`mega.nz`, `audiomack.com`), for the same
  inherits-the-parent-policy reason.
- A failed cache-tag invalidation after saving, sharing, or unsharing a poem
  is now captured in Sentry instead of disappearing silently. The share page
  could previously go stale for up to the 5-minute cache expiry with no
  record anywhere that the invalidation had failed.
- The share page now has a visible `<h1>` with the poem's title in its own
  DOM, not only inside the sandboxed preview iframe (which a screen reader
  outside the frame couldn't reach).
- The editor preview and share page now apply poetic's inline `style`
  attributes (a song embed's height/aspect-ratio, a postscript's
  `preview-lines` clamp) instead of silently dropping them. The site-wide CSP
  (see Security, below) governs the `srcdoc` iframes' inherited policy too; a
  nonce satisfies `style-src` for the `<style>` *element* (#97/PR #117) but
  can never satisfy an attribute-level check, so every `style="…"` attribute
  in the rendered poem was still being dropped. Affected values happened to
  match poetic.css's `var()` fallback for a default-sized embed, which is why
  this was previously invisible; a non-default `preview-lines` or an
  aspect-ratio embed (no fallback) rendered wrong.
- The editor and "My poems" dashboard now show a loading fallback instead of
  a blank gap while their client-side bundle hydrates, and an already
  signed-in poet visiting "My poems" no longer briefly sees a "sign in"
  prompt before their session resolves. Sign-in (Google, magic link,
  password), the poet's global remix-default checkbox, and a poem's own
  "Remixing this poem" control now show in-progress text ("Signing in…",
  "Saving…") instead of only disabling while the change is in flight.
- The "My poems" dashboard's delete confirmation now manages focus and
  supports Escape. Clicking "Delete" used to swap the focused button for a
  different element with no focus management, silently dropping keyboard and
  screen-reader focus to the page body; focus now moves onto the
  confirmation's "Cancel" button, Escape cancels it, and focus returns to a
  sensible target (the row's own "Delete" button on cancel; the next row's,
  else the previous row's, else the page heading, after a successful delete).
- Two dark-mode contrast bugs in the editor, caught by wiring axe-core into a
  real browser rather than Vitest's `jsdom` (which can't run its
  `color-contrast` rule at all; TD-PPpfid-26080109). `theme="dark"` was
  pulling in `@codemirror/theme-one-dark`'s own syntax-highlight rules
  alongside the app's own, and for tags both style — like a `{...}` section
  label — its coral (4.38:1 on the editor's dark background) could outrank
  the app's AA-checked colour; the editor now uses only the theme's chrome
  colours. Its line-number gutter was also 3.86:1, short of the 4.5:1
  threshold; it's now the same muted grey the editor already uses for
  comments.

### Security

- Bumped `next` to `16.2.11`, fixing several high-severity advisories in
  Server Actions and proxy/middleware handling — a live code path, since
  `src/lib/revalidate-share.ts`'s `"use server"` export runs on every save
  of a shared poem. Also forced `sharp` (an optional dependency of `next`'s
  image optimisation, still pinned to a vulnerable `^0.34.5` by `next`
  16.2.11 itself) to `0.35.3` via an `overrides` entry, resolving inherited
  `libvips` CVEs
  ([GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)).
- Bumped `postcss` (a transitive dependency, pulled in both via
  `tailwindcss`/`vitest` and, separately, bundled inside `next`) to 8.5.19
  via an `overrides` entry, resolving a medium-severity XSS via unescaped
  `</style>` in CSS Stringify Output
  ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)).
- Bumped `postcss` further, to 8.5.23, resolving a medium-severity incomplete
  fix of the above: an attacker-controlled `sourceMappingURL` could read
  arbitrary `.map` files when PostCSS's `from` option is unset
  ([GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)).
- Added a site-wide `Content-Security-Policy` header (`next.config.ts`) for
  the app's own pages (editor, dashboard, legal), restricting scripts,
  styles, connections, and framing to the app's own origin plus Supabase.
  The share page's sandboxed iframe keeps its own, separate CSP.
- Tightened that CSP: `script-src` and `style-src` now carry a nonce minted
  fresh per request (`src/proxy.ts`) instead of `'unsafe-inline'`.
- That CSP now also declares `style-src-attr 'unsafe-inline'`, as its own
  directive separate from the nonce-carrying `style-src` (#119). Style
  *attributes* can't be satisfied by a nonce (an element-level source), and
  poetic's rendered markup relies on them for per-instance sizing; `<style>`
  elements stay nonce-gated, so this doesn't reopen the surface `script-src`/
  `style-src`'s nonce closed.
- Bumped `fast-uri` (a transitive dependency, pulled in via `@sentry/nextjs`'s
  webpack toolchain — `@sentry/webpack-plugin` → `webpack` → `schema-utils`
  → `ajv`/`ajv-formats` → `fast-uri` — not part of the app's runtime bundle)
  to 3.1.4, resolving a high-severity host confusion via a literal backslash
  authority delimiter
  ([GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx)).
- Bumped `js-yaml` (a transitive dependency pulled in by `poetic`'s own
  `package.json`) to 5.2.2, resolving a high-severity denial of service via
  exponential parsing time in flow collections
  ([GHSA-pm4m-ph32-ghv5](https://github.com/advisories/GHSA-pm4m-ph32-ghv5)).
- Bumped `brace-expansion` (a transitive dependency pulled in via `minimatch`
  10.x, used by `glob`, `typescript-eslint`, and `poetic`'s own `js-beautify`
  toolchain) to 5.0.8, resolving a high-severity denial of service via
  unbounded expansion result length
  ([GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg)).
- Bumped `brace-expansion` on the `minimatch` 10.x chain further, from 5.0.8 to
  5.0.9, resolving a high-severity denial of service via unbounded intermediate
  arrays that bypassed the 5.0.8 mitigation above
  ([GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895)).
- Raised the new-account password minimum length from 6 to 10 characters, with
  a visible hint on the requirement. The same field imposes no minimum when
  signing in to an existing account, so accounts created under the old minimum
  can still sign in (`SignInPrompt.tsx`).
- Added `Referrer-Policy`, `X-Content-Type-Options`, and `Permissions-Policy`
  response headers alongside the existing CSP (`src/proxy.ts`).
  `Referrer-Policy: strict-origin-when-cross-origin` closes a theoretical leak
  path where a `/share/[share_id]` URL's token could otherwise reach a
  cross-origin destination in full via the `Referer` header.
- Raised `minimum_password_length` to 10 in `supabase/config.toml`, so the
  local Supabase stack rejects a new account below the same length the
  sign-up form's `minLength={10}` asks for. The live project's minimum is an
  Auth dashboard setting that neither this file nor `supabase db push`
  applies (TD-PPpfid-26080301).
- CI's `npm audit` gate now covers the whole dependency tree, including
  devDependencies, and runs on every pull request (even a prose-only one)
  rather than only when the diff touches the app. The gate had carried a
  blanket `--omit=dev` since #176, meant to tolerate one tracked advisory
  chain (`eslint` → `minimatch` → `brace-expansion`,
  [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg),
  TD-PPpfid-26072429) but exempting the entire dev toolchain from the gate
  in the process. `brace-expansion` under `minimatch@3.1.5` moves to
  `1.1.18`, the patched 1.x release, clearing that advisory without an
  `eslint` major bump, so `npm run audit` (the gate's new single definition,
  used by both `ci.yml` and the new weekly `dependency-audit.yml`) now runs
  with no exemption and passes clean (TD-PPpfid-26080110).
