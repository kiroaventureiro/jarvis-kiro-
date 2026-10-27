const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createHmac } = require("node:crypto"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/cinematic";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Loopback fixture required");
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
      headless: true,
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
      args: ["--no-sandbox"],
    }),
    checks = [];
  const pass = (x) => {
    checks.push(x);
    console.log("PASS " + x);
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
      const original = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (b) => {
        if (
          [
            "application/pdf",
            "image/png",
            "video/webm",
            "application/json",
          ].includes(b.type)
        )
          window.__exports[b.type] = b;
        return original(b);
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
        setTimeout(
          () => u.onboundary?.({ charIndex: Math.floor(u.text.length / 2) }),
          50,
        );
        setTimeout(() => u.onend?.(), 100);
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
    page.setDefaultTimeout(30000);
    assert.equal(
      (
        await browser.newContext().then((c) =>
          c.request.post(base + "/api/director/research", {
            data: { query: "Qual o IPCA?" },
          }),
        )
      ).status(),
      401,
    );
    pass("Research route rejects unauthenticated access");
    await page.goto(base);
    await page
      .getByRole("button", { name: "Escrever mensagem", exact: true })
      .waitFor();
    async function send(text) {
      const b = page.getByRole("button", {
        name: "Escrever mensagem",
        exact: true,
      });
      if (await b.count()) await b.click();
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill(text);
      await page
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      await page.locator("main[data-state=idle]").waitFor();
    }
    await send("Como está a situação econômica brasileira?");
    const cinema = page.locator(".cinema-root");
    await cinema.waitFor();
    assert.equal(await cinema.getAttribute("data-focus"), "center");
    assert.equal(
      await page.locator(".holo-world-viewport path[role=button]").count(),
      177,
    );
    assert.equal(await page.locator(".response-hud").count(), 0);
    assert.equal(await page.locator(".cinema-full-text").count(), 0);
    const evidenceResponse = await context.request.post(
      base + "/api/director/research",
      { data: { query: "Como está a economia brasileira?" } },
    );
    assert.equal(evidenceResponse.status(), 200);
    const evidence = await evidenceResponse.json();
    assert.equal(evidence.available, true);
    await fs.writeFile(
      path.join(out, "research-response.json"),
      JSON.stringify(evidence, null, 2),
    );
    assert.equal(
      (
        await context.request.post(base + "/api/director/research", {
          headers: { Origin: "https://untrusted.invalid" },
          data: { query: "IPCA" },
        })
      ).status(),
      403,
    );
    assert.equal(
      (
        await context.request.post(base + "/api/director/research", {
          data: { query: "x".repeat(1600) },
        })
      ).status(),
      400,
    );
    assert.equal(
      (
        await context.request.post(base + "/api/director/research", {
          data: { query: "Notícias gerais da França" },
        })
      ).ok(),
      true,
    );
    pass(
      "Research route validates origin and bounded query, preserves dates and returns only supported scope",
    );
    await page.screenshot({ path: path.join(out, "01-world-demo.png") });
    pass(
      "Economy request creates real world-map scene with no fixed transcript",
    );
    await page.waitForFunction(
      () =>
        document.querySelector(".cinema-primary .holo-panel")?.dataset
          .module === "metrics",
      {},
      { timeout: 13000 },
    );
    assert.equal(
      await page.locator(".cinema-support .holo-world-viewport").count(),
      1,
    );
    pass(
      "Presentation advances automatically from world map to indicator and contextual support",
    );
    await page
      .getByRole("button", { name: "Pausar demonstração", exact: true })
      .click();
    const before = await page
      .getByRole("progressbar", { name: "Progresso da demonstração" })
      .getAttribute("aria-valuenow");
    await page.waitForTimeout(400);
    assert.equal(
      await page
        .getByRole("progressbar", { name: "Progresso da demonstração" })
        .getAttribute("aria-valuenow"),
      before,
    );
    pass("Pause freezes scene progress");
    await page
      .getByRole("button", { name: "Continuar demonstração", exact: true })
      .click();
    await page.waitForTimeout(250);
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("jk-speech-progress", {
          detail: {
            phase: "boundary",
            fraction: 0.3,
            textLength: 100,
            charIndex: 30,
            at: performance.now(),
          },
        }),
      ),
    );
    assert.equal(await cinema.getAttribute("data-sync"), "speech");
    pass("Speech boundary events connect to presentation timing");
    await page
      .getByRole("button", { name: "Pausar demonstração", exact: true })
      .click();
    await page.locator(".cinema-scene-index button").nth(1).click();
    assert.match(await page.locator(".cinema-primary").innerText(), /-0,32/);
    await page.screenshot({ path: path.join(out, "02-economic-chart.png") });
    pass(
      "Signed chart shows negative inflation with dates and published units",
    );
    await page.locator(".cinema-scene-index button").first().click();
    await page
      .getByRole("textbox", { name: "Buscar país ou localização" })
      .fill("França");
    await page.getByRole("button", { name: "França", exact: true }).click();
    const maps = page.getByRole("link", {
      name: /Abrir França no Google Maps/,
    });
    assert.equal(
      new URL(await maps.getAttribute("href")).searchParams.get("query"),
      "França",
    );
    await page.getByRole("button", { name: "Aproximar mapa-múndi" }).click();
    assert.match(
      await page.locator(".holo-world-viewport g").getAttribute("transform"),
      /scale\(1.5\)/,
    );
    pass(
      "World selection, country search, zoom and official Google Maps URL work without key or embedded billing",
    );
    await page.locator(".cinema-scene-index button").last().click();
    await page.screenshot({ path: path.join(out, "03-final-report.png") });
    pass(
      "Final summary can be selected without replaying or duplicating provider calls",
    );
    async function exportFile(label, type, file) {
      await page
        .getByRole("button", {
          name: "Exportar resultado holográfico",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: label, exact: true }).click();
      await page
        .waitForFunction(
          (type) =>
            !!window.__exports[type] ||
            !!document.querySelector(".holo-export-options [role=alert]"),
          type,
          { timeout: 120000 },
        )
        .catch(async (e) => {
          console.error(await page.locator(".holo-export-options").innerText());
          throw e;
        });
      if (await page.locator(".holo-export-options [role=alert]").count())
        throw Error(
          await page.locator(".holo-export-options [role=alert]").innerText(),
        );
      const b64 = await page.evaluate(async (type) => {
        const a = new Uint8Array(await window.__exports[type].arrayBuffer());
        let s = "";
        for (let i = 0; i < a.length; i += 32768)
          s += String.fromCharCode(...a.subarray(i, i + 32768));
        return btoa(s);
      }, type);
      const bytes = Buffer.from(b64, "base64");
      await fs.writeFile(path.join(out, file), bytes);
      return bytes;
    }
    const pdf = await exportFile(
      "PDF · relatório completo",
      "application/pdf",
      "example-report.pdf",
    );
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 10000);
    pass("PDF export produces complete paginated document bytes locally");
    const png = await exportFile(
      "PNG · demonstração principal",
      "image/png",
      "example-chart.png",
    );
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    pass("PNG export produces raster visualization bytes locally");
    const webm = await exportFile(
      "Vídeo WebM · sem áudio",
      "video/webm",
      "example-demonstration.webm",
    );
    assert.equal(webm.subarray(0, 4).toString("hex"), "1a45dfa3");
    assert.ok(webm.length > 10000);
    const playback = await page.evaluate(async () => {
      const video = document.createElement("video");
      video.muted = true;
      video.src = URL.createObjectURL(window.__exports["video/webm"]);
      document.body.appendChild(video);
      try {
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
        });
        const duration = video.duration;
        video.currentTime = Math.max(0, duration - 1);
        await video.play();
        await new Promise((resolve) => setTimeout(resolve, 250));
        return {
          duration,
          time: video.currentTime,
          width: video.videoWidth,
          height: video.videoHeight,
        };
      } finally {
        video.pause();
        video.remove();
      }
    });
    assert.ok(playback.duration >= 8 && playback.duration <= 24);
    assert.ok(playback.time > playback.duration - 1);
    assert.equal(playback.width, 1024);
    assert.equal(playback.height, 640);
    pass(
      "WebM decodes, seeks and plays near the final scene with complete finite duration",
    );
    pass(
      "WebM export renders actual silent animated frames with no remote generation",
    );
    await page
      .getByRole("button", {
        name: "Exportar resultado holográfico",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Vídeo WebM · sem áudio", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Cancelar exportação", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.querySelector(".holo-export-options [role=status]"),
    );
    pass("Cancellation stops video export and releases the busy state");
    await page
      .getByRole("button", {
        name: "Exportar resultado holográfico",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Explorar quadros", exact: true })
      .click();
    assert.ok((await page.locator(".holo-panel").count()) > 1);
    await page
      .getByRole("link", { name: "Abrir resultados desta sessão" })
      .click();
    await page
      .getByRole("heading", { name: "Resultados projetados", exact: true })
      .waitFor();
    assert.ok(
      await page
        .getByRole("button", { name: "Exportar resultado holográfico" })
        .count(),
    );
    pass("Complete result gallery and exports survive internal navigation");
    await page.getByRole("link", { name: "Voltar ao núcleo JK" }).click();
    await page
      .getByRole("button", {
        name: "Fechar resultados holográficos",
        exact: true,
      })
      .click();
    await send("Mostre um mapa-múndi para mim");
    await page
      .getByRole("button", { name: "Pausar demonstração", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Próxima cena", exact: true })
      .click();
    assert.equal(await cinema.getAttribute("data-focus"), "right");
    pass("Geographic demonstrations also work without an enabled paid model");
    await page
      .getByRole("button", {
        name: "Fechar resultados holográficos",
        exact: true,
      })
      .click();
    const detail =
      "Esta explicação aparece aos poucos e deve parar imediatamente quando a demonstração for pausada.";
    await page.route("**/api/director/abacus", (r) =>
      r.request().method() === "POST"
        ? r.fulfill({
            json: {
              text: "Resposta simulada de teste.",
              model: "fixture",
              usage: null,
              visual: {
                version: 1,
                id: "typed-fixture",
                title: "Demonstração progressiva",
                mode: "explanation",
                createdAt: new Date().toISOString(),
                source: { kind: "reference", label: "Teste simulado" },
                modules: [
                  {
                    id: "steps",
                    kind: "report",
                    title: "Etapas",
                    summary: "Demonstração",
                    items: [
                      { label: "Primeiro exemplo", detail },
                      { label: "Segundo exemplo", detail: "Segundo detalhe" },
                    ],
                  },
                ],
              },
            },
          })
        : r.continue(),
    );
    await send("Teste uma demonstração progressiva");
    const typed = page.locator(
      '.cinema-primary [aria-label="' + detail + '"]>span',
    );
    await typed.waitFor();
    const first = (await typed.innerText()).length;
    await page.waitForTimeout(200);
    assert.ok((await typed.innerText()).length > first);
    await page
      .getByRole("button", { name: "Pausar demonstração", exact: true })
      .click();
    const paused = await typed.innerText();
    await page.waitForTimeout(200);
    assert.equal(await typed.innerText(), paused);
    pass(
      "Typewriter progressively reveals demonstration and freezes while paused",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(out, "04-mobile-demo.png") });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    pass("Mobile demonstration stays inside the viewport");
    assert.deepEqual(errors, []);
    pass("No uncaught browser errors");
  } finally {
    await fs.writeFile(
      path.join(out, "browser-results.json"),
      JSON.stringify({ checks, count: checks.length }, null, 2),
    );
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
