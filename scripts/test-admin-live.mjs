// Actual locally served, signed-out portal. No auth mocking, credentials or writes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const require = createRequire(
  (process.argv[2] || process.cwd() + "/node_modules") + "/package.json",
);
const { chromium } = require("playwright");
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:4176";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw Error("Local preview only.");
await mkdir("/tmp/stmary-admin-review", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext();
  // No stored session and no mutations are permitted in this live startup check.
  await context.route("**/*.supabase.co/**", (route) =>
    route.request().method() === "GET" ? route.continue() : route.abort(),
  );
  const page = await context.newPage(),
    errors = [],
    missing = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400)
      missing.push(response.url());
  });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + "/admin/index.html");
    await page.waitForFunction(
      () => document.querySelector("#status").textContent.startsWith("Ready."),
      {},
      { timeout: 40000 },
    );
    assert.equal(await page.locator("#login").isVisible(), true);
    assert.equal(await page.locator("#workspace").isVisible(), false);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/stmary-admin-review/live-signin-${width}.png`,
      fullPage: true,
    });
    console.log(
      `PASS real signed-out initialization and local assets at ${width}px`,
    );
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  await context.close();
} finally {
  await browser.close();
}
