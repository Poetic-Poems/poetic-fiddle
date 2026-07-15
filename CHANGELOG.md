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
- A Privacy Policy page (`/privacy`), linked from the site footer on every
  page, covering what Poetic Fiddle collects and how it's used.

### Security

- Bumped `postcss` (a transitive dependency, pulled in both via
  `tailwindcss`/`vitest` and, separately, bundled inside `next`) to 8.5.19
  via an `overrides` entry, resolving a medium-severity XSS via unescaped
  `</style>` in CSS Stringify Output
  ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)).
