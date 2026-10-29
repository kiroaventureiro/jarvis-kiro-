const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHmac } = require("node:crypto");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/holo-v3/browser";
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
    await page.goto(base);
    await page
      .getByRole("button", { name: "Escrever mensagem", exact: true })
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    const root = page.locator(".cinema-root");
    async function screenshot(name) {
      await page.screenshot({
        path: path.join(out, name),
        animations: "disabled",
      });
    }
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
      await page
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      await page.clock.runFor(250);
    }
    async function finishSpeech() {
      for (let i = 0; i < 80; i++) {
        const active = await page.evaluate(() => {
          const u = window.__speechCurrent;
          if (!u?.onend) return false;
          u.__ended = true;
          u.onend();
          return true;
        });
        await page.clock.runFor(30);
        if (
          !active ||
          !(await page.evaluate(() => !!window.__speechCurrent?.onend))
        )
          break;
      }
    }
    async function settleScene(limit = 160) {
      for (let i = 0; i < limit; i++) {
        if (!(await root.count())) return;
        const phase = await root.getAttribute("data-narration-phase");
        if (phase === "speaking") await finishSpeech();
        if (phase === "error") throw Error("Unexpected voice recovery notice");
        await page.clock.runFor(400);
      }
      throw Error("Presentation failed to complete automatically");
    }
    async function options() {
      const d = page.locator(".cinema-options");
      if ((await d.getAttribute("open")) === null)
        await d.locator("summary").click();
    }
    assert.equal(
      await page
        .locator(".dock-controls")
        .getByRole("button", { name: "Silenciar áudio", exact: true })
        .count(),
      1,
    );
    assert.ok(
      !(await page.locator(".dock-controls").innerText()).includes("♫"),
    );
    assert.ok(
      !(await page
        .getByRole("button", { name: "Guardar neste dispositivo", exact: true })
        .isVisible()),
    );
    assert.ok(
      !(await page.locator(".state-indicator").innerText()).includes(
        "Sessão neural desligada",
      ),
    );
    await screenshot("01-home-controls.png");
    pass(
      "Home keeps functional microphone, keyboard, attachments and speaker controls without misleading music or target icons",
    );
    await page
      .getByRole("button", { name: "Ativar escuta por Jarvis", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    pass("Initial microphone consent remains explicit and cancellable");
    const long =
      "O Brasil reúne territórios e contextos que precisam ser explicados com cuidado. ".repeat(
        15,
      ) +
      "Conclusão integral da primeira explicação. O contexto final encerra o raciocínio.";
    const narrated = make(
      "narrated",
      [
        {
          id: "territory",
          kind: "map",
          region: "BR",
          title: "Brasil",
          caption:
            "Território atual como referência; não representa fronteiras históricas.",
        },
        {
          id: "context",
          kind: "report",
          title: "Contexto final",
          summary:
            "Conclusão integral da primeira explicação, com os dados essenciais.",
          items: [],
        },
      ],
      long,
    );
    await send("Apresente a explicação de teste", narrated);
    await root.waitFor();
    await page.clock.runFor(1000);
    const first = await root.getAttribute("data-active-hologram");
    assert.equal(await root.getAttribute("data-narration-phase"), "speaking");
    assert.equal(await root.getAttribute("data-spatial"), "true");
    assert.equal(
      await page
        .locator(".cinema-primary>.holo-panel")
        .evaluate((e) => getComputedStyle(e).boxShadow),
      "none",
    );
    await page.clock.runFor(28000);
    assert.equal(await root.getAttribute("data-active-hologram"), first);
    assert.equal(await root.getAttribute("data-playing"), "true");
    pass(
      "Spoken chapter holds its matching free hologram beyond the independent visual duration",
    );
    const utterances = await page.evaluate(() => window.__utterances.length);
    await page
      .getByRole("button", { name: "Pausar demonstração", exact: true })
      .click();
    assert.equal(await page.evaluate(() => speechSynthesis.paused), true);
    await page.clock.runFor(3000);
    await page
      .getByRole("button", { name: "Continuar demonstração", exact: true })
      .click();
    assert.equal(await page.evaluate(() => speechSynthesis.paused), false);
    assert.equal(
      await page.evaluate(() => window.__utterances.length),
      utterances,
    );
    pass(
      "Pausing and resuming freezes both the visual and the actual speech queue without duplicate utterances",
    );
    await finishSpeech();
    assert.equal(await root.getAttribute("data-narration-phase"), "waiting");
    for (
      let i = 0;
      i < 50 && (await root.getAttribute("data-active-hologram")) === first;
      i++
    )
      await page.clock.runFor(400);
    assert.notEqual(await root.getAttribute("data-active-hologram"), first);
    assert.equal(await root.getAttribute("data-narration-phase"), "speaking");
    await screenshot("02-spatial-narration.png");
    pass("Next chapter starts only when its visual becomes active");
    await settleScene();
    assert.equal(await root.count(), 0);
    assert.equal(await page.locator("main").getAttribute("data-state"), "idle");
    await page
      .getByRole("button", {
        name: "Reabrir último resultado holográfico",
        exact: true,
      })
      .waitFor();
    await screenshot("03-automatic-return.png");
    pass(
      "Completion retracts the result and restores the ready JK core without manual cleanup",
    );
    await page
      .getByRole("button", {
        name: "Reabrir último resultado holográfico",
        exact: true,
      })
      .click();
    await root.waitFor();
    await options();
    await page
      .getByRole("button", { name: "Explorar quadros", exact: true })
      .click();
    await page.locator(".holo-panel-grid").waitFor();
    assert.ok(await page.locator(".holo-report").count());
    pass(
      "Retracted results remain recoverable for manual exploration and export",
    );
    await send(
      "Nova explicação",
      make(
        "old",
        [
          {
            id: "old",
            kind: "report",
            title: "Resposta anterior",
            summary: "Esta explicação será interrompida por uma nova pergunta.",
            items: [],
          },
        ],
        "Texto anterior que não pode se sobrepor à resposta seguinte.",
      ),
    );
    await root.waitFor();
    await page.clock.runFor(500);
    const cancels = await page.evaluate(() => window.__speechCancels);
    await send(
      "Substitua a explicação",
      make(
        "new",
        [
          {
            id: "new",
            kind: "report",
            title: "Nova resposta",
            summary: "O novo contexto substitui a sessão anterior.",
            items: [],
          },
        ],
        "Esta é a nova resposta.",
      ),
    );
    await page.clock.runFor(500);
    assert.match(await root.getAttribute("data-active-hologram"), /new/);
    assert.ok((await page.evaluate(() => window.__speechCancels)) > cancels);
    assert.equal(await page.evaluate(() => window.__overlaps), 0);
    pass(
      "A new typed question cancels old speech and replaces the visual session without overlap",
    );
    await page.evaluate(() =>
      window.__speechCurrent.onerror?.({ error: "synthesis-failed" }),
    );
    await page.clock.runFor(200);
    await page
      .getByRole("button", { name: "Retomar voz", exact: true })
      .waitFor();
    const beforeRetry = await page.evaluate(() => window.__utterances.length);
    await page
      .getByRole("button", { name: "Retomar voz", exact: true })
      .click();
    await page.clock.runFor(100);
    assert.ok(
      (await page.evaluate(() => window.__utterances.length)) > beforeRetry,
    );
    await page.evaluate(() =>
      window.__speechCurrent.onerror?.({ error: "synthesis-failed" }),
    );
    await page.clock.runFor(200);
    await page
      .getByRole("button", { name: "Continuar sem voz", exact: true })
      .click();
    await settleScene();
    pass(
      "Speech failures offer explicit retry or silent continuation and do not trigger paid fallbacks",
    );
    await send("Mostre o mapa de Paris, França");
    await page.locator('.holo-world-map[data-context-place="Paris"]').waitFor();
    assert.equal(await page.locator(".holo-world-place-marker").count(), 1);
    await page.clock.runFor(2500);
    await screenshot("04-city-free-map.png");
    assert.match(
      await page.locator(".holo-geography-note").innerText(),
      /sem mapa de ruas/,
    );
    pass(
      "Offline primary geographic data locates a real city with an explicit reference-point label",
    );
    await send("Mostre o mapa do Nordeste");
    await page.locator('.holo-map[data-context-region="Nordeste"]').waitFor();
    assert.equal(
      await page.locator(".cinema-primary .holo-map path.is-selected").count(),
      9,
    );
    await page.clock.runFor(2500);
    await screenshot("05-northeast-focus.png");
    pass(
      "Northeast focus highlights exactly its nine current states and keeps historical-boundary limits explicit",
    );
    await send("Mostre o mapa da Europa");
    await page.locator(".holo-world-map").waitFor();
    assert.ok(
      (await page.locator(".cinema-primary path.is-selected").count()) > 25,
    );
    await page.clock.runFor(2500);
    await screenshot("06-continent-focus.png");
    pass(
      "Continental context highlights source-classified countries in a frameless spatial map",
    );
    await send("Mostre uma foto real do Rio de Janeiro");
    await page.locator('[data-reference-state="ready"]').waitFor();
    await page.clock.runFor(3000);
    await page.getByText("Crédito e referência", { exact: true }).click();
    assert.match(
      await page.locator(".holo-reference-image").innerText(),
      /CC BY-SA 4.0/,
    );
    await screenshot("07-reference-image-fixture.png");
    await page.clock.runFor(20000);
    assert.equal(
      await page.locator('[data-reference-state="ready"]').count(),
      1,
    );
    pass(
      "Verified reference images render freely with authorship, license and resilient post-load state",
    );
    const postsBefore = providerPosts.length,
      downloadsBefore = await page.evaluate(() => window.__downloads);
    await send("Prepare um PDF desta análise");
    await page
      .getByRole("button", { name: "Baixar PDF", exact: true })
      .waitFor();
    assert.equal(providerPosts.length, postsBefore);
    assert.equal(
      await page.evaluate(() => window.__downloads),
      downloadsBefore,
    );
    await screenshot("08-conversational-pdf.png");
    assert.ok(
      await page.evaluate(() =>
        window.__canvasText.join(" ").includes("Autor simulado para teste"),
      ),
    );
    pass(
      "Conversation prepares the existing complete result locally and waits for explicit download interaction",
    );
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
    const file = await download;
    assert.match(file.suggestedFilename(), /\.pdf$/);
    const b64 = await page.evaluate(async () => {
      const bytes = new Uint8Array(
        await window.__exports["application/pdf"].arrayBuffer(),
      );
      let s = "";
      for (let i = 0; i < bytes.length; i += 32768)
        s += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return btoa(s);
    });
    await fs.writeFile(
      path.join(out, "conversation-report.pdf"),
      Buffer.from(b64, "base64"),
    );
    pass(
      "Explicit browser download receives a valid PDF with source and license credits",
    );
    await send("Envie esse PDF para outra pessoa");
    assert.equal(providerPosts.length, postsBefore);
    assert.equal(
      await page.evaluate(() => window.__downloads),
      downloadsBefore + 1,
    );
    assert.ok(
      await page.evaluate(() =>
        window.__utterances
          .at(-1)
          .text.includes("Nenhuma dessas ações foi executada"),
      ),
    );
    pass(
      "External saving and sharing are never claimed or executed by the local conversation action",
    );
    for (const [name, width, height] of [
      ["phone", 390, 844],
      ["small-phone", 320, 740],
      ["landscape", 960, 540],
    ]) {
      await page.setViewportSize({ width, height });
      await send(
        "Apresente a composição",
        make("responsive-" + name, [
          {
            id: "map",
            kind: "map",
            region: "BR",
            title: "Brasil e suas regiões",
            focusRegions: ["33"],
            focusLabel: "Rio de Janeiro",
            caption: "Limites estaduais atuais como referência regional.",
          },
        ]),
      );
      await page.clock.runFor(3000);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const collision = await page.locator(".cinema-primary").evaluate((e) => {
        const b = e.getBoundingClientRect(),
          dock = document
            .querySelector(".dock-controls")
            .getBoundingClientRect();
        return b.bottom > dock.top;
      });
      assert.equal(collision, false);
      await screenshot("09-" + name + ".png");
      pass(name + " keeps spatial content clear of essential controls");
    }
    await page.goto(base + "/configuracoes");
    await page
      .getByText("Comparar vozes e opções de evolução", { exact: true })
      .click();
    const initial = await page.evaluate(() =>
      localStorage.getItem("jarvis.voice.preferences.v1"),
    );
    await page
      .getByRole("button", { name: "Ouvir Voz pt-BR A · natural", exact: true })
      .click();
    await finishSpeech();
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("jarvis.voice.preferences.v1"),
      ),
      initial,
    );
    await page
      .getByRole("button", { name: "Usar Voz pt-BR B", exact: true })
      .click();
    const preference = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("jarvis.voice.preferences.v1")),
    );
    assert.equal(preference.voiceURI, "fixture-br-b");
    assert.equal(preference.pitch, 1);
    await screenshot("10-voice-comparison.png");
    pass(
      "Voice comparison plays actual adapter samples and persists only an explicit selection",
    );
    assert.deepEqual(errors, []);
    pass(
      "Full flow leaves no uncaught browser errors or unintended model calls",
    );
    await context.close();
    const unauth = await browser.newContext();
    const p = await unauth.newPage();
    assert.equal(
      (
        await p.request.get(base + "/api/director/images?title=File:Rio.jpg")
      ).status(),
      401,
    );
    assert.equal(
      (
        await p.request.post(base + "/api/director/research", {
          data: { query: "Mostre uma imagem de Rio" },
        })
      ).status(),
      401,
    );
    await unauth.close();
    pass("New research and image metadata paths preserve owner authentication");
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
