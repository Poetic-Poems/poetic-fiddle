/**
 * Hosts poetic's builtin song handlers can point an embed at (see poetic's
 * `src/song-handlers.yaml`). Fiddle passes no `config.song_handlers` to
 * `renderPoem` (there is no `.poetic-config.yaml` UI), so every
 * `data-embed-src` this module ever sees is built from one of these two
 * fixed URL templates — a poet's audio value can only fill the *path*, never
 * the origin.
 *
 * Single source of truth for the three places this allow-list is enforced:
 * - `render-share.ts`'s sanitiser gate, which decides whether an embed
 *   activates into a real iframe at all (AC86's app-level check).
 * - `SharedPoemView.tsx`'s srcdoc `frame-src`, a second, browser-enforced
 *   restatement of the same list (deliberate defence-in-depth, AC86).
 * - `csp.ts`'s site-wide `frame-src`, the top-level policy the srcdoc
 *   iframe inherits in addition to its own `<meta>` CSP.
 * All three are derived from `EMBED_HOSTS` below so the sanitiser and both
 * CSPs can never drift apart: a host missing from one silently blocks that
 * service's embeds, while a host present in a `frame-src` but not the
 * sanitiser is a dormant allowance waiting for the sanitiser to catch up.
 */
export const EMBED_HOSTS = ["mega.nz", "audiomack.com"] as const;

/** The sanitiser's activation gate — `render-share.ts`. */
export const EMBED_ALLOWED_HOSTS: ReadonlySet<string> = new Set(EMBED_HOSTS);

/** A space-joined `https://` origin list for a CSP `frame-src` directive. */
export const EMBED_FRAME_SRC = EMBED_HOSTS.map(
  (host) => `https://${host}`,
).join(" ");
