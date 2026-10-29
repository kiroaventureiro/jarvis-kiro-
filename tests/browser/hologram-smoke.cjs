const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3153",
  out = process.env.TEST_OUTPUT_DIR || "work/jk-evidence";
async function instrumentation(context, { noWebGL = false } = {}) {
  await context.addInitScript(
    ({ noWebGL }) => {
      Object.defineProperty(navigator, "hardwareConcurrency", {
        value: 8,
        configurable: true,
      });
      Object.defineProperty(navigator, "deviceMemory", {
        value: 8,
        configurable: true,
      });
      window.__gpu = {
        draws: 0,
        buffers: 0,
        deletedBuffers: 0,
        programs: 0,
        deletedPrograms: 0,
        shaders: 0,
        deletedShaders: 0,
        micRequests: 0,
      };
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (noWebGL && /webgl/.test(type)) return null;
        const gl = original.call(this, type, ...args);
        if (gl && type === "webgl" && !gl.__observed) {
          gl.__observed = true;
          window.__gl = gl;
          for (const [name, key] of [
            ["drawArrays", "draws"],
            ["createBuffer", "buffers"],
            ["deleteBuffer", "deletedBuffers"],
            ["createProgram", "programs"],
            ["deleteProgram", "deletedPrograms"],
            ["createShader", "shaders"],
            ["deleteShader", "deletedShaders"],
          ]) {
            const fn = gl[name].bind(gl);
            gl[name] = (...args) => {
              window.__gpu[key]++;
              return fn(...args);
            };
          }
        }
        return gl;
      };
      const nativeGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(
        navigator.mediaDevices,
      );
      if (nativeGetUserMedia)
        navigator.mediaDevices.getUserMedia = (...args) => {
          window.__gpu.micRequests++;
          throw new Error("Unexpected microphone request");
        };
    },
    { noWebGL },
  );
}
async function browserVoice(context) {
  await context.addInitScript(() => {
    window.__recs = [];
    class Recognition {
      constructor() {
        window.__recs.push(this);
      }
      start() {
        this.active = true;
        this.onstart?.();
      }
      abort() {
        this.active = false;
        this.onend?.();
      }
      stop() {
        this.abort();
      }
    }
    window.SpeechRecognition = Recognition;
    window.webkitSpeechRecognition = Recognition;
    const synth = new EventTarget();
    synth.getVoices = () => [
      {
        voiceURI: "test-pt",
        name: "Voz de teste",
        lang: "pt-BR",
        localService: true,
        default: true,
      },
    ];
    synth.speak = (u) => {
      window.__utterance = u;
      u.onstart?.();
    };
    synth.cancel = () => {
      const u = window.__utterance;
      window.__utterance = null;
      u?.onerror?.({ error: "canceled" });
    };
    Object.defineProperty(window, "speechSynthesis", {
      value: synth,
      configurable: true,
    });
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
    window.__emit = (text) => {
      const r = window.__recs.at(-1);
      if (r?.active)
        r.onresult?.({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: text } }],
        });
    };
    window.__finish = () => {
      const u = window.__utterance;
      window.__utterance = null;
      u?.onend?.();
    };
  });
}
const screenshot = (p, name) =>
  p.screenshot({ path: path.join(out, name + ".png"), animations: "disabled" });
