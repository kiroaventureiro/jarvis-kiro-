const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHmac } = require("node:crypto");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/cognitive-v4/browser";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Loopback fixture only");
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const results = [],
    pass = (s) => {
      results.push({ scenario: s, passed: true });
      console.log("PASS " + s);
    };
  try {
    const context = await browser.newContext({
      viewport: { width: 1500, height: 1000 },
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
    const req = context.request,
      post = (data) =>
        req.post(base + "/api/director/connectors", {
          headers: { Origin: base },
          data,
        }),
      ask = async (message) => {
        const r = await req.post(base + "/api/director/abacus", {
          headers: { Origin: base },
          data: { message },
        });
        assert.equal(r.status(), 200, await r.text());
        return r.json();
      };
    const anon = await browser.newContext();
    assert.equal(
      (
        await anon.request.post(base + "/api/director/abacus", {
          data: { message: "Analise Guardiões da Origem" },
        })
      ).status(),
      401,
    );
    await anon.close();
    pass("Owner authentication remains required for cognitive reads");
    for (const [provider, id] of [
      ["github", "owner/project"],
      ["vercel", "prj_dev"],
      ["supabase", "dev-project"],
    ]) {
      let r = await post({
        op: "token",
        provider,
        token: "ghp_fake_browser_token_123456789",
      });
      assert.equal(r.status(), 200, await r.text());
      r = await post({
        op: "scope",
        provider,
        resources: [
          { id, environment: "development", kiroProject: "universo-kiro" },
        ],
        grants: ["read"],
      });
      assert.equal(r.status(), 200, await r.text());
    }
    pass(
      "Fixture accounts use real encrypted vault and exact project scope through application routes",
    );
    let r = await ask("Analise Guardiões da Origem no Git Hub");
    assert.ok(r.cognitive);
    assert.deepEqual(
      r.cognitive.evidence.map((e) => e.resource),
      ["owner/project"],
    );
    pass("Natural typed alias resolves only the authorized repository");
    r = await ask("E na Versel?");
    assert.deepEqual(
      r.cognitive.evidence.map((e) => e.resource),
      ["prj_dev"],
    );
    pass("Follow-up resolves the same project in another provider");
    r = await ask("E o que você encontrou nesse projeto?");
    assert.equal(r.cognitive.temporal, "previous");
    assert.match(r.text, /não fiz uma nova consulta/);
    pass(
      "Follow-up recalls structured evidence with explicit previous-query provenance",
    );
    await ask("Agora verifique os deployments");
    r = await ask("Compare esse resultado com o anterior");
    assert.equal(r.visual.modules[1].kind, "compare");
    assert.match(r.text, /horários distintos/);
    pass(
      "Current versus previous query comparison preserves temporal distinction",
    );
    r = await ask("Analise Quiro Gestão no Git Hub e Versel");
    assert.ok(!r.cognitive);
    assert.match(r.text, /não está autorizado/);
    assert.ok(!r.text.includes("owner/project"));
    pass("Unauthorized Kiro Gestão is never replaced by another project");
    r = await ask("Corrija Guardiões da Origem na Vercel");
    assert.match(r.text, /aprove-o individualmente/);
    assert.ok(!r.result);
    pass("Modification requests stop at individual plan approval");
    r = await ask("Diagnostique profundamente Guardiões da Origem no Git Hub");
    assert.ok(r.cognitive.evidence.some((e) => e.operation === "checks"));
    assert.ok(r.cognitive.evidence.some((e) => e.operation === "file"));
    assert.ok(!/\b[a-f0-9]{40}\b/.test(r.text));
    pass(
      "Deep diagnosis inspects exact checks and manifesto without narrating machine references",
    );
    await context.addInitScript(() => {
      window.__spoken = [];
      window.__cancelled = 0;
      window.__current = null;
      const api = new EventTarget();
      api.getVoices = () => [
        {
          voiceURI: "fixture-br",
          name: "Voz de teste",
          lang: "pt-BR",
          localService: true,
          default: true,
        },
      ];
      api.speak = (u) => {
        window.__spoken.push(u.text);
        window.__current = u;
        queueMicrotask(() => u.onstart?.());
      };
      api.cancel = () => {
        window.__current = null;
        window.__cancelled++;
      };
      api.pause = () => {};
      api.resume = () => {};
      Object.defineProperty(window, "speechSynthesis", {
        value: api,
        configurable: true,
      });
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text;
        }
      };
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/i.test(type) ? null : original.call(this, type, ...args);
      };
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    async function type(message) {
      if (!(await page.getByRole("textbox", { name: "Mensagem para o Jarvis" }).isVisible())) await page.getByRole("button", { name: "Escrever mensagem", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill(message);
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/director/abacus") &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      await response;
      await page.locator(".cinema-root").waitFor();
    }
    await type("Analise em detalhes Guardiões da Origem no Git Hub");
    await page.waitForFunction(() => window.__spoken.length > 0);
    assert.ok(
      (await page.evaluate(() => window.__spoken)).every(
        (t) => !/[a-f0-9]{40}|apiKey|access_token|\{"/.test(t),
      ),
    );
    await page.screenshot({
      path: path.join(out, "01-evidence-narration.png"),
    });
    pass(
      "Typed UI renders evidence-linked holograms and speaks an analytical script instead of JSON",
    );
    const cancelled = await page.evaluate(() => window.__cancelled);
    await type("Agora verifique os deployments");
    assert.ok(await page.evaluate((n) => window.__cancelled > n, cancelled));
    pass(
      "A new question cancels old narration while preserving project context",
    );
    await post({
      op: "scope",
      provider: "vercel",
      resources: [],
      grants: ["read"],
    });
    r = await ask("O que encontrou nesse projeto?");
    assert.match(r.text, /Não há evidência anterior/);
    pass("Revocation removes historical resource access before answering");
    assert.deepEqual(errors, []);
    pass("Full cognitive browser flow has no uncaught page errors");
    await fs.writeFile(
      path.join(out, "results.json"),
      JSON.stringify(results, null, 2),
    );
    console.log(results.length + " scenarios passed");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
