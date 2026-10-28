const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createHmac } = require("node:crypto"),
  fs = require("node:fs/promises");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/abacus-hub/browser";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Loopback fixture required");
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const checks = [],
    pass = (s) => {
      checks.push({ scenario: s, passed: true });
      console.log("PASS " + s);
    };
  try {
    const anonymous = await browser.newContext();
    for (const suffix of ["hub", "media"]) {
      const r =
        suffix === "hub"
          ? await anonymous.request.get(
              base + "/api/director/abacus/hub?verify=1",
            )
          : await anonymous.request.post(base + "/api/director/abacus/media", {
              data: { kind: "image", model: "flux2", prompt: "A" },
            });
      assert.equal(r.status(), 401);
    }
    await anonymous.close();
    pass("Owner authentication enforced before discovery and media");
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      expiry = String(Date.now() + 3600000);
    await context.addCookies([
      {
        name: "jarvis_session",
        value:
          expiry +
          "." +
          createHmac("sha256", "jk-connectors-session-fixture-only-2026")
            .update(expiry)
            .digest("hex"),
        url: base,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    const request = context.request;
    assert.equal(
      (
        await request.put(base + "/api/director/abacus/hub", {
          headers: { Origin: "https://evil.invalid" },
          data: {},
        })
      ).status(),
      403,
    );
    assert.equal(
      (
        await request.post(base + "/api/director/abacus/media", {
          headers: { Origin: "https://evil.invalid" },
          data: { kind: "image", model: "flux2", prompt: "A" },
        })
      ).status(),
      403,
    );
    pass("Cross-site observation writes and generation blocked");
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/conexoes");
    await page
      .getByRole("button", {
        name: "Atualizar modelos e ferramentas da conta",
        exact: true,
      })
      .click();
    await page.getByText("Catálogo: verificado.", { exact: false }).waitFor();
    await page
      .getByText("Modelos e ferramentas descobertos", { exact: true })
      .click();
    assert.ok(
      (
        await page.getByLabel("Abacus: recursos e laboratório").innerText()
      ).includes("read_inventory"),
    );
    assert.ok(
      (
        await page.getByLabel("Abacus: recursos e laboratório").innerText()
      ).includes("execução não autorizada automaticamente"),
    );
    pass("Real UI discovers models and tools without executing them");
    await page
      .getByText("Observação privada da conta", { exact: true })
      .click();
    await page
      .getByLabel("Plano observado", { exact: true })
      .selectOption("Basic");
    await page
      .getByLabel("Créditos restantes observados", { exact: true })
      .fill("1000");
    await page
      .getByLabel("Serviços já conectados na Abacus", { exact: true })
      .fill("Gmail");
    await page
      .getByLabel("Opções no catálogo de conectores", { exact: true })
      .fill("48");
    await page
      .getByLabel("Opções no catálogo MCP", { exact: true })
      .fill("402");
    await page
      .getByLabel("Servidores MCP instalados", { exact: true })
      .fill("0");
    await page
      .getByRole("button", {
        name: "Salvar observação criptografada",
        exact: true,
      })
      .click();
    await page.getByText("Plano observado: Basic", { exact: false }).waitFor();
    const h = await (
      await request.get(base + "/api/director/abacus/hub")
    ).json();
    assert.equal(h.observation.remainingCredits, 1000);
    assert.equal(h.observation.source, "owner_observation");
    pass("Account observation persists through encrypted store and is dated");
    const ask = async (message) => {
      const r = await request.post(base + "/api/director/abacus", {
        headers: { Origin: base },
        data: { message },
      });
      assert.equal(r.status(), 200);
      return r.json();
    };
    const account = await ask(
      "Quais recursos da minha conta Abacus você conhece?",
    );
    assert.ok(account.text.includes("saldo observado era 1000"));
    assert.ok(account.text.includes("não é saldo em tempo real"));
    pass("Jarvis answers from actual catalog and dated account evidence");
    await page
      .getByText("Criar e analisar com a Abacus", { exact: true })
      .click();
    await page
      .getByLabel("Pedido para a Abacus", { exact: true })
      .fill("Uma nave de teste");
    await page
      .getByRole("button", {
        name: "Executar pedido com créditos autorizados",
        exact: true,
      })
      .click();
    await page
      .getByRole("img", { name: "Imagem sintética criada pela Abacus" })
      .waitFor();
    assert.ok(
      (
        await page
          .getByRole("img", { name: "Imagem sintética criada pela Abacus" })
          .getAttribute("src")
      ).startsWith("blob:"),
    );
    pass("Image adapter returns simulated output as browser-local media");
    await page
      .getByLabel("Tipo de tarefa", { exact: true })
      .selectOption("audio");
    await page
      .getByLabel("Pedido para a Abacus", { exact: true })
      .fill("Bom dia, áudio de teste");
    await page
      .getByRole("button", {
        name: "Executar pedido com créditos autorizados",
        exact: true,
      })
      .click();
    await page
      .locator('audio[aria-label="Áudio criado pela Abacus"]')
      .waitFor();
    pass("Audio adapter exposes controlled playback and download");
    assert.equal(
      (
        await request.post(base + "/api/director/abacus/media", {
          headers: { Origin: base },
          data: { kind: "image", model: "gpt_image2", prompt: "A" },
        })
      ).status(),
      403,
    );
    assert.equal(
      (
        await request.post(base + "/api/director/abacus/media", {
          headers: { Origin: base },
          data: {
            kind: "image",
            model: "flux2",
            prompt: "A",
            apiKey: "illegal",
          },
        })
      ).status(),
      400,
    );
    pass(
      "Model must be in live account catalog and client credentials are rejected",
    );
    const image =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
    const vision = await request.post(base + "/api/director/abacus/media", {
      headers: { Origin: base },
      data: { kind: "vision", model: "route-llm", prompt: "Descreva", image },
    });
    assert.equal(vision.status(), 200);
    assert.ok((await vision.json()).text.includes("Análise simulada"));
    pass(
      "Vision uses explicit uploaded image with no external action execution",
    );
    const scientific = await ask(
        "Pesquise artigos científicos sobre semicondutores",
      ),
      books = await ask("Busque livros sobre cinema");
    assert.equal(scientific.model, "jk-public-library");
    assert.equal(books.model, "jk-public-library");
    assert.ok(scientific.visual.sources[0].href.startsWith("https://doi.org/"));
    assert.ok(
      books.visual.sources[0].href.startsWith("https://openlibrary.org/"),
    );
    pass(
      "Two public connectors provide attributable bibliography through conversation",
    );
    await page.screenshot({
      path: out + "/01-abacus-hub.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(base + "/");
    await page
      .getByRole("button", { name: "Escrever mensagem", exact: true })
      .click();
    await page.getByRole("textbox").fill("Crie uma imagem de uma nave");
    await page.getByRole("textbox").press("Enter");
    await page
      .getByRole("img", { name: "Imagem gerada por IA", exact: true })
      .waitFor({ timeout: 20000 });
    assert.ok(
      (
        await page
          .getByRole("img", { name: "Imagem gerada por IA", exact: true })
          .getAttribute("src")
      ).startsWith("blob:"),
    );
    pass("Natural creation request renders generated local image in the HUD");
    await page.screenshot({
      path: out + "/02-generated-hud.png",
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/conexoes");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 2,
    );
    assert.equal(overflow, false);
    pass("Connection workbench remains usable on mobile");
    assert.deepEqual(errors, []);
    pass("No uncaught browser errors or real paid generations");
    await fs.writeFile(out + "/results.json", JSON.stringify(checks, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
