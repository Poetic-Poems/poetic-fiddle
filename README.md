# poetic-fiddle
A user-friendly interface to the Poetic poem-authoring framework.

## Development

Requires Node.js >=20.9. Copy `.env.example` to `.env.local` and fill in the
Supabase project's anon key (Project Settings → API in the Supabase
dashboard). Install dependencies with `npm install`, then:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the dev server at `http://localhost:3000` |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Vitest |
