# poetic-fiddle
A user-friendly interface to the Poetic poem-authoring framework.

## Environment & secrets

The app reads its configuration from environment variables. `.env.example`
lists every variable the app expects, with comments on which are public and
which are server-only secrets — it is the contract to code against and holds
no real values.

- **Local development:** copy `.env.example` to `.env.local` (git-ignored) and
  fill in real values. You can either use a live Supabase cloud project
  (described below), or run a fully local dev database with `supabase start`.
- **Local-only Supabase (zero-cloud dev loop):** run `supabase start` to spin
  up a local Postgres database with migrations applied. `supabase start` prints
  the local Supabase URL and anon key to your terminal — copy these into
  `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  then `npm run dev`. This dev loop is fully local and does not require a live
  Supabase account.
- **Cloud Supabase project (for testing against production schema):** fill in
  `.env.local` from your project's Supabase dashboard (Project Settings → API).
  Do this before running `npm run dev` — without it, the editor pane fails to
  load in the browser (an on-screen message explains what to do).
- **Deployed app (Vercel):** set the same variables under the project's
  Environment Variables, scoped per environment. Keep the service-role key as
  a server-only secret; never expose it to the browser.

Variables prefixed `NEXT_PUBLIC_` are inlined into the browser bundle at build
time, so only values designed to be public — the Supabase URL and anon key,
guarded by Row-Level Security — may use that prefix. Server-only secrets (such
as the service-role key) must not.

**CI (GitHub Actions):** `.github/workflows/ci.yml`'s `deploy` job
pushes `supabase/migrations/` to the live project on every merge to `main`
that touches them,
authenticating with two repo secrets (Settings → Secrets and variables →
Actions): `SUPABASE_ACCESS_TOKEN` (Supabase dashboard → Account → Access
Tokens) and `SUPABASE_DB_PASSWORD` (Project Settings → Database).

## Development

Requires Node.js 22.x. Install dependencies with `npm install`, then:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the dev server at `http://localhost:3000` |
| `npm start` | Start the production server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Vitest |
| `npm run test:watch` | Vitest in watch mode |
| `npm run coverage` | Vitest with coverage reporting |
| `npm run test:db` | pgTAP database layer tests |

## Troubleshooting

### WSL npm-shadowing issue

On Windows Subsystem for Linux (WSL), the system PATH often includes Windows npm and node binaries before Linux-installed ones. This can cause build commands to silently fail when they rely on Linux-specific paths. If you encounter path-related errors during `npm run build` or other commands on WSL, use the `scripts/setup-linux.sh` wrapper:

```bash
./scripts/setup-linux.sh npm run build
./scripts/setup-linux.sh npm run dev
```

This wrapper activates nvm (if installed) before executing your command, ensuring the correct Linux Node.js is used. On macOS or native Linux installs, it is a transparent pass-through.
