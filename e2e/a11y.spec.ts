import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Real-browser counterpart to src/components/Editor.a11y.test.tsx and
// PoemsDashboard.a11y.test.tsx: same pages, same jest-axe default rule set,
// but run against a real Chromium paint so axe-core's color-contrast rule
// actually executes (TD-PPpfid-26080109). The "signed out" entries below
// need no backend at all; the "signed in" ones need the fixture poet and
// poem scripts/seed-e2e.mjs seeds into a local Supabase instance (issue
// #551) — `npm run test:a11y` runs that first, so `E2E_*` is set by the
// time this file loads (see playwright.config.ts). Run via plain
// `playwright test` without seeding first, those entries skip themselves
// rather than fail.
const e2eUserEmail = process.env.E2E_USER_EMAIL;
const e2eUserPassword = process.env.E2E_USER_PASSWORD;
const e2ePoemTitle = process.env.E2E_POEM_TITLE;
const e2eShareId = process.env.E2E_SHARE_ID;
const e2eFixturesReady = Boolean(
  e2eUserEmail && e2eUserPassword && e2ePoemTitle && e2eShareId,
);
const E2E_FIXTURES_SKIP_REASON =
  "e2e/.env.e2e not found — run `npm run test:a11y` (which seeds it via scripts/seed-e2e.mjs) rather than `playwright test` directly.";

const PAGES: {
  name: string;
  path: string;
  state: "signed out" | "signed in";
  waitForReady: (page: Page) => Promise<unknown>;
  axeOptions?: Record<string, unknown>;
  legacyMode?: boolean;
  requiresFixtures?: boolean;
}[] = [
  {
    name: "editor",
    path: "/",
    state: "signed out",
    waitForReady: (page) =>
      page.getByRole("textbox", { name: "Your poem" }).waitFor(),
    // Matches Editor.a11y.test.tsx: the preview pane's iframe is
    // script-sandboxed (PoemPreview.tsx's `sandbox="allow-same-origin"`), so
    // axe-core can't run inside it. It has its own accessible title; this
    // scan covers the editor chrome around it.
    axeOptions: { iframes: false },
    // AxeBuilder's default frame-aggregation technique opens a new browser
    // window/context to collect results; with the sandboxed, script-less
    // preview iframe present that fails with a
    // "browserContext.newPage: Protocol error (Target.createTarget)" — the
    // exact scenario axe-core-npm's error-handling.md documents legacy mode
    // for. iframes:false already excludes the preview from analysis, so
    // legacy mode's cross-origin-frame limitation costs nothing here.
    legacyMode: true,
  },
  {
    name: "poems dashboard",
    path: "/poems",
    state: "signed out",
    waitForReady: (page) =>
      page.getByText("Sign in to see your saved poems.").waitFor(),
  },
  {
    name: "shared poem",
    path: `/share/${e2eShareId ?? ""}`,
    state: "signed out",
    requiresFixtures: true,
    waitForReady: (page) =>
      page.getByRole("heading", { name: e2ePoemTitle ?? "" }).waitFor(),
  },
  {
    name: "poems dashboard",
    path: "/",
    state: "signed in",
    requiresFixtures: true,
    // Signs in through the real email/password form (SignInPrompt.tsx) as
    // the fixture poet scripts/seed-e2e.mjs seeded, then navigates to the
    // dashboard and opens the "Danger zone" delete-account confirmation
    // (AccountDangerZone.tsx) — never submitted, just scanned open —
    // alongside the fixture poem's own row.
    waitForReady: async (page) => {
      await page.getByRole("textbox", { name: "Your poem" }).waitFor();
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByText("Use a password instead").click();
      await page.getByLabel("Email").fill(e2eUserEmail ?? "");
      await page.getByLabel("Password").fill(e2eUserPassword ?? "");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByText(e2eUserEmail ?? "").waitFor();

      await page.getByRole("link", { name: "My poems" }).click();
      await page.getByText(e2ePoemTitle ?? "").waitFor();
      await page.getByRole("button", { name: "Delete account" }).click();
      await page
        .getByRole("heading", { name: "Delete your account?" })
        .waitFor();
    },
  },
];

for (const {
  name,
  path,
  state,
  waitForReady,
  axeOptions,
  legacyMode,
  requiresFixtures,
} of PAGES) {
  test(`${name} (${state}) has no automatically detectable accessibility violations`, async ({
    page,
  }) => {
    test.skip(
      Boolean(requiresFixtures) && !e2eFixturesReady,
      E2E_FIXTURES_SKIP_REASON,
    );

    // The webServer's placeholder Supabase URL (playwright.config.ts) isn't a
    // real project, so issue #422's health probe would otherwise resolve
    // "unavailable" and replace these pages' signed-out state with the
    // backend-unavailable banner — a state the jsdom suites
    // (Editor.backend-unavailable.test.tsx, PoemsDashboard.test.tsx) already
    // cover. Answer it healthy so this suite keeps scanning the same
    // signed-out pages it always has; harmless once a real, healthy local
    // instance is seeded (scripts/seed-e2e.mjs), which answers the same way.
    await page.route("**/auth/v1/health", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.goto(path);
    await waitForReady(page);

    const builder = new AxeBuilder({ page });
    if (axeOptions) builder.options(axeOptions);
    if (legacyMode) builder.setLegacyMode();

    const results = await builder.analyze();

    // The whole point of this suite: under jsdom, `color-contrast` doesn't
    // report at all — not as a pass, a violation or an incomplete — so a
    // green run there says nothing about contrast (TD-PPpfid-26080109).
    // Assert the rule actually reported something here, so this suite can't
    // regress into the same silent no-op if a future option (an `exclude`, a
    // `disableRules`, a page that renders no text) stops it running.
    const contrastResults = [
      ...results.passes,
      ...results.violations,
      ...results.incomplete,
    ].filter((result) => result.id === "color-contrast");
    expect(
      contrastResults,
      "axe-core's color-contrast rule reported no results — it did not run",
    ).not.toEqual([]);

    expect(results.violations).toEqual([]);
  });
}
