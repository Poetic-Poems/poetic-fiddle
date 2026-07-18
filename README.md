# poetic-fiddle
A user-friendly interface to the Poetic poem-authoring framework.

## Development

Requires Node.js >=20.9. Install dependencies with `npm install`, then:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the dev server at `http://localhost:3000` |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Vitest |

## Environment & secrets

The app reads its configuration from environment variables. `.env.example`
lists every variable the app expects, with comments on which are public and
which are server-only secrets — it is the contract to code against and holds
no real values.

- **Local development:** copy `.env.example` to `.env.local` (git-ignored) and
  fill in real values from the Supabase dashboard (Project Settings → API).
- **Deployed app (Vercel):** set the same variables under the project's
  Environment Variables, scoped per environment. Keep the service-role key as
  a server-only secret; never expose it to the browser.

Variables prefixed `NEXT_PUBLIC_` are inlined into the browser bundle at build
time, so only values designed to be public — the Supabase URL and anon key,
guarded by Row-Level Security — may use that prefix. Server-only secrets (such
as the service-role key) must not.

**CI (GitHub Actions):** `.github/workflows/database.yml`'s `deploy` job
pushes `supabase/migrations/` to the live project on every merge to `main`,
authenticating with two repo secrets (Settings → Secrets and variables →
Actions): `SUPABASE_ACCESS_TOKEN` (Supabase dashboard → Account → Access
Tokens) and `SUPABASE_DB_PASSWORD` (Project Settings → Database).
