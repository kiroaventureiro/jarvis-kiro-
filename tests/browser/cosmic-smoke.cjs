const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/cosmic-browser";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Loopback mocks only");
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
  const pass = (name) => {
    results.push(name);
    console.log("PASS", name);
  };
  async function setup(options = {}) {
    const context = await browser.newContext({
      viewport: options.mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      hasTouch: !!options.mobile,
      isMobile: !!options.mobile,
      reducedMotion: options.reduced ? "reduce" : "no-preference",
    });
    await context.addInitScript(
      ({ volume, autoplay, blocked, history }) => {
        if (history)
          localStorage.setItem("jarvis_kiro_history_consent_v1", "yes");
        localStorage.setItem(
          "jarvis.voice.preferences.v1",
          JSON.stringify({
            version: 1,
            volume,
            rate: 1,
            pitch: 1,
            continuous: false,
          }),
        );
        Object.defineProperty(navigator, "userActivation", {
          configurable: true,
          value: { hasBeenActive: autoplay },
        });
        window.__spoken = [];
        window.__current = null;
        window.__cancels = 0;
        window.SpeechSynthesisUtterance = class {
          constructor(text) {
            this.text = text;
          }
        };
        const api = new EventTarget();
        api.paused = false;
        api.getVoices = () => [
          {
            voiceURI: "fixture-pt",
            name: "Fixture",
            lang: "pt-BR",
            localService: true,
            default: true,
          },
        ];
        api.cancel = () => {
          window.__cancels++;
          window.__current = null;
        };
        api.resume = () => {};
        api.speak = (u) => {
          if (blocked) throw Error("autoplay blocked fixture");
          window.__spoken.push(u.text);
          window.__current = u;
          u.onstart?.();
        };
        Object.defineProperty(window, "speechSynthesis", {
          configurable: true,
          value: api,
        });
        window.__end = () => {
          const u = window.__current;
          window.__current = null;
          u?.onend?.();
        };
      },
      {
        volume: options.volume ?? 1,
        autoplay: options.autoplay ?? false,
        blocked: !!options.blocked,
        history: !!options.history,
      },
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration|hydrated|didn.t match|server rendered|client rendered/i.test(
          message.text(),
        )
      )
        errors.push(message.text());
    });
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/director/arrival-briefing")
        return route.fulfill({
          status: options.failure || 200,
          json: options.failure
            ? { error: "fixture failure" }
            : {
                text: "Boletim de teste. Conectores sem verificação recente; não há números econômicos confirmados neste cenário.",
              },
        });
      if (url.pathname === "/api/director/abacus")
        return route.fulfill({
          json: {
            text: "Resposta de conversa simulada.",
            provider: "local_operational",
            model: "fixture",
            usage: null,
          },
        });
      return route.fulfill({
        status: 401,
        json: { error: "fixture session required" },
      });
    });
    await page.goto(base);
    await page.locator(".cosmic-scene, .jk-refined-core").first().waitFor();
    return { context, page, errors };
  }
  try {
    const { context, page, errors } = await setup();
    const unauthenticated = await context.request.get(
      base + "/api/director/arrival-briefing",
    );
    assert.equal(unauthenticated.status(), 401);
    assert.match(
      unauthenticated.headers()["cache-control"],
      /private.*no-store/,
    );
    await page.locator(".arrival-briefing.is-open").waitFor();
    // The approved reactive nucleus replaces the legacy photographic orbit.
    // Validate its real canvas and keep legacy-only pan/zoom expectations for old builds.
    if (await page.locator(".jk-refined-core").count()) {
      const core = page.locator(".jk-refined-core canvas");
      await core.waitFor();
      const pixels = await core.evaluate((element) => {
        const canvas = element;
        const ctx = canvas.getContext("2d");
        if (!ctx) return { width: 0, height: 0, painted: false };
        const p = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
        return { width: canvas.width, height: canvas.height, painted: p[3] > 0 };
      });
      assert.ok(pixels.width > 0 && pixels.height > 0 && pixels.painted, "Refined nucleus must render a nonempty canvas");
      assert.equal(await page.locator(".jk-refined-core").getAttribute("data-phase"), "idle");
      await page.screenshot({ path: out + "/desktop-refined.png" });
      pass("approved reactive nucleus renders on desktop without demo response data");
      assert.deepEqual(errors, []);
      await context.close();
      const mobile = await setup({ mobile: true, reduced: true });
      const canvasMobile = mobile.page.locator(".jk-refined-core canvas");
      await canvasMobile.waitFor();
      const dims = await canvasMobile.evaluate((el) => ({width:el.width,height:el.height}));
      assert.ok(dims.width > 0 && dims.height > 0);
      const size = await mobile.page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(size.scroll <= size.width + 1, "Responsive viewport must not overflow");
      await mobile.page.screenshot({ path: out + "/mobile-refined.png" });
      assert.deepEqual(mobile.errors, []);
      await mobile.context.close();
      pass("approved nucleus preserves mobile canvas sizing and no horizontal overflow");
      await fs.writeFile(out + "/results.json", JSON.stringify({ passed: results.length, scenarios: results }, null, 2));
      return;
    }
    const orbit = await page.locator(".cosmic-star").evaluate(el => {
      const animation = el.getAnimations()[0];
      if (!animation) throw Error("Idle orbit animation missing");
      animation.pause(); animation.currentTime = 5500;
      const upper = el.getBoundingClientRect().y;
      animation.currentTime = 16500;
      const lower = el.getBoundingClientRect().y;
      animation.currentTime = 0; animation.play();
      return { upper, lower };
    });
    assert.ok(orbit.lower > orbit.upper + 30, "The orbit must have distinct front/back arcs");
    assert.equal(await page.evaluate(() => window.__spoken.length), 0);
    assert.equal(
      await page.locator(".jk-core,.jk-base,.jk-emitter").count(),
      0,
    );
    assert.equal(
      await page
        .locator(".cosmic-reference")
        .evaluate((el) => el.complete && el.naturalWidth === 1024),
      true,
    );
    assert.equal(
      await page.locator(".arrival-actions details").evaluate((el) => el.open),
      false,
    );
    await page.screenshot({ path: out + "/desktop-home.png" });
    pass("original asset, clean home and autoplay gesture gate");
    await page
      .getByRole("button", { name: "Aproximar cena", exact: true })
      .click();
    assert.equal(
      await page.locator(".cosmic-scene").getAttribute("data-zoom"),
      "1.20",
    );
    const viewport = page.locator(".cosmic-viewport");
    await viewport.focus();
    await page.keyboard.press("Home");
    assert.equal(
      await page.locator(".cosmic-scene").getAttribute("data-zoom"),
      "1.00",
    );
    const before = await page.locator(".cosmic-camera").getAttribute("style");
    await page.mouse.move(600, 400);
    await page.mouse.down();
    await page.mouse.move(680, 430);
    await page.mouse.up();
    assert.notEqual(
      await page.locator(".cosmic-camera").getAttribute("style"),
      before,
    );
    await page.getByRole("button", { name: "Restaurar enquadramento" }).click();
    await page.getByRole("button", { name: "Entrar no núcleo" }).click();
    await page.waitForFunction(() => scrollY > 100);
    await page
      .getByRole("heading", { name: "Seu universo de trabalho." })
      .waitFor();
    assert.equal(await page.locator(".gravity-navigation a").count(), 9);
    await page.locator(".gravity-navigation").scrollIntoViewIfNeeded();
    await page.waitForTimeout(850);
    await page.screenshot({ path: out + "/desktop-systems.png" });
    pass(
      "mouse drag, keyboard zoom/reset, enter and progressive system navigation",
    );
    await page.locator(".cosmic-systems-intro a").click();
    await page.waitForFunction(() => scrollY < 100);
    await page.getByRole("button", { name: "Ouvir", exact: true }).click();
    await page.waitForFunction(() => window.__spoken.length === 1);
    await page.clock.install();
    await page.clock.fastForward(17000);
    assert.equal(await page.locator(".arrival-briefing.is-open").count(), 1);
    assert.equal(
      await page.locator(".arrival-briefing").getAttribute("data-speaking"),
      "true",
    );
    await page.evaluate(() => window.__end());
    await page.clock.fastForward(2000);
    await page.locator(".arrival-briefing.is-collapsed").waitFor();
    pass(
      "long announcement survives 16 seconds and collapses only after speech completion",
    );
    await page.getByRole("button", { name: /^Boletim/ }).click();
    await page.getByRole("button", { name: "Ouvir", exact: true }).click();
    await page.getByRole("button", { name: "Recolher boletim" }).click();
    assert.equal(await page.evaluate(() => !!window.__current), true);
    pass("replay and panel close do not cancel speech");
    await page.getByRole("button", { name: /silenciar/i }).click();
    assert.equal(await page.evaluate(() => !!window.__current), false);
    pass("mute interrupts only active announcement");
    assert.deepEqual(errors, []);
    await context.close();
    for (const config of [
      { autoplay: true },
      { blocked: true, autoplay: true },
      { volume: 0 },
      { failure: 401 },
      { failure: 503 },
    ]) {
      const c = await setup(config);
      await c.page.waitForTimeout(350);
      if (config.failure)
        assert.equal(await c.page.locator(".arrival-briefing").count(), 0);
      else if (config.volume === 0)
        assert.equal(await c.page.evaluate(() => window.__spoken.length), 0);
      else if (config.blocked)
        await c.page.getByText(/Áudio indisponível ou bloqueado/).waitFor();
      else {
        await c.page.waitForFunction(() => window.__spoken.length === 1);
        await c.page.evaluate(() => window.__end());
      }
      assert.deepEqual(c.errors, []);
      await c.context.close();
    }
    pass("allowed/blocked audio, volume zero, auth and endpoint failure");
    const replay = await setup({ history: true });
    await replay.page.locator(".arrival-briefing.is-open").waitFor();
    const write = replay.page.getByRole("button", {
      name: "Escrever mensagem",
      exact: true,
    });
    await write.focus();
    await write.click();
    const box = replay.page.getByRole("textbox", {
      name: "Mensagem para o Jarvis",
    });
    await box.fill("Jarvis, repita o boletim");
    await box.press("Enter");
    await replay.page.waitForFunction(() => window.__spoken.length === 1);
    assert.ok(
      (await replay.page.evaluate(() => window.__spoken[0])).includes(
        "Boletim de teste",
      ),
    );
    assert.equal(
      await replay.page.evaluate(() =>
        Object.values(localStorage).some((x) => x.includes("Boletim de teste")),
      ),
      false,
    );
    await replay.page
      .getByRole("button", { name: "Abrir navegação", exact: true })
      .click();
    await replay.page
      .getByRole("navigation", { name: "Áreas do Jarvis" })
      .getByRole("link", { name: /Resultados/ })
      .click();
    await replay.page.waitForFunction(() => !window.__current);
    assert.deepEqual(replay.errors, []);
    await replay.context.close();
    pass(
      "natural replay uses existing voice once, stays out of local history, and navigation cancels owned audio",
    );
    const inactive = await setup();
    await inactive.page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal(
      await inactive.page.locator(".cosmic-scene").getAttribute("data-paused"),
      "true",
    );
    await inactive.context.close();
    pass("hidden-page animation suspension");
    const mobile = await setup({ mobile: true, reduced: true });
    assert.equal(
      await mobile.page.locator(".cosmic-scene").getAttribute("data-paused"),
      "true",
    );
    const size = await mobile.page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(size.scroll <= size.width + 1);
    await mobile.page.screenshot({ path: out + "/mobile-home.png" });
    const touch = mobile.page.locator(".cosmic-viewport");
    await touch.evaluate((el) => {
      const t = (id, x, y) =>
        new Touch({ identifier: id, target: el, clientX: x, clientY: y });
      el.dispatchEvent(
        new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: [t(1, 100, 250), t(2, 200, 250)],
        }),
      );
      el.dispatchEvent(
        new TouchEvent("touchmove", {
          bubbles: true,
          cancelable: true,
          touches: [t(1, 70, 260), t(2, 230, 260)],
        }),
      );
      el.dispatchEvent(
        new TouchEvent("touchend", { bubbles: true, touches: [] }),
      );
    });
    assert.ok(
      Number(
        await mobile.page.locator(".cosmic-scene").getAttribute("data-zoom"),
      ) > 1,
    );
    await mobile.page
      .getByRole("button", { name: "Restaurar enquadramento" })
      .click();
    await mobile.page.getByRole("button", { name: "Entrar no núcleo" }).click();
    await mobile.page.waitForFunction(() => scrollY > 100);
    await mobile.page.screenshot({ path: out + "/mobile-systems.png" });
    assert.deepEqual(mobile.errors, []);
    await mobile.context.close();
    pass(
      "mobile layout, reduced motion, two-finger pinch, reset and scroll navigation",
    );
    await fs.writeFile(
      out + "/results.json",
      JSON.stringify({ passed: results.length, scenarios: results }, null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
