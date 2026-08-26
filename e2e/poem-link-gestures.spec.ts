import { test, expect } from "@playwright/test";

// Real-browser counterpart to the sandbox fall-through cases in
// src/lib/poem-toggles.test.ts (TD-PPpfid-26081401): those exercise
// wirePoemToggles directly against a jsdom-driven iframe, but jsdom does not
// implement HTML5 sandboxing at all, so it can't tell us whether a real
// sandboxed frame actually lets a gesture fall through to native browser
// handling the way `canFallThroughSandbox`'s `allow-popups` check assumes.
// This runs against `/`, whose editor renders EXAMPLE_POEM (with its
// "syntax reference" Markdown link) inside `PoemPreview`'s
// `sandbox="allow-same-origin"` iframe — the signed-out route
// e2e/a11y.spec.ts already proves is reachable without a live Supabase
// project.
//
// `SharedPoemView`'s `sandbox="allow-scripts allow-same-origin
// allow-popups"` frame — the other half of the decision rule, where a
// modified/auxiliary gesture is expected to fall through untouched — lives
// at `/share/<id>`, which needs a live Supabase project this suite can't
// reach. That branch is covered by the unit suite
// (src/lib/poem-toggles.test.ts) only.
test.describe("preview link gestures", () => {
  test("middle-click opens exactly one new tab and does not renavigate the preview frame", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Your poem" }).waitFor();

    const previewFrameElement = page.locator('iframe[title="Poem preview"]');
    const frame = page.frameLocator('iframe[title="Poem preview"]');

    // The postscript link this test clicks may sit inside poetic's
    // clamp-and-reveal preview (poem-toggles.ts's evaluatePostscriptPreviews);
    // expand it first where present so the click lands on a genuinely
    // visible element rather than one clipped by max-height.
    const postscriptToggle = frame.locator(".postscript-toggle");
    if (await postscriptToggle.isVisible().catch(() => false)) {
      await postscriptToggle.click();
    }

    const link = frame.getByRole("link", { name: "syntax reference" });
    await link.waitFor();

    const frameUrlBefore = await previewFrameElement.evaluate(
      (el: HTMLIFrameElement) => el.contentWindow?.location.href,
    );
    const pagesBefore = context.pages().length;

    const popupPromise = context.waitForEvent("page");
    await link.click({ button: "middle" });
    const popup = await popupPromise;
    await popup.waitForLoadState();

    expect(context.pages().length).toBe(pagesBefore + 1);

    const frameUrlAfter = await previewFrameElement.evaluate(
      (el: HTMLIFrameElement) => el.contentWindow?.location.href,
    );
    expect(frameUrlAfter).toBe(frameUrlBefore);

    await popup.close();
  });

  test("Ctrl/Cmd+click opens exactly one new tab under an allow-same-origin sandbox with no allow-popups", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Your poem" }).waitFor();

    const frame = page.frameLocator('iframe[title="Poem preview"]');

    const postscriptToggle = frame.locator(".postscript-toggle");
    if (await postscriptToggle.isVisible().catch(() => false)) {
      await postscriptToggle.click();
    }

    const link = frame.getByRole("link", { name: "syntax reference" });
    await link.waitFor();

    const pagesBefore = context.pages().length;

    // `PoemPreview`'s sandbox grants no `allow-popups`, so
    // canFallThroughSandbox(doc) is false here and the modified click is
    // intercepted exactly like a plain left-click — proving the gesture
    // isn't silently swallowed by the sandbox rather than opening a tab.
    const popupPromise = context.waitForEvent("page");
    await link.click({ modifiers: ["ControlOrMeta"] });
    const popup = await popupPromise;
    await popup.waitForLoadState();

    expect(context.pages().length).toBe(pagesBefore + 1);

    await popup.close();
  });

  // Real-browser counterpart to the "gesture gate on non-link controls" unit
  // suite (src/lib/poem-toggles.test.ts, TD-PPpfid-26081401's review round):
  // the postscript toggle is not a link, so it has no native "open in a new
  // tab" behaviour for a middle-click to defer to — unlike the link test
  // above, a middle-click here must have no effect at all.
  test("middle-click on the postscript toggle does not expand it or open a tab", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Your poem" }).waitFor();

    const frame = page.frameLocator('iframe[title="Poem preview"]');
    const postscriptToggle = frame.locator(".postscript-toggle");

    test.skip(
      !(await postscriptToggle.isVisible().catch(() => false)),
      "EXAMPLE_POEM's postscript isn't clamped at this viewport, so there's no toggle to middle-click",
    );

    const pagesBefore = context.pages().length;

    await postscriptToggle.click({ button: "middle" });

    expect(context.pages().length).toBe(pagesBefore);
    await expect(postscriptToggle).toHaveAttribute("aria-expanded", "false");
  });
});
