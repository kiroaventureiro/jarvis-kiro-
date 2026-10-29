const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createHmac } = require("node:crypto"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/native-connectors",
  token = "ghp_fake_browser_token_123456789",
  A = "a".repeat(40);
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Connector fixture tests require loopback");
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--no-sandbox"],
  });
  const results = [];
  const pass = (scenario) => {
    results.push({ scenario, passed: true });
    console.log("PASS " + scenario);
  };
  try {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      expiry = String(Date.now() + 3600000),
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
    const request = context.request,
      post = (data) =>
        request.post(base + "/api/director/connectors", {
          headers: { Origin: base },
          data,
        });
    const anon = await browser.newContext();
    assert.equal(
      (await anon.request.get(base + "/api/director/connectors")).status(),
      401,
    );
    assert.equal(
      (
        await anon.request.post(base + "/api/director/connectors", {
          headers: { Origin: base },
          data: { op: "token", provider: "github", token },
        })
      ).status(),
      401,
    );
    await anon.close();
    assert.equal(
      (
        await request.post(base + "/api/director/connectors", {
          headers: { Origin: "https://malicious.invalid" },
          data: { op: "token", provider: "github", token },
        })
      ).status(),
      403,
    );
    pass("Owner authentication and mutation origin enforced by real route");
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/conexoes");
    await page
      .getByRole("heading", { name: "Contas e projetos do JK" })
      .waitFor();
    assert.equal(
      await page
        .getByText("Configuração inicial necessária", { exact: true })
        .count(),
      0,
    );
    for (const [provider, name] of [
      ["github", "GitHub"],
      ["supabase", "Supabase administrativo"],
      ["vercel", "Vercel"],
    ]) {
      const card = page.getByRole("article", {
        name: "Conector " + name,
        exact: true,
      });
      await card
        .getByRole("button", {
          name: "Usar token no formulário seguro",
          exact: true,
        })
        .click();
      await card
        .getByLabel("Token administrativo de " + name, { exact: true })
        .fill(token);
      await card
        .getByRole("button", { name: "Conectar e validar token", exact: true })
        .click();
      await card.getByText("Autenticação validada", { exact: true }).waitFor();
      assert.equal(await card.locator("input[type=password]").count(), 0);
    }
    pass(
      "Dedicated token forms connect and validate all three simulated providers without browser storage",
    );
    const gh = page.getByRole("article", {
      name: "Conector GitHub",
      exact: true,
    });
    await gh
      .getByRole("button", { name: "Testar conexão e listar projetos" })
      .click();
    await gh
      .getByText("Leitura do provedor validada.", { exact: false })
      .waitFor();
    await gh
      .locator("summary")
      .filter({ hasText: "Escopo de projetos e permissões" })
      .click();
    await gh
      .getByRole("checkbox", { name: "owner/project owner/project" })
      .check();
    await gh.getByLabel("Projeto KIRO vinculado").selectOption("universo-kiro");
    await gh
      .getByRole("checkbox", { name: "Preparar alterações aprovadas" })
      .check();
    await gh.getByRole("button", { name: "Salvar escopo autorizado" }).click();
    await gh.getByText("Escopo salvo;", { exact: false }).waitFor();
    for (const [provider, id, grants] of [
      ["supabase", "dev-project", ["read", "write"]],
      ["vercel", "prj_dev", ["read", "deploy", "configure"]],
    ]) {
      const r = await post({
        op: "scope",
        provider,
        resources: [
          { id, environment: "development", kiroProject: "universo-kiro" },
        ],
        grants,
      });
      assert.equal(r.status(), 200, await r.text());
    }
    pass(
      "Resource selection, KIRO project binding and local permissions saved",
    );
    let response = await post({
      op: "plan",
      title: "Read authorized repository",
      actions: [
        {
          provider: "github",
          resource: "owner/project",
          operation: "repo",
          args: {},
        },
      ],
    });
    assert.equal(response.status(), 200, await response.text());
    let plan = await response.json();
    response = await post({ op: "execute", id: plan.id, digest: plan.digest });
    assert.equal((await response.json()).status, "done");
    response = await post({
      op: "plan",
      title: "Approved development branch",
      actions: [
        {
          provider: "github",
          resource: "owner/project",
          operation: "branch",
          args: { branch: "jk/browser-new", baseSha: A },
        },
      ],
    });
    plan = await response.json();
    assert.equal(
      (
        await post({ op: "execute", id: plan.id, digest: plan.digest })
      ).status(),
      403,
    );
    await page.reload();
    let pc = page.locator("#plan-" + plan.id);
    await pc
      .getByLabel("Digite " + plan.confirmation, { exact: true })
      .fill(plan.confirmation);
    await pc.getByRole("button", { name: "Aprovar este plano" }).click();
    await pc
      .getByRole("button", { name: "Executar plano", exact: true })
      .waitFor();
    await pc
      .getByRole("button", { name: "Executar plano", exact: true })
      .click();
    await pc.getByText("done", { exact: true }).first().waitFor();
    assert.equal(
      (
        await post({ op: "execute", id: plan.id, digest: plan.digest })
      ).status(),
      409,
    );
    pass(
      "UI approves the exact plan; one write executes and replay is rejected",
    );
    for (const actions of [
      [
        {
          provider: "github",
          resource: "owner/other",
          operation: "repo",
          args: {},
        },
      ],
      [
        {
          provider: "github",
          resource: "owner/project",
          operation: "commit",
          args: {
            branch: "main",
            baseSha: A,
            path: "app/page.tsx",
            content: "x",
            message: "bad",
          },
        },
      ],
      [
        {
          provider: "vercel",
          resource: "prj_dev",
          operation: "preview",
          args: {
            branch: "jk/test",
            repoId: 101,
            sha: A,
            target: "production",
          },
        },
      ],
    ])
      assert.ok(
        (await post({ op: "plan", title: "Blocked", actions })).status() >= 400,
      );
    pass("Unscoped resource, primary branch and production injection rejected");
    response = await request.post(base + "/api/director/connectors/repair", {
      headers: { Origin: base },
      data: { mode: "diagnose", project: "universo-kiro" },
    });
    assert.equal(response.status(), 200, await response.text());
    assert.equal((await response.json()).status, "done");
    response = await request.post(base + "/api/director/abacus", {
      headers: { Origin: base },
      data: { message: "Jarvis, verifique o site Guardiões da Origem" },
    });
    assert.equal(response.status(), 200, await response.text());
    const reply = await response.json();
    assert.equal(reply.result.kind, "connector_plan");
    assert.equal(reply.provider, "local_operational");
    pass(
      "Project diagnosis and HUD result use existing text route with no model charge",
    );
    response = await request.post(base + "/api/director/connectors/repair", {
      headers: { Origin: base },
      data: {
        mode: "propose",
        project: "universo-kiro",
        request: "corrigir",
        paths: ["app/page.tsx"],
        authorizeModel: false,
      },
    });
    assert.equal(response.status(), 403);
    pass("Model proposal requires separate cost authorization");
    await page.goto(base);
    await page
      .getByRole("button", { name: "Escrever mensagem", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Mensagem para o Jarvis" })
      .fill("Jarvis, verifique o site Guardiões da Origem");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    const resultPanel = page.getByRole("complementary", {
      name: "Resultados holográficos",
    });
    await resultPanel.waitFor();
    await resultPanel
      .getByRole("link", { name: "Abrir relatório e plano" })
      .waitFor();
    assert.equal(await page.locator(".native-connectors").count(), 0);
    await page.screenshot({
      path: path.join(out, "home-diagnostic-result.png"),
    });
    pass(
      "Home shows contextual diagnosis result without a fixed administration panel",
    );

    const overview = await (
      await request.get(base + "/api/director/connectors")
    ).json();
    assert.ok(!JSON.stringify(overview).includes(token));
    assert.equal(
      await page.evaluate(() =>
        Object.values(localStorage).some((v) => v.includes("ghp_fake_browser")),
      ),
      false,
    );
    pass("Public response and localStorage contain no credential");
    await page.goto(base + "/conexoes");
    await page
      .getByRole("heading", { name: "Contas e projetos do JK" })
      .waitFor();
    await page.screenshot({ path: path.join(out, "central-desktop.png") });
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    await mobile.addCookies([
      {
        name: "jarvis_session",
        value: cookie,
        url: base,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    const mp = await mobile.newPage();
    await mp.goto(base + "/conexoes");
    await mp
      .getByRole("heading", { name: "Contas e projetos do JK" })
      .waitFor();
    assert.ok(
      await mp.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await mp.screenshot({ path: path.join(out, "central-mobile.png") });
    await mobile.close();
    pass("Desktop/mobile Central renders without horizontal overflow");
    response = await post({
      op: "revoke",
      provider: "vercel",
      confirmation: "REVOGAR vercel",
    });
    const revoked = await response.json();
    assert.equal(revoked.localDisabled, true);
    assert.equal(revoked.manualRequired, true);
    assert.equal(revoked.remoteRevoked, false);
    pass(
      "Manual token revocation is truthfully distinguished from local disconnection",
    );
    response = await post({ op: "connect", provider: "github" });
    assert.equal(response.status(), 200);
    assert.match(response.headers()["set-cookie"], /HttpOnly/);
    const authorization = new URL((await response.json()).authorizationUrl);
    assert.equal(authorization.hostname, "github.com");
    assert.equal(
      authorization.searchParams.get("code_challenge_method"),
      "S256",
    );
    const state = authorization.searchParams.get("state");
    response = await request.get(
      base +
        "/api/director/connectors/oauth/github/callback?state=" +
        state +
        "&code=fixture-code",
      { maxRedirects: 0 },
    );
    assert.equal(response.status(), 307);
    assert.ok(
      response.headers().location.endsWith("/conexoes?connectorAuth=received"),
    );
    response = await request.get(
      base +
        "/api/director/connectors/oauth/github/callback?state=" +
        state +
        "&code=fixture-code",
      { maxRedirects: 0 },
    );
    assert.ok(
      response.headers().location.endsWith("/conexoes?connectorAuth=failed"),
    );
    pass("OAuth callback accepts browser-bound state once and rejects replay");
    assert.deepEqual(errors, []);
    await context.close();
    await fs.writeFile(
      path.join(out, "browser-results.json"),
      JSON.stringify(
        {
          transport: "simulated providers; real loopback application routes",
          results,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
