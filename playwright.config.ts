import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// scripts/seed-e2e.mjs (run by `npm run test:a11y`, issue #551) writes this
// file with the local Supabase instance it just seeded — its own URL/anon
// key, and the fixture poet/poem's identifiers the specs sign in as and
// scan. Loaded here, not via a dotenv dependency, so both this config's
// `webServer.env` below and the spec files (which inherit this process's
// env once Playwright forks their worker processes) see the same values.
// Absent entirely if the suite is ever run without seeding first — the
// placeholder fallbacks below keep the two original signed-out pages
// working exactly as before in that case.
const E2E_ENV_PATH = join(__dirname, "e2e", ".env.e2e");
if (existsSync(E2E_ENV_PATH)) {
  for (const line of readFileSync(E2E_ENV_PATH, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
}

// Real-browser a11y coverage (TD-PPpfid-26080109): axe-core's color-contrast
// rule needs actual layout/paint, which Vitest's jsdom environment doesn't
// have (src/components/*.a11y.test.tsx cover the checks that don't). This
// runs against a production build (next build && next start) rather than
// next dev, since dev-mode HMR scaffolding and error overlays aren't what
// poets see.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // "github" annotates the Actions log but writes nothing to disk, so it
  // leaves ci.yml's "Upload Playwright report" step nothing to archive.
  // "html" writes the self-contained playwright-report/ that step uploads on
  // every run — per-attempt error context and the retry's trace included, so
  // a flaky-then-green run keeps its evidence (TD-PPpfid-26080304). The
  // artifact is named per attempt (playwright-report-${{ github.run_attempt }})
  // to preserve evidence when a job is re-run via GitHub's "Re-run failed jobs"
  // button, keeping earlier attempts' reports accessible (TD-PPpfid-26080305).
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium-light",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "chromium-dark",
      use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
    },
  ],
  webServer: {
    command: "npm run build && npm run start -- --port " + PORT,
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // The seeded local instance's own values when present (see
      // E2E_ENV_PATH above); otherwise the same placeholder values
      // vitest.config.ts inlines for the unit suite —
      // src/lib/supabase-client.ts throws at import time without them, and
      // no real project is needed to render the two original signed-out
      // pages this suite scans.
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key",
    },
  },
});
