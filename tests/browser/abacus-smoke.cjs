const { chromium } = require("playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3147",
  out = process.env.TEST_OUTPUT_DIR || "work/abacus-evidence";
const sse = (text) =>
  "data: " +
  JSON.stringify({ type: "delta", text: text.slice(0, 5) }) +
  "\n\ndata: " +
  JSON.stringify({ type: "delta", text: text.slice(5) }) +
  "\n\ndata: " +
  JSON.stringify({
    type: "done",
    text,
    model: "mock-routed-model",
    usage: {
      promptTokens: 80,
      completionTokens: 20,
      totalTokens: 100,
      cachedTokens: 0,
    },
  }) +
  "\n\n";
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const results = [];
  try {
    for (const [name, width, height, mobile] of [
      ["desktop", 1440, 1000, false],
      ["mobile", 390, 844, true],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: mobile,
        isMobile: mobile,
        reducedMotion: "reduce",
      });
      await context.addInitScript(() => {
        window.__utterances = [];
        window.__current = null;
        const api = new EventTarget();
        api.getVoices = () => [
          {
            voiceURI: "test-br",
            lang: "pt-BR",
            name: "Voz simulada",
            default: true,
            localService: true,
          },
        ];
        api.cancel = () => {
          const u = window.__current;
          window.__current = null;
          u?.onerror?.({ error: "cancelled" });
        };
        api.speak = (u) => {
          window.__current = u;
          window.__utterances.push(u.text);
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
        window.__finish = () => {
          const u = window.__current;
          window.__current = null;
          u?.onend?.();
        };
      });
      const page = await context.newPage(),
        calls = [],
        errors = [];
      let statusCalls = 0;
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/api/director/abacus", async (route) => {
        if (route.request().method() === "GET") {
          statusCalls++;
          return route.fulfill({
            json: {
              configured: true,
              paidCallsAllowed: false,
              callsPerHour: 0,
              tokenLimitPerHour: 60000,
              telemetry: {
                completed: 2,
                failed: 0,
                totalTokens: 200,
                promptTokens: 160,
                completionTokens: 40,
                cachedTokens: 0,
                unknownUsage: 0,
                unverifiedReservedTokens: 0,
                models: { "mock-routed-model": 2 },
              },
            },
          });
        }
        const request = JSON.parse(route.request().postData());
        calls.push(request);
        return route.fulfill({
          body: sse(
            calls.length === 1
              ? "Anotei o contexto da KIRO nesta conversa."
              : "O projeto informado é KIRO TV.",
          ),
          contentType: "text/event-stream; charset=utf-8",
        });
      });
      await page.goto(base);
      await page
        .getByRole("button", { name: "Escrever mensagem", exact: true })
        .click();
      const input = page.getByRole("textbox", {
        name: "Mensagem para o Jarvis",
      });
      await input.fill("Meu projeto é KIRO TV");
      await page
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      if (!mobile) {
        await page.waitForFunction(() => !!window.__current);
        assert.equal(
          await page
            .getByText("Anotei o contexto da KIRO nesta conversa.", {
              exact: true,
            })
            .count(),
          0,
        );
        await page.evaluate(() => window.__finish());
      } else
        await page
          .getByText("Anotei o contexto da KIRO nesta conversa.", {
            exact: true,
          })
          .waitFor();
      await page.locator("main[data-state=idle]").waitFor();
      await input.fill("Qual projeto eu informei?");
      await page
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      if (!mobile) {
        await page.waitForFunction(() => !!window.__current);
        await page.evaluate(() => window.__finish());
      } else
        await page
          .getByText("O projeto informado é KIRO TV.", { exact: true })
          .waitFor();
      await page.locator("main[data-state=idle]").waitFor();
      assert.equal(calls.length, 2);
      assert.equal(calls[1].stream, true);
      assert.ok(
        calls[1].history.some(
          (x) => x.role === "user" && x.content === "Meu projeto é KIRO TV",
        ),
      );
      assert.ok(
        calls[1].history.some(
          (x) =>
            x.role === "assistant" &&
            x.content === "Anotei o contexto da KIRO nesta conversa.",
        ),
      );
      assert.equal(statusCalls, 0);
      await page.screenshot({
        path: path.join(out, name + "-conversation.png"),
        fullPage: true,
      });
      await page.route("**/api/director/connections", (route) =>
        route.fulfill({
          json: {
            items: [
              {
                id: "abacus-ai",
                name: "Abacus AI",
                category: "Conversas e agentes",
                status: "not_connected",
                integration: "requires_provider_review",
              },
            ],
          },
        }),
      );
      await page.goto(base + "/conexoes");
      await page
        .getByRole("heading", { name: "Central de Conexões", exact: true })
        .waitFor();
      assert.equal(statusCalls, 0);
      await page
        .getByRole("button", { name: "Consultar estado da Abacus" })
        .click();
      await page.getByText(/Tokens informados: 200/).waitFor();
      await page.getByText(/Uso pago: bloqueado/).waitFor();
      assert.equal(statusCalls, 1);
      assert.equal(calls.length, 2);
      await page.screenshot({
        path: path.join(out, name + "-connections.png"),
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal(
        (await page.request.get(base + "/api/director/connections")).status(),
        401,
      );
      assert.equal(
        (await page.request.post(base + "/api/voice")).status(),
        401,
      );
      results.push({
        viewport: name,
        streaming: true,
        sessionHistory: true,
        desktopVoicePreserved: !mobile,
        mobileTranscriptPreserved: mobile,
        connections: true,
        noPaidCalls: true,
      });
      await context.close();
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    let attempts = 0;
    await page.route("**/api/director/abacus", (route) => {
      attempts++;
      return route.fulfill({
        status: 429,
        json: {
          error: "Limite temporário da Abacus",
          code: "ABACUS_RATE_LIMIT",
          retryAfterSeconds: 20,
        },
      });
    });
    await page.goto(base);
    await page
      .getByRole("button", { name: "Escrever mensagem", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Mensagem para o Jarvis" })
      .fill("Pedido de teste");
    await page
      .getByRole("button", { name: "Enviar mensagem", exact: true })
      .click();
    await page
      .getByRole("alert")
      .getByText("Limite temporário da Abacus", { exact: true })
      .waitFor();
    await page.waitForTimeout(700);
    assert.equal(attempts, 1);
    assert.equal(await page.locator(".response-hud").count(), 0);
    await context.close();
    results.push({
      scenario: "429 without automatic retry or false answer",
      passed: true,
    });
    const denied = await browser.newContext();
    const dp = await denied.newPage();
    assert.equal(
      (
        await dp.request.post(base + "/api/director/abacus", {
          data: { message: "Teste" },
        })
      ).status(),
      401,
    );
    assert.equal(
      (await dp.request.get(base + "/api/director/abacus")).status(),
      401,
    );
    assert.equal(
      (await dp.request.get(base + "/api/director/connections")).status(),
      401,
    );
    await denied.close();
    results.push({
      scenario: "real local endpoints reject unauthenticated requests",
      passed: true,
    });
    await fs.writeFile(
      path.join(out, "abacus-results.json"),
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