async function readGpu(p) {
  return p.evaluate(() => ({ ...window.__gpu }));
}
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--mute-audio",
    ],
  });
  const results = [];
  try {
    for (const [name, width, height] of [
      ["desktop", 1440, 1000],
      ["mobile", 390, 844],
      ["small-phone", 320, 740],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: width < 600,
        isMobile: width < 600,
        reducedMotion: "reduce",
      });
      await instrumentation(context);
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page.locator(".jk-core[data-renderer=webgl]").waitFor();
      assert.equal(await page.locator(".jk-monogram").count(), 0);
      assert.equal(await page.locator(".jarvis-glass-shards polygon").count(), 14);
      const core = await page.locator(".jk-core").boundingBox();
      assert.ok(core.width >= width * (width < 600 ? .9 : .7));
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal((await readGpu(page)).micRequests, 0);
      await screenshot(page, name);
      const size = await page.locator("canvas").evaluate((c) => ({
        pixels: c.width * c.height,
        ratio: c.width / c.clientWidth,
      }));
      assert.ok(size.pixels <= 1_405_000);
      await page.waitForTimeout(150);
      const draws = (await readGpu(page)).draws;
      await page.waitForTimeout(300);
      assert.equal((await readGpu(page)).draws, draws);
      assert.equal(
        await page.locator(".jk-core").getAttribute("data-audio-visual"),
        "representative",
      );
      assert.deepEqual(errors, []);
      results.push({
        scenario: name,
        webgl: true,
        letterlessCore: true,
        fracturedGlass: true,
        noHorizontalScroll: true,
        reducedMotionStatic: true,
        noNewMicrophone: true,
        pixels: size.pixels,
      });
      await context.close();
    }
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "no-preference",
      });
      await instrumentation(context);
      await browserVoice(context);
      const page = await context.newPage();
      let release;
      await page.route("**/api/director/abacus", async (route) => {
        if (route.request().method() === "GET")
          return route.fulfill({
            json: { paidCallsAllowed: false, usage: { calls: 0 } },
          });
        await new Promise((r) => (release = r));
        return route.fulfill({
          json: {
            text: "Resultado de teste preservado no HUD.",
            model: "route-llm",
            usage: null,
          },
        });
      });
      await page.goto(base);
      await page.locator(".jk-core[data-renderer=webgl]").waitFor();
      const buffers = (await readGpu(page)).buffers,
        start = Date.now(),
        before = (await readGpu(page)).draws;
      await page.waitForTimeout(1000);
      const frameEstimate =
        ((await readGpu(page)).draws - before) /
        5 /
        ((Date.now() - start) / 1000);
      assert.ok(frameEstimate > 0);
      assert.ok(frameEstimate <= 44);
      assert.equal((await readGpu(page)).buffers, buffers);
      await page.emulateMedia({ reducedMotion: "reduce" });
      // Desktop controls are intentionally revealed by approaching the bottom edge.
      await page.mouse.move(720, 990);
      await page
        .getByRole("button", { name: "Ativar escuta por Jarvis", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Ativar escuta", exact: true })
        .click();
      await page.locator(".jk-core[data-phase=waiting]").waitFor();
      await page.mouse.move(20, 100);
      assert.equal(await page.locator(".interaction-dock").evaluate(el => getComputedStyle(el).pointerEvents), "auto", "active listening keeps stop controls reachable");
      await screenshot(page, "waiting");
      await page.evaluate(() => window.__recs.at(-1).onspeechstart?.());
      await page.locator(".jk-core[data-phase=listening]").waitFor();
      await screenshot(page, "listening");
      await page.evaluate(() => window.__emit("Jarvis"));
      await page.locator(".jk-core[data-phase=responding]").waitFor();
      await page.evaluate(() => window.__finish());
      await page.waitForFunction(() => window.__recs.at(-1)?.active);
      await page.evaluate(() => window.__emit("Me dê ideias para o projeto"));
      await page.locator(".jk-core[data-phase=processing]").waitFor();
      await screenshot(page, "processing");
      await page.waitForFunction(
        () =>
          document.querySelector("main").dataset.voicePhase === "processing",
      );
      for (let retry = 0; typeof release !== "function" && retry < 100; retry++)
        await page.waitForTimeout(20);
      assert.equal(typeof release, "function");
      release();
      await page.locator(".jk-core[data-phase=responding]").waitFor();
      await screenshot(page, "responding");
      assert.equal(
        await page.locator("main").getAttribute("data-audio-visual"),
        "representative",
      );
      assert.equal(await page.locator(".response-hud").count(), 0);
      await page.evaluate(() => window.__finish());
      await page
        .getByRole("button", { name: "Desligar escuta contínua", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Escrever mensagem", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill("Sugira nomes para meu documentário");
      await page
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      await page.locator(".jk-core[data-phase=processing]").waitFor();
      await page.waitForTimeout(50);
      release();
      await page.locator(".jk-core[data-phase=responding]").waitFor();
      await page.evaluate(() => window.__finish());
      await page.locator("main[data-state=idle]").waitFor();
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.evaluate(() => {
        window.__hidden = true;
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => window.__hidden,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      const paused = (await readGpu(page)).draws;
      await page.waitForTimeout(250);
      assert.equal((await readGpu(page)).draws, paused);
      await page.evaluate(() => {
        window.__hidden = false;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForFunction((n) => window.__gpu.draws > n, paused);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() =>
        (window.__lostExtension =
          window.__gl.getExtension("WEBGL_lose_context")).loseContext(),
      );
      await page.locator(".jk-core[data-renderer=fallback]").waitFor();
      await screenshot(page, "context-loss");
      assert.equal(
        await page
          .getByRole("button", { name: "Ativar microfone", exact: true })
          .isEnabled(),
        true,
      );
      await page.evaluate(() => window.__lostExtension.restoreContext());
      await page.locator(".jk-core[data-renderer=webgl]").waitFor();
      await page.goto(base + "/configuracoes");
      await page
        .getByLabel("Qualidade do holograma JK", { exact: true })
        .selectOption("eco");

      await page.goto(base);
      await page
        .locator(".jk-core[data-preference=eco][data-renderer=webgl]")
        .waitFor();
      assert.equal(
        await page.locator(".jk-core").getAttribute("data-particles"),
        "80",
      );
      await page
        .getByRole("button", { name: "Abrir navegação", exact: true })
        .click();
      await page
        .getByRole("link", { name: "Configurações", exact: true })
        .click();
      await page
        .getByLabel("Qualidade do holograma JK", { exact: true })
        .waitFor();
      const released = await readGpu(page);
      assert.equal(released.deletedBuffers, released.buffers);
      assert.equal(released.deletedPrograms, released.programs);
      assert.equal(released.deletedShaders, released.shaders);
      results.push({
        scenario: "states-animation-lifecycle",
        waiting: true,
        listening: true,
        processing: true,
        responding: true,
        keyboard: true,
        voiceFirst: true,
        representativeWhenNoStream: true,
        visibilityPause: true,
        contextRecovery: true,
        ecoPersistence: true,
        resourcesReleased: true,
        measuredSoftwareWebGLFps: Number(frameEstimate.toFixed(1)),
        staticBufferAllocation: true,
      });
      await context.close();
    }
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      await instrumentation(context, { noWebGL: true });
      const page = await context.newPage();
      await page.route("**/api/director/abacus", (route) =>
        route.fulfill({
          status: 503,
          json: { error: "Serviço de teste indisponível" },
        }),
      );
      await page.goto(base);
      await page.locator(".jk-core[data-renderer=fallback]").waitFor();
      await screenshot(page, "fallback");
      await page
        .getByRole("button", { name: "Escrever mensagem", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill("Teste de erro");
      await page
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      await page.locator(".jk-core[data-phase=error]").waitFor();
      await screenshot(page, "error");
      assert.equal(
        await page
          .getByRole("button", { name: "Ativar microfone", exact: true })
          .isVisible(),
        true,
      );
      assert.equal((await readGpu(page)).micRequests, 0);
      results.push({
        scenario: "no-webgl-and-error",
        vectorFallback: true,
        letterlessFallback: true,
        errorPreservesControls: true,
        noNewMicrophone: true,
      });
      await context.close();
    }
    {
      const context = await browser.newContext({
        viewport: { width: 900, height: 700 },
        reducedMotion: "no-preference",
      });
      await instrumentation(context);
      await context.addInitScript(() => {
        const raf = window.requestAnimationFrame.bind(window);
        let n = 0;
        window.requestAnimationFrame = (callback) =>
          raf((stamp) => callback(stamp + n++ * 160));
      });
      const page = await context.newPage();
      await page.goto(base);
      await page
        .locator(
          ".jk-core[data-renderer=fallback][data-fallback-reason=performance]",
        )
        .waitFor();
      const gpu = await readGpu(page);
      assert.equal(gpu.deletedBuffers, gpu.buffers);
      assert.equal(gpu.micRequests, 0);
      assert.equal(
        await page
          .getByRole("button", { name: "Ativar microfone", exact: true })
          .isEnabled(),
        true,
      );
      await screenshot(page, "performance-fallback");
      results.push({
        scenario: "sustained-slow-frames",
        simulatedFrameTiming: true,
        automaticVectorFallback: true,
        graphicsResourcesReleased: true,
        controlsPreserved: true,
      });
      await context.close();
    }
    await fs.writeFile(
      path.join(out, "hologram-results.json"),
      JSON.stringify(results, null, 2),
    );
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
