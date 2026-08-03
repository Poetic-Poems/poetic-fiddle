import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Real-browser counterpart to src/components/Editor.a11y.test.tsx and
// PoemsDashboard.a11y.test.tsx: same pages, same jest-axe default rule set,
// but run against a real Chromium paint so axe-core's color-contrast rule
// actually executes (TD-PPpfid-26080109). Only the signed-out states are
// reachable without a live Supabase project; the signed-in structural checks
// (labels, roles, aria attributes) stay covered by the jsdom suites.
const PAGES: {
  name: string;
  path: string;
  waitForReady: (page: Page) => Promise<unknown>;
  axeOptions?: Record<string, unknown>;
  legacyMode?: boolean;
}[] = [
  {
    name: "editor",
    path: "/",
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
    waitForReady: (page) =>
      page.getByText("Sign in to see your saved poems.").waitFor(),
  },
];

for (const { name, path, waitForReady, axeOptions, legacyMode } of PAGES) {
  test(`${name} (signed out) has no automatically detectable accessibility violations`, async ({
    page,
  }) => {
    await page.goto(path);
    await waitForReady(page);

    const builder = new AxeBuilder({ page });
    if (axeOptions) builder.options(axeOptions);
    if (legacyMode) builder.setLegacyMode();

    const results = await builder.analyze();
    expect(results.violations).toEqual([]);
  });
}
