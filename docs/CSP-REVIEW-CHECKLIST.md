# CSP review checklist

`src/lib/csp.ts`'s tests (`csp.test.ts`, `proxy.test.ts`,
`PoemPreview.test.tsx`, `SharedPoemView.test.tsx`) assert emitted *strings* —
that the srcDoc carries the right nonce, that the header contains the right
`frame-src` — never that a browser then actually accepts the content a CSP
change lets through or blocks. A policy string can be exactly right and still
break rendering in ways only a live browser shows: TD-PPpfid-26072101's nonce
policy silently dropped the preview/share stylesheets (issue #97), and the
policy that fixed it still blocked poetic's inline `style` *attributes*
(issue #119) for a week, invisible in CI both times.

Run through this checklist, in a real browser, for any pull request that
touches `src/lib/csp.ts`, `src/proxy.ts`, `src/components/PoemPreview.tsx`,
`src/components/SharedPoemView.tsx`, or `src/lib/poem-toggles.ts` — the app
shell's CSP, the two `srcDoc` iframes it governs, and the module that drives
what a click inside those iframes does. A local `npm run dev` (or `npm run build && npm
run start`, closer to what a deployed policy looks like) is enough; a preview
deployment is preferred when one is available, since it exercises `proxy.ts`'s
real header instead of the dev server's.

- [ ] **Preview is styled.** Open the editor (`/`) with a poem that includes
      an Analysis block. The live preview renders with poetic's CSS applied
      (fonts, spacing, colours) — not unstyled HTML.
- [ ] **Analysis show/hide works.** Click the Analysis section's show and hide
      toggles; the section's visibility follows the click.
- [ ] **Synopsis/full toggle works.** Where the poem has both, switching
      between them changes which one is visible.
- [ ] **Song embed sizes correctly.** A poem containing a song embed renders
      it at its intended aspect ratio, not collapsed or default-sized — a
      blocked `style-src-attr` mis-sizes it with no fallback, unlike
      `poetic.css`'s other inline styles, which fall back to a `var()`
      default and mask the same failure.
- [ ] **Embed loads.** The song embed's frame actually loads its content, not
      a blocked/blank frame.
- [ ] **A link in the poem opens.** Left-click a link in the rendered poem —
      the example poem's "syntax reference" link will do. It opens in a new
      tab, rather than doing nothing and reporting a `frame-src` violation:
      a poem lives in a `srcDoc` frame, so an uncaught link click renavigates
      that frame, which `frame-src` blocks (issue #315). Where the poem links
      to one of its own headings, clicking that scrolls the frame instead of
      opening anything.
- [ ] **Console is free of CSP reports.** Open the browser devtools console
      before loading the page. No `Content-Security-Policy` violation
      messages appear for the top document or either `srcDoc` iframe
      (`PoemPreview`'s and `SharedPoemView`'s) while doing the checks above.
- [ ] **Share page repeats the above.** Save the same poem, open its
      `/share/<id>` page, and repeat the styling, toggle and embed checks —
      `SharedPoemView` carries its own CSP (a `<meta>` tag, additive to the
      inherited header) and its own `srcDoc`, so it can fail independently of
      the editor preview.

Record in the pull request description which of these you ran and what you
saw — "verified by inspection" with no detail is what let both incidents
above ship with green CI.

TD-PPpfid-26072602 chose this checklist over an automated browser-level
smoke test (Playwright against a live CSP header needs a live Supabase
instance to cover the share page, which wasn't available when this was
written); file a new tech-debt item if that automation becomes practical —
until then, this is the gate.
