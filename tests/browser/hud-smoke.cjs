const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3147";
const out = process.env.TEST_OUTPUT_DIR || "work/ui-evidence";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const results = [];
  await fs.mkdir(out, { recursive: true });
  try {
    for (const [name, width, height] of [
      ["desktop", 1440, 1000],
      ["iphone", 390, 844],
      ["small-phone", 320, 740],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        window.__stopped = 0;
        window.__micRequests = 0;
        window.__sent = [];
        class Channel extends EventTarget {
          constructor() {
            super();
            this.readyState = "connecting";
            window.__dc = this;
          }
          send(raw) {
            const event = JSON.parse(raw);
            window.__sent.push(event);
            if (event.type === "response.create") {
              const emit = (e) => this.onmessage?.({ data: JSON.stringify(e) });
              emit({ type: "response.created" });
              emit({
                type: "response.output_audio_transcript.delta",
                item_id: "test-answer",
                delta: "Resposta de teste do HUD. ",
              });
              emit({
                type: "response.output_audio_transcript.delta",
                item_id: "test-answer",
                delta: "O conteúdo permanece legível e pode ser expandido.",
              });
              emit({
                type: "response.done",
                response: { status: "completed" },
              });
            }
          }
          close() {
            this.readyState = "closed";
            this.dispatchEvent(new Event("close"));
            this.onclose?.();
          }
        }
        window.RTCPeerConnection = class {
          constructor() {
            this.connectionState = "new";
          }
          createDataChannel() {
            return (this.dc = new Channel());
          }
          addTransceiver() {}
          addTrack() {}
          async createOffer() {
            return { type: "offer", sdp: "mock-sdp" };
          }
          async setLocalDescription() {}
          async setRemoteDescription() {
            this.dc.readyState = "open";
            this.dc.dispatchEvent(new Event("open"));
            this.dc.onopen?.();
          }
          close() {
            this.connectionState = "closed";
            this.dc?.close();
          }
        };
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: {
            getUserMedia: async () => {
              window.__micRequests++;
              return {
                getTracks: () => [
                  {
                    enabled: true,
                    stop() {
                      window.__stopped++;
                    },
                  },
                ],
                getAudioTracks: () => [],
              };
            },
          },
        });
      });
      await page.route("**/api/voice", (route) =>
        route.fulfill({ json: { value: "test-ephemeral-placeholder" } }),
      );
      await page.route("https://api.openai.com/**", (route) =>
        route.fulfill({ body: "mock-answer", contentType: "application/sdp" }),
      );
      await page.route("**/api/director/abacus", (route) =>
        route.fulfill({
          json: {
            text: "Resposta de teste do HUD. O conteúdo permanece legível e pode ser expandido.",
            model: "route-llm",
            usage: null,
          },
        }),
      );
      await page.goto(base);
      await page
        .getByRole("button", { name: "Escrever mensagem", exact: true })
        .waitFor();
      assert.equal(await page.locator(".response-hud").count(), 0);
      assert.equal(await page.locator("main article").count(), 0);
      assert.equal(
        await page.evaluate(
          () => navigator.mediaDevices && window.__micRequests,
        ),
        0,
      );
      await page.screenshot({
        path: path.join(out, name + "-idle.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Escrever mensagem", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill("Olá, Jarvis");
      await page.getByRole("button", { name: "Enviar mensagem" }).click();
      await page
        .getByText("Resposta de teste do HUD.", { exact: false })
        .waitFor();
      await page.locator("main[data-state=idle]").waitFor();
      assert.equal(await page.evaluate(() => window.__micRequests), 0);
      assert.equal(await page.evaluate(() => window.__sent.length), 0);
      await page.getByRole("button", { name: "Expandir", exact: true }).click();
      await page.screenshot({
        path: path.join(out, name + "-hud.png"),
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const dock = await page.locator(".interaction-dock").boundingBox();
      const hud = await page.locator(".response-hud").boundingBox();
      assert.ok(dock && hud);
      if (width <= 850)
        assert.ok(
          hud.y + hud.height <= dock.y + 2,
          "HUD must not overlap controls",
        );
      assert.equal(await page.locator(".response-hud").count(), 1);
      await page
        .getByRole("button", { name: "Ativar microfone", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Desativar microfone", exact: true })
        .waitFor();
      assert.equal(await page.evaluate(() => window.__micRequests), 1);
      await page.getByRole("button", { name: "Encerrar sessão" }).click();
      assert.ok(await page.evaluate(() => window.__stopped >= 1));
      await page.getByRole("button", { name: "Abrir navegação" }).click();
      assert.equal(await page.locator("nav a").count(), 7);
      await page.getByRole("link", { name: "Integrações" }).click();
      await page
        .getByRole("heading", { name: "Central de conexões" })
        .waitFor();
      await page.getByRole("button", { name: "+ Adicionar conexão" }).click();
      await page.getByLabel("Provedor", { exact: true }).fill("OpenAI Estúdio");
      await page
        .getByLabel("Categoria", { exact: true })
        .fill("Inteligência artificial");
      await page
        .getByLabel("Finalidade", { exact: true })
        .fill("Conversa da equipe");
      await page.getByLabel("Identificação da conta").fill("Equipe Kiro");
      await page
        .getByRole("button", { name: "Salvar cadastro planejado" })
        .click();
      await page
        .getByRole("textbox", { name: "Pesquisar conexões" })
        .fill("OpenAI Estúdio");
      assert.equal(await page.locator("details").count(), 1);
      await page.reload();
      await page
        .getByRole("textbox", { name: "Pesquisar conexões" })
        .fill("OpenAI Estúdio");
      assert.equal(await page.locator("details").count(), 1);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      for (const area of ["memoria", "projetos", "controle", "diagnostico"]) {
        await page.goto(base + "/" + area);
        await page
          .getByRole("heading", { name: "Acesso do proprietário" })
          .waitFor();
      }
      await page.goto(base + "/configuracoes");
      await page
        .getByRole("button", { name: "Entrar com dispositivo" })
        .waitFor();
      assert.deepEqual(errors, []);
      results.push({ viewport: name, passed: true });
      await context.close();
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route("**/api/voice", (r) =>
      r.fulfill({ status: 401, json: { error: "Não autorizado." } }),
    );
    await page.goto(base);
    await page
      .getByRole("button", { name: "Ativar microfone", exact: true })
      .click();
    await page
      .getByRole("alert")
      .getByText("Não autorizado.", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Ativar microfone", exact: true })
        .isEnabled(),
      true,
    );
    results.push({
      scenario: "unauthorized voice fails without fake connection",
      passed: true,
    });
    await context.close();
    await fs.writeFile(
      path.join(out, "results.json"),
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
