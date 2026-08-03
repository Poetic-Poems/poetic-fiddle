import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
  // a flaky-then-green run keeps its evidence (TD-PPpfid-26080304).
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
      // Same placeholder values vitest.config.ts inlines for the unit
      // suite — src/lib/supabase-client.ts throws at import time without
      // them, and no real project is needed to render the signed-out pages
      // this suite scans.
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
