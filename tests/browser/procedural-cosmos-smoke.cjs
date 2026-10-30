const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises");
const base = process.env.TEST_BASE_URL || "http://localhost:3161",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/procedural-cosmos";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Local fixture only");
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      (process.platform === "win32"
        ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
        : undefined),
  });
  const results = [];
  try {
    for (const config of [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "mobile", width: 390, height: 844 },
      { name: "small", width: 320, height: 740 },
      { name: "reduced", width: 1440, height: 1000, reduced: true },
      { name: "fallback", width: 1000, height: 800, fallback: true },
    ]) {
      const context = await browser.newContext({
        viewport: { width: config.width, height: config.height },
        ...(process.env.RECORD_COSMOS === "1" && config.name === "desktop"
          ? {
              recordVideo: {
                dir: out + "/motion",
                size: { width: 1280, height: 890 },
              },
            }
          : {}),
        hasTouch: config.width < 600,
        isMobile: config.width < 600,
        reducedMotion: config.reduced ? "reduce" : "no-preference",
      });
      if (config.fallback)
        await context.addInitScript(() => {
          const old = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (type, ...args) {
            return type === "2d" ? null : old.call(this, type, ...args);
          };
        });
      const page = await context.newPage(),
        errors = [],
        assets = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (/star-orbiting|\.jpg|\.png/i.test(r.url())) assets.push(r.url());
      });
      await page.route("**/api/**", (r) =>
        r.request().url().includes("/arrival-briefing")
          ? r.fulfill({
              json: { text: "Boletim privado de teste, sem painel na home." },
            })
          : r.fulfill({
              status: 401,
              json: { error: "Test session required" },
            }),
      );
      await page.goto(base, { waitUntil: "domcontentloaded" });
      await page
        .locator(
          '.procedural-cosmos[data-renderer="' +
            (config.fallback ? "fallback" : "canvas") +
            '"]',
        )
        .waitFor();
      if (!config.fallback) {
        const canvas = page.locator(".procedural-cosmos canvas");
        await page.waitForFunction(
          () =>
            !!document.querySelector(".procedural-cosmos canvas")?.dataset
              .motion,
        );
        const before = await canvas.getAttribute("data-frame");
        if (!config.reduced)
          await page.waitForFunction(
            (before) =>
              document.querySelector(".procedural-cosmos canvas")?.dataset
                .frame !== before,
            before,
            { timeout: 15000 },
          );
        else await page.waitForTimeout(450);
        const after = await canvas.getAttribute("data-frame");
        if (config.reduced) assert.equal(after, before);
        else assert.notEqual(after, before);
      }
      assert.equal(
        await page
          .locator(
            ".cosmic-reference,.cosmic-tools,.cosmic-systems,.gravity-navigation",
          )
          .count(),
        0,
      );
      assert.equal(
        await page
          .locator(".stage-header")
          .evaluate((el) => getComputedStyle(el).opacity),
        "1",
      );
      const menu = page.getByRole("button", { name: "Abrir navegação" });
      assert.equal(await menu.isVisible(), true);
      assert.equal((await menu.innerText()).trim(), "⋮");
      await menu.click();
      assert.equal(await page.getByRole("navigation", { name: "Áreas do Jarvis" }).isVisible(), true);
      await page.getByRole("button", { name: "Fechar navegação" }).click();
      assert.equal(await page.getByRole("navigation", { name: "Áreas do Jarvis" }).count(), 0);
      assert.equal(
        await page
          .locator(".interaction-dock")
          .evaluate((el) => getComputedStyle(el).opacity),
        "0",
      );
      assert.equal(
        await page.evaluate(
          () =>
            document.documentElement.scrollHeight <= innerHeight + 1 &&
            document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        true,
      );
      assert.deepEqual(assets, []);
      await page.mouse.move(1, config.height / 2);
      await page.screenshot({ path: out + "/" + config.name + ".png" });
      await page
        .getByRole("button", {
          name: "Abrir preferências do Jarvis",
          exact: true,
        })
        .focus();
      await page.keyboard.press("Enter");
      await page.locator('main[data-controls-open="true"]').waitFor();
      await page
        .getByRole("button", { name: "Ocultar preferências", exact: true })
        .click();
      await page.mouse.move(1, 200);
      await page.waitForTimeout(250);
      assert.equal(
        await page
          .locator(".interaction-dock")
          .evaluate((el) => getComputedStyle(el).opacity),
        "0",
      );
      assert.deepEqual(errors, []);
      results.push({
        scenario: config.name,
        procedural: true,
        noPhoto: true,
        noPermanentText: true,
        hiddenPreferences: true,
      });
      const recording = page.video();
      if (recording) await page.waitForTimeout(7000);
      await context.close();
      if (recording) await recording.saveAs(out + "/jarvis-procedural.webm");
    }
    await fs.writeFile(out + "/results.json", JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
