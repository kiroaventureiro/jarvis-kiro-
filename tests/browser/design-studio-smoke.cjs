const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHmac } = require("node:crypto");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/design-studio/browser";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Loopback fixture required");
(async () => {
  await fs.mkdir(out, { recursive: true });
  await fs.mkdir(path.join(out,"downloads"),{recursive:true});
  const browser = await chromium.launch({
      headless: true,
    downloadsPath:path.resolve(out,"downloads"),
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    }),
    results = [];
  const pass = (s) => {
    results.push(s);
    console.log("PASS " + s);
  };
  try {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
      }),
      expires = String(Date.now() + 3600000);
    await context.addCookies([
      {
        name: "jarvis_session",
        value:
          expires +
          "." +
          createHmac("sha256", "jk-connectors-session-fixture-only-2026")
            .update(expires)
            .digest("hex"),
        url: base,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);

    for (const message of [
      "Jarvis, quais projetos tenho na Abacus?",
      "Jarvis, verifica os projetos e deploys disponíveis na minha conta da Avacus.",
      "Verifique os projetos e deployments da Abagus",
    ]) {
      for (const stream of [false, true]) {
        const r = await context.request.post(base + "/api/director/abacus", {
          data: { message, stream },
        });
        assert.equal(r.status(), 200);
        const data = await r.json();
        assert.equal(data.model, "jk-abacus-platform");
        assert.match(data.text, /Projeto da plataforma verificado/);
        assert.equal(data.platform.deployments.length, 8);
      }
      const r = await context.request.post(base + "/api/director/research", {
        data: { query: message },
      });
      assert.equal((await r.json()).model, "jk-abacus-platform");
    }
    pass(
      "Issue #2 text, streaming and voice-research entrypoints return actual mocked platform names for Abacus, Avacus and Abagus",
    );
    await context.addInitScript(()=>{const original=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(blob.type==="application/zip")window.__designExport=blob;return original(blob)}});
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/criador");
    await page
      .getByLabel("Descreva sua interface", { exact: false })
      .fill("Kiro Produções\nApresentação\nProjetos\nContato");
    await page
      .getByRole("button", { name: "Preparar estrutura", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "1. Revise a estrutura" })
      .waitFor();
    assert.equal(await page.locator("iframe").count(), 0);
    pass("Brief prepares a wireframe without generating an unapproved preview");
    await page
      .getByRole("button", {
        name: "Aprovar estrutura e gerar prévia",
        exact: true,
      })
      .click();
    await page
      .frameLocator('iframe[title="Prévia da interface criada"]')
      .getByRole("heading", { name: "Kiro Produções", exact: true })
      .waitFor();
    assert.equal(await page.locator("iframe").getAttribute("sandbox"), "");
    const downloadWait = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Baixar projeto ZIP", exact: true })
      .click();
    const dl = await downloadWait;
    const zipBytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__designExport.arrayBuffer())));
    assert.equal(Buffer.from(zipBytes).readUInt32LE(0),0x04034b50);
    await fs.writeFile(path.join(out,"interface-jk.zip"),Buffer.from(zipBytes));
    try{await dl.saveAs(path.join(out,"browser-saved-interface.zip"));pass("Browser saved the ZIP download")}catch(e){if(!String(e).includes("canceled"))throw e;pass("ZIP export payload and browser download initiation verified; isolated Chrome cancels file saving")}
    pass("Approved brief produces a sandboxed preview and valid ZIP payload");
    await page
      .getByRole("button", { name: "Aprovar prévia e gerar catálogo" })
      .click();
    await page
      .frameLocator('iframe[title="Catálogo de componentes"]')
      .getByRole("heading", { name: "Fundamentos", exact: true })
      .waitFor();
    pass("Catalog appears only after explicit preview approval");
    await page.screenshot({
      path: path.join(out, "01-studio-preview.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Extrair de HTML/CSS", exact: true })
      .click();
    await page
      .getByLabel("HTML de origem", { exact: true })
      .fill(
        '<h1>Studio importado</h1><h2>Projetos</h2><script>throw Error("external-code")</script>',
      );
    await page
      .getByLabel("CSS de origem", { exact: true })
      .fill(":root{--brand:#112233;--accent:#38d9f5} .card{color:#ffffff}");
    await page
      .getByRole("button", { name: "Preparar estrutura", exact: true })
      .click();
    await page.getByText("--brand", { exact: false }).first().waitFor();
    assert.deepEqual(errors, []);
    pass(
      "HTML/CSS extraction identifies observed tokens without executing supplied scripts",
    );
    await page
      .getByRole("button", { name: "Imagem para interface", exact: true })
      .click();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      "base64",
    );
    await page
      .getByLabel("Imagem de referência", { exact: true })
      .setInputFiles({
        name: "reference.png",
        mimeType: "image/png",
        buffer: png,
      });
    await page.getByAltText("Referência fornecida para criação").waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Preparar estrutura", exact: true })
        .isEnabled(),
      false,
    );
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Preparar estrutura", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "1. Revise a estrutura" })
      .waitFor();
    assert.ok(
      (await page.getByLabel("Estrutura JSON").inputValue()).includes(
        "Referência Kiro",
      ),
    );
    pass(
      "Image conversion requires consent and uses the authenticated vision route with simulated provider",
    );
    const anon = await browser.newContext();
    assert.equal(
      (
        await anon.request.post(base + "/api/director/design", {
          data: { approved: true, image: "x" },
        })
      ).status(),
      401,
    );
    const csrf = await context.request.post(base + "/api/director/design", {
      headers: { origin: "https://evil.invalid" },
      data: { approved: true, image: "x" },
    });
    assert.equal(csrf.status(), 403);
    const noConsent = await context.request.post(
      base + "/api/director/design",
      { data: { image: "x" } },
    );
    assert.equal(noConsent.status(), 400);
    pass(
      "Server rejects unauthenticated, cross-origin and unapproved requests",
    );
    const routed = await context.request.post(base + "/api/director/research", {
      data: { query: "Crie uma interface a partir da imagem" },
    });
    assert.equal((await routed.json()).model, "jk-design-studio");
    pass("Voice research tool discovers the native interface creator");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.deepEqual(errors, []);
    pass("Mobile layout stays within viewport without browser errors");
  } finally {
    await fs.writeFile(
      path.join(out, "results.json"),
      JSON.stringify(
        { scenarios: results, count: results.length, paidCalls: 0 },
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
