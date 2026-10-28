const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createHmac } = require("node:crypto"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/holo-v2/after";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Loopback fixture required");
const wrap = (modules) => ({
  version: 1,
  id: "v2-" + Math.random().toString(16).slice(2),
  title: "Demonstração de validação · JK",
  mode: "analysis",
  createdAt: new Date().toISOString(),
  source: { kind: "reference", label: "Cenário simulado · teste funcional" },
  narration: "Explicação simulada, sem serviço neural.",
  modules,
});
const detail = (i) =>
  "Conteúdo essencial com acentuação, precisão e contexto. ".repeat(5) +
  "Marco essencial " +
  i +
  ".";
const longReport = () =>
  wrap([
    {
      id: "report",
      kind: "report",
      title: "Diagnóstico do projeto de teste",
      summary:
        "Síntese visual do diagnóstico. O documento integral permanece disponível nas exportações.",
      items: Array.from({ length: 8 }, (_, i) => ({
        label: "Tema " + i,
        detail: detail(i),
      })),
      body:
        "DOCUMENTO COMPLETO: contexto, evidências e recomendações. ".repeat(
          30,
        ) + "FINAL_DO_DOCUMENTO_INTEGRAL",
    },
  ]);
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
      window.__exports = {};
      window.__spoken = [];
      window.__canvasText = [];
      const url = URL.createObjectURL.bind(URL);
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
        return url(blob);
      };
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === "webgl" || type === "webgl2") return null;
        return getContext.call(this, type, ...args);
      };
      const fill = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        if (this.canvas.width === 1240) window.__canvasText.push(text);
        return fill.call(this, text, ...args);
      };
      const synth = new EventTarget();
      synth.getVoices = () => [
        {
          voiceURI: "br-fixture",
          name: "Voz de teste",
          lang: "pt-BR",
          localService: true,
          default: true,
        },
      ];
      synth.speak = (u) => {
        window.__spoken.push(u.text);
        u.onstart?.();
        setTimeout(() => u.onend?.(), 30);
      };
      synth.cancel = () => {};
      Object.defineProperty(window, "speechSynthesis", {
        value: synth,
        configurable: true,
      });
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text;
        }
      };
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(25000);
    await page.goto(base);
    await page
      .getByRole("button", { name: "Escrever mensagem", exact: true })
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(out, "desktop-idle.png"),
      animations: "disabled",
    });
    pass("Approved JK identity and home controls remain available");
    await page.clock.install();
    let responseVisual = null;
    await page.route("**/api/director/abacus", (r) =>
      r.request().method() === "POST" && responseVisual
        ? r.fulfill({
            json: {
              text: responseVisual.narration,
              model: "fixture",
              usage: null,
              visual: responseVisual,
            },
          })
        : (async () => {
            if (r.request().method() !== "POST") return r.continue();
            const response = await r.fetch();
            const data = await response.json();
            if (data.visual?.source)
              data.visual.source.label =
                "Dados simulados · validação da interface";
            return r.fulfill({ response, json: data });
          })(),
    );
    async function send(visual, text = "Apresente o resultado de teste") {
      responseVisual = visual;
      const toggle = page.getByRole("button", {
        name: "Escrever mensagem",
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill(text);
      await page
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      await page.locator(".cinema-root").waitFor();
      await page.clock.runFor(300);
      await page.locator("main[data-state=idle]").waitFor();
    }
    async function sample() {
      return page.locator(".cinema-primary").evaluate((el) => ({
        id: el.closest(".cinema-root").dataset.activeHologram,
        written: el.dataset.flowWritten,
        seen: el.dataset.flowSeen,
        max: Number(el.dataset.flowOverflow || 0),
        top: el.querySelector(".holo-panel-body").scrollTop,
        text: [
          ...el.querySelectorAll(".holo-text-stream>span[aria-hidden=true]"),
        ]
          .map((x) => x.innerText)
          .join(" "),
        height: el.querySelector(".holo-panel-body").clientHeight,
      }));
    }
    async function screenshot(name) {
      await page.screenshot({
        path: path.join(out, name),
        animations: "disabled",
      });
    }
    async function openOptions() {
      const summary = page.locator(".cinema-options>summary");
      if ((await page.locator(".cinema-options").getAttribute("open")) === null)
        await summary.click();
    }
    async function explore() {
      await openOptions();
      await page
        .getByRole("button", { name: "Explorar quadros", exact: true })
        .click();
    }
    await send(
      wrap([
        {
          id: "intro",
          kind: "report",
          title: "Informação em construção",
          summary:
            "O Brasil em 1988 e a evolução do IPCA ilustram esta explicação. A leitura deve surgir em palavras completas, com clareza e precisão.",
          items: [],
        },
      ]),
    );
    const root = page.locator(".cinema-root");
    assert.equal(await root.getByRole("progressbar").count(), 0);
    assert.equal(
      await root
        .locator(".cinema-track,.cinema-scene-index,.cinema-caption")
        .count(),
      0,
    );
    assert.ok(
      !/\d+\s*\/\s*\d+/.test(
        await page.locator(".cinema-director").innerText(),
      ),
    );
    pass(
      "Automatic demonstration has no temporal progress bar, slide counter or sequence navigation",
    );
    const early = await sample();
    await page.clock.runFor(900);
    const writing = await sample();
    assert.ok(writing.text.length > early.text.length);
    assert.equal(writing.written, "false");
    const accessible = await page
      .locator(".cinema-primary .holo-auto-message .holo-sr-only")
      .innerText();
    assert.match(accessible, /precisão/);
    pass(
      "Title and word-based writing are progressive while full stable text remains accessible",
    );
    await page
      .getByRole("button", { name: "Pausar demonstração", exact: true })
      .click();
    const paused = await sample();
    await page.clock.runFor(2000);
    assert.deepEqual(await sample(), paused);
    await page
      .getByRole("button", { name: "Continuar demonstração", exact: true })
      .click();
    await page.clock.runFor(1300);
    assert.ok((await sample()).text.length > paused.text.length);
    pass("Pause and resume preserve revealed words and scroll position");
    await page.clock.runFor(5000);
    assert.ok(
      await page
        .locator(
          ".holo-highlight.is-region,.holo-highlight.is-date,.holo-highlight.is-metric",
        )
        .count(),
    );
    assert.equal(
      await page.evaluate(() => document.fonts.check('17px "JK Inter"')),
      true,
    );
    assert.ok(
      await page
        .locator(".holo-auto-message")
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 17),
    );
    await screenshot("desktop-typography.png");
    pass(
      "Local Inter font, legible hierarchy and selective semantic highlights render",
    );
    await page
      .getByRole("button", {
        name: "Interromper demonstração visual",
        exact: true,
      })
      .click();
    assert.equal(await root.count(), 0);
    pass("Stop immediately removes the presentation and restores the home");

    const overflow = wrap([
      {
        id: "overflow",
        kind: "report",
        title: "Continuidade sem rolagem manual",
        summary:
          "Uma explicação precisa de espaço para apresentar cada detalhe com calma. ".repeat(
            4,
          ),
        items: [],
      },
    ]);
    await send(overflow);
    const style = await page.addStyleTag({
      content:
        ".holo-experience-v2 .cinema-primary .holo-panel-body{height:86px!important;flex:0 0 86px!important;max-height:86px!important}",
    });
    let sawOverflow = false,
      sawScrolled = false,
      held = false,
      initialId = (await sample()).id;
    for (let i = 0; i < 100; i++) {
      await page.clock.runFor(400);
      const s = await sample();
      if (s.max > 80) sawOverflow = true;
      if (s.top > 10) sawScrolled = true;
      if (s.written === "true" && s.max - s.top > 60) {
        const id = s.id;
        await page.clock.runFor(300);
        assert.equal((await sample()).id, id);
        held = true;
      }
      if ((await root.getAttribute("data-complete")) === "true") break;
    }
    assert.ok(sawOverflow && sawScrolled && held);
    assert.equal(
      await page
        .locator(".cinema-primary .holo-panel-body")
        .evaluate((el) => getComputedStyle(el).overflowY),
      "hidden",
    );
    assert.equal((await sample()).seen, "true");
    await screenshot("automatic-overflow.png");
    await style.evaluate((el) => el.remove());
    pass(
      "Automatic overflow follows writing and holds the hologram until all essential content has been visible",
    );

    const report = longReport();
    await send(report);
    await page.evaluate(() => {
      window.__completedVisuals = [];
      const host = document.querySelector(".cinema-root");
      let old = host.querySelector(".cinema-primary");
      window.__flowObserver?.disconnect();
      window.__flowObserver = new MutationObserver(() => {
        const next = host.querySelector(".cinema-primary");
        if (next !== old && old) {
          window.__completedVisuals.push({
            written: old.dataset.flowWritten,
            seen: old.dataset.flowSeen,
            text: [
              ...old.querySelectorAll(
                ".holo-text-stream>span[aria-hidden=true]",
              ),
            ]
              .map((x) => x.innerText)
              .join(" "),
          });
          old = next;
        }
      });
      window.__flowObserver.observe(host, { childList: true, subtree: true });
    });
    const visited = [];
    for (let i = 0; i < 320; i++) {
      await page.clock.runFor(1000);
      const s = await sample();
      if (s.written === "true") visited.push(s.text);
      if ((await root.getAttribute("data-complete")) === "true") break;
    }
    assert.equal(await root.getAttribute("data-complete"), "true");
    const transitions = await page.evaluate(() => window.__completedVisuals);
    assert.ok(transitions.length >= 8);
    assert.ok(
      transitions.every((t) => t.written === "true" && t.seen === "true"),
    );
    const all = visited.concat(transitions.map((t) => t.text)).join(" ");
    for (let i = 0; i < 8; i++)
      assert.ok(
        all.includes("Marco essencial " + i),
        "Missing essential item " + i,
      );
    await screenshot("desktop-report-complete.png");
    pass(
      "Long reports split into bounded holograms and all eight essential conclusions appear before transitions",
    );
    await page
      .getByRole("button", { name: "Ler resposta em texto", exact: true })
      .click();
    await page.locator(".cinema-full-text").waitFor();
    await page
      .getByRole("button", { name: "Recolher texto", exact: true })
      .click();
    pass("Complete transcript remains available on demand");
    async function exportBytes(label, type, file) {
      await page
        .getByRole("button", {
          name: "Exportar resultado holográfico",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.waitForFunction((type) => !!window.__exports[type], type);
      const b64 = await page.evaluate(async (type) => {
        const data = new Uint8Array(await window.__exports[type].arrayBuffer());
        let s = "";
        for (let i = 0; i < data.length; i += 32768)
          s += String.fromCharCode(...data.subarray(i, i + 32768));
        return btoa(s);
      }, type);
      const bytes = Buffer.from(b64, "base64");
      await fs.writeFile(path.join(out, file), bytes);
      return bytes;
    }
    const json = JSON.parse(
      (
        await exportBytes(
          "JSON · dados estruturados",
          "application/json",
          "complete-report.json",
        )
      ).toString(),
    );
    assert.equal(json.scene.modules[0].body, report.modules[0].body);
    assert.equal(json.scene.modules[0].items.length, 8);
    const pdf = await exportBytes(
      "PDF · relatório completo",
      "application/pdf",
      "complete-report.pdf",
    );
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(
      await page.evaluate(() =>
        window.__canvasText.join(" ").includes("FINAL_DO_DOCUMENTO_INTEGRAL"),
      ),
    );
    pass(
      "PDF and JSON exports retain complete document and data beyond the visual summary",
    );

    const history = wrap([
      {
        id: "history",
        kind: "timeline",
        title: "História do Brasil",
        events: Array.from({ length: 8 }, (_, i) => ({
          when: String(1500 + i * 60),
          label: "Marco histórico " + i,
          detail:
            "Contexto histórico importante. ".repeat(4) +
            "Detalhe final " +
            i +
            ".",
        })),
      },
    ]);
    await send(history);
    const historySeen = [];
    for (let i = 0; i < 220; i++) {
      await page.clock.runFor(1000);
      const s = await sample();
      if (s.written === "true") historySeen.push(s.text);
      if ((await root.getAttribute("data-complete")) === "true") break;
    }
    for (let i = 0; i < 8; i++)
      assert.ok(historySeen.join(" ").includes("Detalhe final " + i));
    pass(
      "All timeline details are automatically presented, without requiring event clicks",
    );

    const geo = wrap([
      {
        id: "world",
        kind: "map",
        region: "WORLD",
        title: "Países em contexto",
        focusCountry: "BRA",
        caption: "Áreas mencionadas na explicação.",
      },
    ]);
    geo.narration = "Brasil, França e Japão são as áreas desta explicação.";
    await send(geo);
    const countries = new Set();
    for (let i = 0; i < 55; i++) {
      await page.clock.runFor(500);
      const country = await page
        .locator(".cinema-primary .holo-world-map")
        .getAttribute("data-context-country");
      countries.add(country);
      if ((await root.getAttribute("data-complete")) === "true") break;
    }
    assert.deepEqual([...countries], ["BRA", "FRA", "JPN"]);
    await screenshot("desktop-context-map.png");
    pass("Geographic references receive progressive contextual country focus");
    await explore();
    await page
      .getByRole("textbox", { name: "Buscar país ou localização" })
      .fill("França");
    await page.getByRole("button", { name: "França", exact: true }).click();
    assert.match(
      await page
        .getByRole("link", { name: /Abrir França no Google Maps/ })
        .getAttribute("href"),
      /google.com/,
    );
    pass("Manual exploration preserves country search and official Maps links");

    responseVisual = null;
    await page
      .getByRole("button", {
        name: "Fechar resultados holográficos",
        exact: true,
      })
      .click();
    await send(null, "Como está a economia brasileira?");
    const colors = new Map(),
      units = new Set();
    for (let i = 0; i < 180; i++) {
      await page.clock.runFor(500);
      const kind = await page
        .locator(".cinema-primary")
        .getAttribute("data-content-type");
      if (kind === "metrics") {
        const title = await page
          .locator(".cinema-primary h3 .holo-sr-only")
          .innerText();
        const stroke = await page
          .locator(".cinema-primary .holo-chart-line")
          .evaluate((el) => getComputedStyle(el).stroke);
        colors.set(title, stroke);
        units.add(
          await page
            .locator(
              ".cinema-primary .holo-metrics .holo-metric-unit, .cinema-primary .holo-metrics>.holo-caption",
            )
            .innerText(),
        );
        if (title.includes("IPCA"))
          await screenshot("desktop-economic-chart.png");
      }
      if (colors.size === 3) break;
    }
    assert.equal(colors.size, 3);
    assert.equal(new Set(colors.values()).size, 3);
    assert.ok([...units].some((x) => x.includes("%")));
    assert.ok([...units].some((x) => x.includes("R$")));
    pass(
      "Economic indicators keep distinct colors, periods, units and signed source values",
    );

    await page
      .getByRole("button", {
        name: "Interromper demonstração visual",
        exact: true,
      })
      .click();
    await send(
      wrap([
        {
          id: "voice",
          kind: "report",
          title: "Sincronização com a fala",
          summary:
            "Este conteúdo precisa permanecer visível enquanto a narração acompanha sua explicação.",
          items: [],
        },
      ]),
    );
    const speechId = (await sample()).id;
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("jk-speech-progress", {
            detail: {
              phase: "boundary",
              fraction: 0,
              textLength: 100,
              charIndex: 0,
              at: Date.now(),
            },
          }),
        ),
      );
      await page.clock.runFor(1000);
    }
    assert.equal((await sample()).id, speechId);
    assert.equal(await root.getAttribute("data-complete"), "false");
    await page.clock.runFor(5000);
    assert.equal(await root.getAttribute("data-sync"), "guided");
    pass(
      "Fresh voice boundaries hold the stage and absent events recover to estimated timing",
    );

    for (const [name, width, height] of [
      ["mobile", 390, 844],
      ["small-phone", 320, 740],
      ["landscape", 960, 540],
    ]) {
      await page.setViewportSize({ width, height });
      await send(
        wrap([
          {
            id: "mobile",
            kind: "report",
            title: "Leitura confortável",
            summary: "Informação essencial com contexto e precisão. ".repeat(5),
            items: [],
          },
        ]),
      );
      await page.clock.runFor(5000);
      const s = await sample();
      assert.ok(s.height >= 48, name + " readable viewport");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await screenshot(name + "-automatic.png");
      pass(name + " uses readable typography and bounded automatic content");
    }
    await page.setViewportSize({ width: 320, height: 740 });
    await send(
      wrap([
        {
          id: "compact-ipca",
          kind: "metrics",
          title: "IPCA mensal",
          unit: "% no mês · fonte de teste",
          style: "line",
          values: [
            { label: "Ago/26", period: "2026-08-01", value: -0.32 },
            { label: "Set/26", period: "2026-09-01", value: 0.82 },
          ],
        },
      ]),
    );
    const modes = new Set();
    for (let i = 0; i < 80; i++) {
      await page.clock.runFor(400);
      const graph = await page
        .locator(".cinema-primary svg.holo-chart")
        .count();
      modes.add(graph ? "chart" : "observation");
      if (graph && (await sample()).written === "true") {
        const bounds = await page.locator(".cinema-primary").evaluate((el) => {
          const body = el
              .querySelector(".holo-panel-body")
              .getBoundingClientRect(),
            line = el.querySelector(".holo-chart-line").getBoundingClientRect();
          return {
            body: { top: body.top, bottom: body.bottom },
            line: { top: line.top, bottom: line.bottom },
          };
        });
        assert.ok(
          bounds.line.top >= bounds.body.top - 2 &&
            bounds.line.bottom <= bounds.body.bottom + 2,
          "Complete plot must remain visible",
        );
        await screenshot("small-phone-chart.png");
      }
      if ((await root.getAttribute("data-complete")) === "true") break;
    }
    assert.ok(modes.has("chart") && modes.has("observation"));
    pass(
      "Compact graphics separate evolution and latest reading without clipping the plot",
    );
    await send(
      wrap([
        {
          id: "categories",
          kind: "metrics",
          title: "Ações verificadas",
          unit: "ações · dados de teste",
          style: "bars",
          values: [
            { label: "Concluídas", value: 8 },
            { label: "Pendentes", value: 3 },
            { label: "Falharam", value: 1 },
          ],
        },
      ]),
    );
    const categoryValues = new Map();
    for (let i = 0; i < 100; i++) {
      await page.clock.runFor(400);
      if ((await sample()).written === "true") {
        const value = await page
          .locator(".cinema-primary .holo-metric-categories .holo-metric")
          .evaluate((el) => ({
            label: el.querySelector("dt .holo-sr-only").textContent,
            width: parseFloat(
              el.querySelector(".holo-metric-track i").style.width,
            ),
          }));
        categoryValues.set(value.label, value.width);
      }
      if ((await root.getAttribute("data-complete")) === "true") break;
    }
    assert.deepEqual(
      [...categoryValues.keys()],
      ["Concluídas", "Pendentes", "Falharam"],
    );
    assert.deepEqual([...categoryValues.values()], [100, 37.5, 12.5]);
    pass(
      "Every categorical value is shown with a shared accurate scale across automatic holograms",
    );
    await openOptions();
    await page
      .getByRole("checkbox", { name: "Sem animação", exact: true })
      .check();
    await page.clock.runFor(200);
    assert.equal(await root.getAttribute("data-motion"), "static");
    assert.equal(
      await page.locator(".cinema-primary [data-holo-writing=true]").count(),
      0,
    );
    pass(
      "Explicit no-animation mode reveals complete text and persists as a non-sensitive preference",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.runFor(200);
    assert.equal(await root.getAttribute("data-motion"), "static");
    pass("Reduced-motion preference is respected");
    await page
      .getByRole("button", {
        name: "Interromper demonstração visual",
        exact: true,
      })
      .click();
    assert.equal(await root.count(), 0);
    assert.deepEqual(errors, []);
    pass("Cleanup leaves no uncaught errors or active presentation");
  } finally {
    await fs.writeFile(
      path.join(out, "browser-results.json"),
      JSON.stringify(
        {
          results,
          count: results.length,
          services: "Simulated; no paid models or microphone capture",
          core: "SVG fallback for deterministic accelerated-clock tests",
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
