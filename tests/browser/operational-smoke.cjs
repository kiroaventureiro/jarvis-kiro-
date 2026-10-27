const { chromium } = require("playwright"),
  { createHmac } = require("node:crypto"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://localhost:3151",
  out = process.env.TEST_OUTPUT_DIR || "work/operational-evidence";
const expiry = String(Date.now() + 600000),
  session =
    expiry +
    "." +
    createHmac("sha256", "jarvis-operational-test-session-only-2026")
      .update(expiry)
      .digest("hex");
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
      await context.addCookies([
        {
          name: "jarvis_session",
          value: session,
          url: base,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      await context.addInitScript(() => {
        window.__current = null;
        window.__spoken = [];
        const synth = new EventTarget();
        synth.getVoices = () => [
          {
            voiceURI: "test-br",
            lang: "pt-BR",
            name: "Voz simulada",
            localService: true,
            default: true,
          },
        ];
        synth.speak = (u) => {
          window.__current = u;
          window.__spoken.push(u.text);
        };
        synth.cancel = () => {
          const u = window.__current;
          window.__current = null;
          u?.onerror?.({ error: "cancelled" });
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
        window.__finish = () => {
          const u = window.__current;
          window.__current = null;
          u?.onend?.();
        };
      });
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const verified = await page.request.get(
        base + "/api/director/operational-status?verify=1",
      );
      assert.equal(verified.status(), 200);
      const snapshot = await verified.json();
      const abacus = snapshot.integrations.find((x) => x.id === "abacus"),
        memory = snapshot.integrations.find((x) => x.id === "supabase-memory");
      assert.equal(abacus.state, "connection_validated");
      assert.equal(abacus.authorized, false);
      assert.equal(memory.state, "operational_authorized");
      assert.ok(memory.checks.includes("encrypted_read"));
      assert.ok(!memory.checks.includes("encrypted_write"));
      assert.equal(snapshot.catalog.total, 188);
      const director = await (
        await page.request.get(base + "/api/director")
      ).json();
      assert.equal(director.capabilities.abacus.status, "connection_validated");
      assert.equal(
        director.capabilities.supabase.status,
        "operational_authorized",
      );
      const readiness = await (
        await page.request.get(base + "/api/director/readiness-report")
      ).json();
      assert.equal(readiness.ecosystem.liveConnectionsVerified, 2);
      assert.equal(
        readiness.ecosystem.services.find((x) => x.name === "Supabase")
          .verified,
        true,
      );
      assert.ok(snapshot.projects.some((x) => x.name === "KIRO TV"));
      assert.doesNotMatch(
        JSON.stringify(snapshot),
        /fake-abacus|fake-supabase|CONTEUDO_INTERNO_DE_TESTE_NAO_EXIBIR|encrypted_history|supabase\.co/,
      );
      const questions = [
        "Jarvis, quais sistemas estão configurados?",
        "Jarvis, você está conectado à Abacus?",
        "Jarvis, sua memória Supabase funciona?",
        "Quais projetos da KIRO você conhece?",
        "Quais aplicativos ainda precisam ser conectados?",
      ];
      for (const message of questions) {
        const r = await page.request.post(base + "/api/director/abacus", {
          data: { message, stream: true },
        });
        assert.equal(r.status(), 200);
        const answer = await r.json();
        assert.equal(answer.model, "jarvis-operational");
        assert.equal(answer.provider, "local_operational");
        assert.doesNotMatch(
          answer.text,
          /nenhuma integração ativa|todos.{0,20}desconectados/i,
        );
      }
      const chat = await page.request.post(base + "/api/director/abacus", {
        data: { message: "Escreva um poema" },
      });
      assert.equal(chat.status(), 403);
      const budget = await (
        await page.request.get(base + "/api/director/abacus")
      ).json();
      assert.equal(budget.usage.calls, 0);
      assert.equal(budget.telemetry.attempts, 0);
      assert.equal(budget.paidCallsAllowed, false);
      const catalog = await (
        await page.request.get(base + "/api/director/connections")
      ).json();
      assert.equal(catalog.items.length, 188);
      await page.goto(base);
      await page
        .getByRole("button", { name: "Escrever mensagem", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill("Você está conectado à Abacus?");
      await page
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      if (!mobile) {
        await page
          .waitForFunction(() => !!window.__current)
          .catch(async (error) => {
            await page.screenshot({
              path: path.join(out, name + "-failure.png"),
              fullPage: true,
            });
            console.error({
              errors,
              state: await page.locator("main").getAttribute("data-state"),
              body: await page.locator("body").innerText(),
            });
            throw error;
          });
        assert.equal(await page.locator(".response-hud").count(), 0);
        const spoken = await page.evaluate(() => window.__spoken.at(-1));
        assert.match(spoken, /conexão validada/);
        await page.evaluate(() => window.__finish());
      } else
        await page
          .getByText(/O catálogo autenticado da API respondeu/)
          .waitFor();
      await page.locator("main[data-state=idle]").waitFor();
      await page.screenshot({
        path: path.join(out, name + "-answer.png"),
        fullPage: true,
      });
      await page.goto(base + "/conexoes");
      await page
        .getByRole("button", {
          name: "Verificar estado operacional",
          exact: true,
        })
        .click();
      await page
        .getByText("Abacus RouteLLM: Conexão validada.", { exact: true })
        .waitFor();
      await page
        .getByText(
          "Supabase e memória criptografada: Operacional e autorizado.",
          { exact: true },
        )
        .waitFor();
      await page.screenshot({
        path: path.join(out, name + "-status.png"),
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      results.push({
        viewport: name,
        realApplicationRoutes: true,
        upstreams: "test fixtures only",
        fiveQuestions: true,
        states: true,
        catalog188: true,
        noModelCalls: true,
        desktopVoiceOnly: !mobile,
        mobileTranscript: mobile,
      });
      await context.close();
    }
    const unauth = await browser.newContext();
    const p = await unauth.newPage();
    for (const endpoint of [
      "/api/director/operational-status?verify=1",
      "/api/director/profile",
      "/api/director",
      "/api/director/readiness-report",
      "/api/director/supabase-status",
      "/api/director/connections",
    ])
      assert.equal((await p.request.get(base + endpoint)).status(), 401);
    assert.equal(
      (
        await p.request.post(base + "/api/director/abacus", {
          data: { message: "Você está conectado à Abacus?" },
        })
      ).status(),
      401,
    );
    await unauth.close();
    results.push({
      scenario: "owner authentication required for facts and probes",
      passed: true,
    });
    await fs.writeFile(
      path.join(out, "operational-results.json"),
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
