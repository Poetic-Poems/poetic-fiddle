# Sentry access for local agents (MCP)

How the local AI agents — both the **VS Code‑hosted** agent and the **autonomous**
(headless, same‑machine) agents — read this project's Sentry data. This is about
*agent read access to Sentry*, not about the app's own instrumentation (for that,
see [OBSERVABILITY-PLAN.md](OBSERVABILITY-PLAN.md)).

## Summary

| Thing | Value |
| --- | --- |
| MCP server name | `sentry-headless` |
| Transport | `stdio`, launched via `npx -y @sentry/mcp-server` |
| Config scope | **user** (global) — top‑level `mcpServers` in `~/.claude.json` |
| Credential | a Sentry **Internal Integration** token (org‑owned, read‑only) |
| Token scopes | `event:read`, `org:read`, `project:read` |
| Organisation slug | `datum-process` |
| Project slug / id | `poetic-fiddle` / `4511756053250128` |

The token is stored as a **literal** in `~/.claude.json` (file mode `600`). A second
copy lives in the password safe. It is never committed to the repo.

## Why it is set up this way

- **Token, not OAuth.** The hosted OAuth server (`https://mcp.sentry.dev/mcp`) was
  trialled and removed. OAuth needs an interactive browser consent, so it cannot
  serve the **autonomous** agents (no browser, no interactive flow). A token works
  in every context, so a single token‑based server covers both. The redundant
  hosted `sentry` entry was removed from `.mcp.json` to avoid two competing Sentry
  servers.
- **User scope, not local.** `claude mcp add -s local` stores the server under the
  *current directory's* project key in `~/.claude.json`. Adding it from several
  directories silently created three separate, inconsistent copies. User scope is a
  single global entry that works from any directory, so both the VS Code agent
  (whatever its project root) and the autonomous agents (whatever their cwd) get it.
- **Literal in mode‑600 config, not encrypted.** A gpg‑encrypted file plus a shell
  wrapper was trialled and abandoned: it required a passphrase / pinentry at launch,
  and — critically — the wrapper only runs for **terminal** launches, so it never
  reached the VS Code extension (which spawns `claude` directly). Claude Code reads a
  literal config value directly at server launch in *every* context with no
  environment injection, so a literal in `~/.claude.json` (mode `600`) is the one
  approach that "just works" for both. The token is **read‑only and least‑privilege**,
  so a leak of that file means, at worst, someone can read our error data.

## Important behavioural quirk — pass the org slug explicitly

The token is an **Internal Integration** token. Its identity is a synthetic *proxy
user* (`…triage-readonly@proxy-user.sentry.io`) that is **not a member** of any
organisation. Consequences:

- `find_organizations()` returns an **empty list** — this is expected, not a fault.
- The global `/projects/` endpoint returns `401` for this token type.
- Agents **must pass the organisation slug explicitly**: `organizationSlug="datum-process"`
  (and, where useful, `projectSlugOrId="poetic-fiddle"`). Org‑scoped endpoints
  (`/organizations/datum-process/…`) work correctly.

So agents should **skip `find_organizations`** and call `find_projects` /
`search_issues` / `search_events` with `datum-process` directly.

## Verifying it works

Through the MCP server (from an agent):

```
find_projects(organizationSlug="datum-process")            # → poetic-fiddle
search_issues(organizationSlug="datum-process",
              projectSlugOrId="poetic-fiddle",
              query="is:unresolved", period="90d")
```

Directly against the API (status only, token never printed):

```bash
T=$(python3 -c "import json;print(json.load(open('$HOME/.claude.json'))['mcpServers']['sentry-headless']['env']['SENTRY_ACCESS_TOKEN'])")
curl -s -o /dev/null -w 'org projects: http=%{http_code}\n' \
  -H "Authorization: Bearer $T" \
  https://sentry.io/api/0/organizations/datum-process/projects/
unset T
```

`http=200` means the token is valid and org access works. (Note `GET /api/0/projects/`
returns `401` for this token type — use the org‑scoped path above instead.)

## Rotating / replacing the token

Mint a replacement in Sentry (**Settings → Developer Settings → Internal Integrations**),
keeping the same read‑only scopes, then:

