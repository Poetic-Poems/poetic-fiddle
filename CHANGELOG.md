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

### Changed

- The Privacy Policy now discloses **SMTP2GO** as the sub-processor that
  delivers authentication emails (the magic-link and password sign-in
  messages).
- The Privacy Policy now discloses **Sentry** as the sub-processor that
  records server-side errors and diagnostic logs, hosted in the EU region and
  receiving no poem content.

### Fixed

- The poem title is now visible in the preview panel. It was previously hidden
  by the poetic framework's stylesheet; the app now overrides that rule.
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

### Security

- Bumped `postcss` (a transitive dependency, pulled in both via
  `tailwindcss`/`vitest` and, separately, bundled inside `next`) to 8.5.19
  via an `overrides` entry, resolving a medium-severity XSS via unescaped
  `</style>` in CSS Stringify Output
  ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)).
