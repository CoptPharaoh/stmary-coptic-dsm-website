import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
const require = createRequire(
  (process.argv[2] || process.cwd() + "/node_modules") + "/package.json",
);
const { chromium } = require("playwright");
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:4176";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw Error("Local preview only.");
const output = "/tmp/stmary-admin-review";
await mkdir(output, { recursive: true });
const adapter = await readFile(
  new URL("./fixtures/admin-client.js", import.meta.url),
  "utf8",
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
async function open(mode = "owner", width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    timezoneId: "America/Los_Angeles",
  });
  await context.route("**/js/supabase-client.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: adapter }),
  );
  await context.route("**/*.supabase.co/**", (route) => {
    throw Error("Unexpected hosted request: " + route.request().url());
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${origin}/admin/index.html?fixture=${mode}`);
  await page.waitForFunction(
    () => !document.querySelector("#status").textContent.startsWith("Checking"),
  );
  if (!["anonymous", "mfa"].includes(mode))
    await page.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.includes("Overview refreshed"),
    );
  return { page, context };
}
async function navigate(page, view) {
  if (
    (await page.locator("#sidebar-toggle").isVisible()) &&
    !(await page.locator("#sidebar").isVisible())
  )
    await page.locator("#sidebar-toggle").click();
  await page.locator(`[data-view="${view}"]`).click();
  await page.waitForFunction(() =>
    /loaded|refreshed|unavailable|failure/.test(
      document.querySelector("#status").textContent,
    ),
  );
}
async function noOverflow(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `Horizontal overflow at ${page.viewportSize().width}`,
  );
  assert.ok(
    await page
      .locator(".icon")
      .evaluateAll((els) =>
        els.every((el) => el.getBoundingClientRect().width <= 18),
      ),
  );
}
try {
  for (const width of [1440, 1024, 768, 390, 320]) {
    const { page, context } = await open("owner", width);
    await noOverflow(page);
    assert.deepEqual(await page.locator(".metric-value").allTextContents(), [
      "1",
      "1",
      "1",
      "5",
    ]);
    await page.screenshot({
      path: `${output}/overview-${width}.png`,
      fullPage: true,
    });
    await navigate(page, "announcements");
    assert.equal(await page.locator("#records article").count(), 2);
    await noOverflow(page);
    await page.screenshot({
      path: `${output}/announcements-${width}.png`,
      fullPage: true,
    });
    await page.locator("#new-record").click();
    await page.locator("#editor [name=title]").fill("Fixture draft");
    await page
      .locator("#editor [name=body]")
      .fill("<img src=x onerror=alert(1)>");
    await page.locator("#editor details summary").click();
    await page.locator("[name=title_ar]").fill("عنوان عربي");
    await page.locator("[name=body_ar]").fill("محتوى عربي");
    await page.locator("#preview-button").click();
    assert.equal(await page.locator("#preview-content img").count(), 0);
    assert.equal(await page.locator("#preview-content [dir=rtl]").count(), 1);
    await noOverflow(page);
    await page.screenshot({
      path: `${output}/editor-${width}.png`,
      fullPage: true,
    });
    await page.locator("#save-record").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#status").textContent ===
        "Changes saved successfully.",
    );
    let writes = await page.evaluate(() => window.__writes);
    assert.equal(writes.at(-1).payload.status, "draft");
    assert.equal(writes.at(-1).payload.title_ar, "عنوان عربي");
    await navigate(page, "events");
    await page.locator("#new-record").click();
    await page.locator("#editor [name=title]").fill("Summer fixture");
    await page.locator("[name=start_at]").fill("2027-07-04T08:00");
    await page.locator("#save-record").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#status").textContent ===
        "Changes saved successfully.",
    );
    writes = await page.evaluate(() => window.__writes);
    assert.equal(writes.at(-1).payload.start_at, "2027-07-04T13:00:00.000Z");
    assert.equal(writes.at(-1).payload.end_at, null);
    await navigate(page, "services");
    assert.equal(await page.locator("#series-list article").count(), 5);
    await noOverflow(page);
    await page.screenshot({
      path: `${output}/services-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Edit series", exact: true })
      .first()
      .click();
    await page
      .locator("#series-form [name=title]")
      .fill("Sunday Divine Liturgy");
    await page.getByRole("button", { name: "Save entire series" }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("#status").textContent ===
        "Weekly series saved.",
    );
    await page.getByRole("button", { name: "Change one date" }).first().click();
    await page.locator("[name=original_date]").fill("2026-12-06");
    await page.locator("[name=reason]").fill("Fixture cancellation");
    await page.getByRole("button", { name: "Save occurrence change" }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("#status").textContent ===
        "Occurrence change saved.",
    );
    writes = await page.evaluate(() => window.__writes);
    assert.equal(writes.at(-1).payload.cancelled, true);
    assert.equal(writes.at(-1).payload.replacement_end, null);
    await page.locator("#logout").click();
    assert.equal(await page.locator("#workspace").isVisible(), false);
    assert.equal(await page.locator("#records").textContent(), "");
    assert.equal(await page.locator("#user-email").textContent(), "");
    await context.close();
    console.log(
      `PASS owner dashboard, CRUD fixture forms, safe preview, Central Time, schedule changes, sign-out and layout ${width}px`,
    );
  }
  for (const mode of ["servant", "empty", "error", "mfa", "anonymous"]) {
    const { page, context } = await open(mode, 390);
    if (mode === "servant") {
      assert.equal(await page.locator("[data-view=events]").isVisible(), false);
      assert.match(
        await page.locator("#activity-list").textContent(),
        /requires/,
      );
      await navigate(page, "announcements");
      assert.equal(await page.locator("#records article").count(), 1);
      await page.locator("#new-record").click();
      assert.equal(await page.locator("[name=ministry_id] option").count(), 1);
      assert.equal(await page.locator("#publish-now").isVisible(), false);
      await page.locator("#editor [name=title]").fill("Scoped draft");
      await page.locator("#save-record").click();
      await page.waitForFunction(() => window.__writes.length === 1);
      assert.equal(
        await page.evaluate(() => window.__writes[0].payload.ministry_id),
        "youth",
      );
    }
    if (mode === "empty")
      assert.deepEqual(await page.locator(".metric-value").allTextContents(), [
        "0",
        "0",
        "0",
        "0",
      ]);
    if (mode === "error")
      assert.match(await page.locator("#metrics").textContent(), /Unavailable/);
    if (["mfa", "anonymous"].includes(mode)) {
      assert.equal(await page.locator("#workspace").isVisible(), false);
      assert.equal(await page.locator("#records").textContent(), "");
      assert.ok(
        (await page.evaluate(() => window.__reads)).every(
          (t) => t === "admin_accounts",
        ),
      );
    }
    if (mode === "mfa") {
      await page.locator("#mfa-code").fill("000000");
      await page.locator("#verify").click();
      await page.waitForFunction(
        () =>
          document.querySelector("#status").textContent === "Invalid test code",
      );
      assert.equal(await page.locator("#mfa-panel").isVisible(), true);
      await page.evaluate(() => {
        window.__mfaVerified = true;
      });
      await page.locator("#mfa-code").fill("123456");
      await page.locator("#verify").click();
      await page.waitForFunction(() =>
        document
          .querySelector("#status")
          .textContent.includes("Overview refreshed"),
      );
      assert.equal(await page.locator("#workspace").isVisible(), true);
    }
    await noOverflow(page);
    await page.screenshot({
      path: `${output}/${mode}-390.png`,
      fullPage: true,
    });
    await context.close();
    console.log(`PASS ${mode} state`);
  }
  const { page, context } = await open();
  await navigate(page, "announcements");
  await page.locator("#status-filter").selectOption("draft");
  await page.waitForFunction(
    () => document.querySelectorAll("#records article").length === 1,
  );
  assert.match(await page.locator("#records").textContent(), /Youth service/);
  await page.locator("#search").fill("no matches");
  await page.waitForFunction(() =>
    document.querySelector("#records").textContent.includes("No matching"),
  );
  await page.locator("#search").fill("");
  await page.waitForFunction(
    () => document.querySelectorAll("#records article").length === 1,
  );
  await page.locator("#records button").click();
  await page.locator("#publish-now").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#status").textContent ===
      "Changes saved successfully.",
  );
  assert.equal(
    await page.evaluate(() => window.__writes.at(-1).payload.status),
    "published",
  );
  await page.locator("#status-filter").selectOption("published");
  await page.waitForFunction(() =>
    document.querySelector("#records").textContent.includes("Parish family"),
  );
  await page.locator("#records button").click();
  await page.locator("#editor [name=status]").selectOption("archived");
  await page.locator("#save-record").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#status").textContent ===
      "Changes saved successfully.",
  );
  assert.equal(
    await page.evaluate(() => window.__writes.at(-1).payload.status),
    "archived",
  );
  await page.locator("#new-record").click();
  await page.locator("#editor [name=title]").fill("Denied fixture");
  await page.evaluate(() => {
    window.__denySave = true;
  });
  await page.locator("#save-record").click();
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("Permission denied"),
  );
  assert.equal(await page.locator("#editor-panel").isVisible(), true);
  await page.evaluate(() => {
    window.__denySave = false;
  });
  await page.locator("#close-editor").click();
  await navigate(page, "events");
  await page.locator("#records button").click();
  assert.equal(
    await page.locator("[name=start_at]").inputValue(),
    "2027-07-04T08:00",
  );
  await page.locator("[name=location]").fill("Fixture new location");
  await page.locator("#save-record").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#status").textContent ===
      "Changes saved successfully.",
  );
  assert.equal(
    await page.evaluate(() => window.__writes.at(-1).payload.start_at),
    "2027-07-04T13:00:00Z",
  );
  await navigate(page, "services");
  await page.getByRole("button", { name: "Change one date" }).first().click();
  await page.locator("[name=original_date]").fill("2026-12-06");
  await page.locator("[name=action]").selectOption("modify");
  await page.locator("[name=replacement_date]").fill("2026-12-07");
  await page.locator("[name=replacement_start]").fill("09:00");
  await page.locator("[name=reason]").fill("Reschedule fixture");
  await page.getByRole("button", { name: "Save occurrence change" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#status").textContent ===
      "Occurrence change saved.",
  );
  assert.equal(
    await page.evaluate(() => window.__writes.at(-1).payload.cancelled),
    false,
  );
  assert.equal(
    await page.evaluate(() => window.__writes.at(-1).payload.replacement_end),
    null,
  );
  console.log(
    "PASS filters/search, immediate publication, archive, permission-denied save, existing event roundtrip and single-date rescheduling",
  );
  await page.evaluate(() => {
    window.__delay = 500;
  });
  await navigate(page, "announcements");
  await page.evaluate(() => {
    document.querySelector("#refresh").click();
    window.__authEvent("SIGNED_OUT");
  });
  await page.waitForTimeout(800);
  assert.equal(await page.locator("#records").textContent(), "");
  assert.equal(await page.locator("#workspace").isVisible(), false);
  await context.close();
  console.log(
    "PASS delayed private response cannot repopulate after session termination",
  );
  const pagination = await open("many");
  await navigate(pagination.page, "announcements");
  assert.equal(await pagination.page.locator("#records article").count(), 25);
  await pagination.page.locator("#next-page").click();
  await pagination.page.waitForFunction(() =>
    document.querySelector("#page-label").textContent.includes("Page 2"),
  );
  assert.equal(await pagination.page.locator("#records article").count(), 5);
  assert.equal(await pagination.page.locator("#next-page").isDisabled(), true);
  await pagination.page.locator("#previous-page").click();
  await pagination.page.waitForFunction(() =>
    document.querySelector("#page-label").textContent.includes("Page 1"),
  );
  await pagination.page.evaluate(() => {
    window.__delay = 100;
    window.__authEvent("SIGNED_IN", {
      user: { id: "second-fixture-user", email: "second@example.invalid" },
    });
  });
  assert.equal(await pagination.page.locator("#workspace").isVisible(), false);
  assert.equal(await pagination.page.locator("#records").textContent(), "");
  await pagination.page.waitForFunction(() =>
    document
      .querySelector("#status")
      .textContent.includes("Overview refreshed"),
  );
  assert.equal(
    await pagination.page.locator("#user-email").textContent(),
    "second@example.invalid",
  );
  await pagination.page.evaluate(() => window.__authEvent("TOKEN_REFRESHED"));
  assert.equal(await pagination.page.locator("#workspace").isVisible(), false);
  await pagination.page.waitForFunction(() =>
    document
      .querySelector("#status")
      .textContent.includes("Overview refreshed"),
  );
  await pagination.context.close();
  console.log("PASS server-backed pagination beyond the first 25 records");
  console.log(
    "PASS cross-account sign-in and token refresh clear private state and reauthorize",
  );
  assert.deepEqual(errors, []);
  console.log("PASS no browser JavaScript errors. Screenshots: " + output);
} finally {
  await browser.close();
}