```bash
claude mcp remove sentry-headless -s user
printf 'Paste NEW token, then Enter: '; IFS= read -rs T; echo
case "$T" in
  ''|'${'*) echo "ABORT: empty or placeholder — nothing added"; unset T ;;
  *)
    code=$(curl -s -o /dev/null -w '%{http_code}' \
      -H "Authorization: Bearer $T" \
      https://sentry.io/api/0/organizations/datum-process/projects/)
    echo "Sentry auth check: http=$code  (200 = good)"
    if [ "$code" = 200 ]; then
      claude mcp add sentry-headless -s user \
        -e SENTRY_ACCESS_TOKEN="$T" -- npx -y @sentry/mcp-server
      echo "Added user-scope sentry-headless."
    else
      echo "Token rejected ($code) — nothing added."
    fi
    unset T ;;
esac
```

Then **reload the VS Code window** (and restart any running autonomous agent) so
Claude Code re‑reads the config. `read -rs` keeps the token off the terminal and out
of shell history; the shell expands `"$T"` so Claude Code stores the **literal** value.

Notes:
- Use `-s user`, and run `claude mcp remove sentry-headless -s user` first, to avoid
  re‑introducing per‑directory duplicate entries.
- Never `cat`/`grep` and share `~/.claude.json` — the token is a literal in it.
- Update the copy in the password safe when you rotate.

## Current data state and limitations

**Agent read access is verified working.** The `sentry-headless` MCP server
reaches the `datum-process` org and the `poetic-fiddle` project, and
`search_issues` / `search_events` (both the `errors` and `logs` datasets)
return successfully.

**The app is correctly instrumented** (server/edge only): `Sentry.init()` runs
at startup via [`src/instrumentation.ts`](../src/instrumentation.ts), unhandled
request errors go through `onRequestError`, and the deliberately-swallowed
failures are captured by `reportSwallowedError`
([`src/lib/observability.ts`](../src/lib/observability.ts)). Nothing is sent
unless `SENTRY_DSN` is set for the **Production** environment in Vercel, and the
variable name must be **exactly** `SENTRY_DSN` — a `SENTRY_DNS` typo silently
disables all collection.

**End-to-end capture is confirmed with a live event.** The first real Sentry
issue (`POETIC-FIDDLE-1`, environment `vercel-production`) was the `/share/<id>`
500 — jsdom 27+ depends on the ESM-only `@exodus/bytes`, and Vercel `require()`s
jsdom rather than bundling it, so that CommonJS `require()` of an ESM module
threw `ERR_REQUIRE_ESM` under the Turbopack server build (the true root of issue
#52, now fixed by pinning jsdom to 26.x — see `CHANGELOG.md` / `TD26071901`).
Although it originated in a failed top-level `import` in
`src/lib/render-share.ts`, Turbopack externalises jsdom behind a **lazy** require
thunk that first runs _during_ a request, so it surfaced through
`onRequestError` (`mechanism: auto.function.nextjs.on_request_error`, `handled:
no`) and was captured — it also appeared in Vercel's runtime logs. This both
proves the instrumentation works against a live production error and stands as
the worked example in
[TRIAGE.md → What Sentry will not capture](TRIAGE.md#what-sentry-will-not-capture-and-where-to-look-instead)
of why the _stricter_ class — a throw that runs before any request handler —
would still escape.

Known limitations of the current implementation:

- **Errors before the request handler are not captured** — a throw at true
  module top-level (or process init), before any request runs, escapes both
  `onRequestError` and `reportSwallowedError`; read Vercel runtime logs for
  those. (A module-load throw that Turbopack defers into a request via a lazy
  external `require`, as in #52 above, _is_ captured.)
- **Server/edge only, by design** — there is no client SDK, so a browser-only
  error never reaches Sentry (AC84).
- **No source maps / release tagging** — `next.config.ts` does not wrap the
  config with `withSentryConfig`, so stack traces are not symbolicated and
  events carry no release. Functional capture does not depend on it.

See [OBSERVABILITY-PLAN.md](OBSERVABILITY-PLAN.md) for the wider plan.
