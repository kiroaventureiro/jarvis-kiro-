const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHmac } = require("node:crypto");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/visual-freedom/browser";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Loopback fixture required");
const make = (
  id,
  modules,
  narration = "Explicação de teste com conteúdo verificável no cenário simulado.",
) => ({
  version: 1,
  id,
  title: "JK 3.0 · validação funcional",
  mode: "explanation",
  createdAt: new Date().toISOString(),
  source: {
    kind: "reference",
    label: "Cenário simulado · validação da interface",
  },
  narration,
  modules,
});
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      args: ["--no-sandbox"],
    }),
    results = [];
  const pass = (scenario) => {
    results.push({ scenario, passed: true });
    console.log("PASS " + scenario);
  };
  try {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      acceptDownloads: true,
    });
    const expiry = String(Date.now() + 3600000),
      cookie =
        expiry +
        "." +
        createHmac("sha256", "jk-connectors-session-fixture-only-2026")
          .update(expiry)
          .digest("hex");
    await context.addCookies([
      {
        name: "jarvis_session",
        value: cookie,
        url: base,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await context.addInitScript(() => {
      window.__utterances = [];
      window.__speechCurrent = null;
      window.__speechCancels = 0;
      window.__downloads = 0;
      window.__exports = {};
      window.__canvasText = [];
      window.__overlaps = 0;
      const originalContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/i.test(type)
          ? null
          : originalContext.call(this, type, ...args);
      };
      const oldText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        window.__canvasText.push(String(text));
        return oldText.call(this, text, ...args);
      };
      const oldURL = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        if (
          [
            "application/pdf",
            "application/json",
            "image/png",
            "video/webm",
          ].includes(blob.type)
        )
          window.__exports[blob.type] = blob;
        return oldURL(blob);
      };
      const anchor = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download) window.__downloads++;
        return anchor.call(this);
      };
      const api = new EventTarget();
      api.paused = false;
      api.getVoices = () => [
        {
          voiceURI: "fixture-br-a",
          name: "Voz pt-BR A",
          lang: "pt-BR",
          localService: true,
          default: true,
        },
        {
          voiceURI: "fixture-br-b",
          name: "Voz pt-BR B",
          lang: "pt-BR",
          localService: true,
          default: false,
        },
        {
          voiceURI: "fixture-en",
          name: "English",
          lang: "en-US",
          localService: true,
          default: false,
        },
      ];
      api.speak = (u) => {
        if (window.__speechCurrent?.onend && !window.__speechCurrent.__ended)
          window.__overlaps++;
        window.__utterances.push(u);
        window.__speechCurrent = u;
        queueMicrotask(() => u.onstart?.());
      };
      api.cancel = () => {
        window.__speechCancels++;
        window.__speechCurrent = null;
        api.paused = false;
      };
      api.pause = () => {
        api.paused = true;
      };
      api.resume = () => {
        api.paused = false;
      };
      Object.defineProperty(window, "speechSynthesis", {
        value: api,
        configurable: true,
      });
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text;
        }
      };
    });
    await context.route(
      "https://upload.wikimedia.org/wikipedia/commons/a/ab/Rio_fixture.jpg",
      (r) =>
        r.fulfill({
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=",
            "base64",
          ),
          contentType: "image/png",
        }),
    );
    const page = await context.newPage(),
      errors = [],
      providerPosts = [];
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/api/director/abacus"))
        providerPosts.push(r.postDataJSON());
    });
    let visual = null;
    await page.route("**/api/director/abacus", (r) =>
      r.request().method() === "POST" && visual
        ? r.fulfill({
            json: {
              text: visual.narration,
              visual,
              model: "fixture",
              usage: null,
            },
          })
        : r.continue(),
    );

    await context.addInitScript(() => {
      window.__recs = [];
      class Rec {
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
      window.SpeechRecognition = Rec;
      window.webkitSpeechRecognition = Rec;
    });
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    const root = page.locator(".cinema-root");
    async function send(text, scene = null) {
      visual = scene;
      const toggle = page.getByRole("button", {
        name: "Escrever mensagem",
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill(text);
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/director/abacus") &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      const reply = await (await response).json();
      await page.clock.runFor(900);
      return reply;
    }
    async function finish() {
      for (let i = 0; i < 240; i++) {
        if (!(await root.count())) return;
        await page.evaluate(() => {
          const u = window.__speechCurrent;
          if (u?.onend && !u.__ended) {
            u.__ended = true;
            u.onend();
          }
        });
        await page.clock.runFor(500);
      }
      throw Error("Narration did not complete");
    }
    async function freeSurface(kind) {
      await page.locator('.cinema-root[data-kind="' + kind + '"]').waitFor();
      const style = await page
        .locator(".cinema-primary>.holo-panel")
        .evaluate((e) => {
          const s = getComputedStyle(e);
          return {
            border: s.borderTopWidth,
            background: s.backgroundColor,
            shadow: s.boxShadow,
          };
        });
      assert.equal(style.border, "0px");
      assert.equal(style.background, "rgba(0, 0, 0, 0)");
      assert.equal(style.shadow, "none");
    }
    assert.equal(await page.locator(".jk-perspective-grid").count(), 1);
    assert.equal(await page.locator(".jk-architecture path").count(), 3);
    assert.equal(await page.locator(".jk-volume-shaft").count(), 1);
    await page.screenshot({ animations:"disabled", path: path.join(out, "01-rich-environment.png") });
    pass(
      "Hero preserves JK core and adds circuit planes, perspective and volumetric environment",
    );
    const r = await send("Como está o Brasil hoje?");
    assert.equal(r.model, "jk-public-reference");
    assert.ok(!r.visual.modules.some((m) => m.kind === "map"));
    assert.match(r.text, /não confirma notícias de hoje/);
    await freeSurface("text");
    pass(
      "Broad current-context question is investigated and never turned into a map by a country name",
    );
    await finish();
    const k = await send("Como funciona um semicondutor?");
    assert.equal(k.model, "jk-public-reference");
    assert.ok(k.visual.sources[0].href.startsWith("https://pt.wikipedia.org/"));
    assert.match(k.text, /condutividade/);
    await freeSurface("text");
    await page.clock.runFor(2600);
    await page.screenshot({ animations:"disabled", path: path.join(out, "02-general-research.png") });
    pass(
      "Previously uncatalogued subject reaches public research, sources and a floating explanation",
    );
    const current = await page.evaluate(() => window.__speechCurrent?.text),
      cancels = await page.evaluate(() => window.__speechCancels);
    await page
      .getByRole("button", { name: "Ativar escuta por Jarvis", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ativar escuta", exact: true })
      .click();
    await page.clock.runFor(1000);
    assert.equal(await page.evaluate(() => window.__speechCancels), cancels);
    assert.equal(
      await page.evaluate(() => window.__speechCurrent?.text),
      current,
    );
    assert.equal(
      await page.evaluate(() => window.__recs.filter((r) => r.active).length),
      0,
    );
    pass(
      "Arming continuous listening leaves current narration intact and prevents self-feedback",
    );
    const m = await send("Mostre o Brasil no mapa");
    assert.ok(m.visual.modules.some((m) => m.kind === "map"));
    assert.ok(await page.evaluate((n) => window.__speechCancels > n, cancels));
    await freeSurface("map");
    const mapBox = await page
        .locator(".cinema-primary .holo-world-viewport")
        .boundingBox(),
      primaryBox = await page.locator(".cinema-primary").boundingBox();
    assert.ok(mapBox.width > primaryBox.width * 0.8);
    assert.ok(
      !(await page.locator(".cinema-root .holo-caption").first().isVisible()),
    );
    await page.clock.runFor(1800);
    await page.screenshot({ animations:"disabled", path: path.join(out, "03-free-map.png") });
    pass(
      "An explicit new question replaces prior narration and shows a clean borderless map",
    );
    await finish();
    await page.clock.runFor(800);
    assert.ok(await page.evaluate(() => window.__recs.some((r) => r.active)));
    pass("Armed listening resumes only after the narrated presentation ends");
    await page
      .getByRole("button", { name: "Desligar escuta contínua", exact: true })
      .click();
    const h = await send("Conte a história do Brasil");
    assert.ok(h.visual.modules.some((m) => m.kind === "timeline"));
    pass(
      "Historical explanation keeps its historical flow instead of a current-data query",
    );
    await finish();
    const chart = make(
      "chart",
      [
        {
          id: "values",
          kind: "metrics",
          title: "Medições de teste",
          unit: "unidades · simulação",
          style: "line",
          values: [
            { label: "A", value: 12 },
            { label: "B", value: 20 },
          ],
        },
      ],
      "Estes são dados simulados para validar a projeção visual.",
    );
    await send("Demonstre os indicadores simulados", chart);
    await freeSurface("metrics");
    await page.clock.runFor(2800);
    await page.screenshot({ animations:"disabled", path: path.join(out, "04-free-chart.png") });
    pass(
      "Charts use lightweight projection surfaces rather than dashboard cards",
    );
    await finish();
    const media = make(
      "media",
      [
        {
          id: "photo",
          kind: "media",
          title: "Referência simulada",
          items: [
            {
              id: "asset",
              type: "image",
              label: "Referência de teste",
              commonsTitle: "File:Rio_fixture.jpg",
              caption: "Imagem simulada; validação do contêiner.",
            },
          ],
        },
      ],
      "Referência visual simulada para validar apresentação e créditos.",
    );
    await send("Mostre a referência de teste", media);
    await freeSurface("media");
    pass(
      "Image and video modules share a free projection surface while preserving media controls",
    );
    await finish();
    const floating = make("floating", [
      {
        id: "concept",
        kind: "text",
        title: "Conceito",
        text: "Uma explicação relevante pode aparecer como escrita projetada no espaço, com hierarquia e legibilidade.",
        tags: [],
      },
    ]);
    for (const [name, width, height] of [
      ["phone", 390, 844],
      ["small", 320, 740],
      ["landscape", 844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await page.clock.runFor(500);
      await send("Explique o conceito visual", floating);
      await freeSurface("text");
      const bounds = await page.locator(".cinema-primary").boundingBox(),
        dock = await page.locator(".dock-controls").boundingBox();
      assert.ok(bounds.y + bounds.height <= dock.y + 5);
      assert.ok(bounds.x >= -2 && bounds.x + bounds.width <= width + 2);
      await page.screenshot({ animations:"disabled", path: path.join(out, "05-" + name + ".png") });
      pass(name + " keeps free text clear of dock and viewport edges");
      await finish();
    }
    assert.deepEqual(errors, []);
    pass(
      "Full freeform, voice and public research flow completes without uncaught browser errors",
    );
  } finally {
    await fs.writeFile(
      path.join(out, "browser-results.json"),
      JSON.stringify(
        {
          results,
          count: results.length,
          services:
            "Loopback fixtures; public-source live checks are recorded separately; no paid APIs or real microphone",
        },
        null,
        2,
      ),
    );
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
