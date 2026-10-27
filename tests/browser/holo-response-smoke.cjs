const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createHmac } = require("node:crypto"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/holo-response";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Loopback fixture required");
async function voice(context, { unsupported = false } = {}) {
  await context.addInitScript(
    ({ unsupported }) => {
      window.__spoken = [];
      const originalCreate = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        if (blob.type.startsWith("application/json"))
          blob.text().then((text) => (window.__exportJSON = text));
        return originalCreate(blob);
      };
      const synth = new EventTarget();
      synth.getVoices = () =>
        unsupported
          ? []
          : [
              {
                voiceURI: "br-fixture",
                name: "Português do teste",
                lang: "pt-BR",
                localService: true,
                default: true,
              },
            ];
      synth.speak = (u) => {
        window.__spoken.push(u.text);
        u.onstart?.();
        setTimeout(() => u.onend?.(), 60);
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
    },
    { unsupported },
  );
}
function fixtureScene(modules) {
  return {
    version: 1,
    id: "module-fixture",
    title: "Módulos verificados no teste",
    mode: "technical",
    createdAt: new Date().toISOString(),
    source: {
      kind: "reference",
      label: "Dados fictícios de teste · sem conta real",
    },
    modules,
  };
}
const assets = [
  {
    id: "text",
    kind: "text",
    title: "HoloText Stream",
    text: "Resultados em projeção",
    tags: ["Interativo", "Contextual"],
  },
  {
    id: "report",
    kind: "report",
    title: "Relatório do teste",
    summary: "Dados simulados para validar o componente.",
    items: [
      { label: "Verificação", detail: "Não representa diagnóstico real." },
    ],
  },
  {
    id: "compare",
    kind: "compare",
    title: "Comparação de opções",
    columns: [
      { label: "Opção A", points: ["Resultado A"] },
      { label: "Opção B", points: ["Resultado B"] },
    ],
  },
  {
    id: "metrics",
    kind: "metrics",
    title: "Métricas recebidas",
    unit: "dados simulados",
    style: "bars",
    values: [
      { label: "A", value: 3 },
      { label: "B", value: 7 },
    ],
  },
  {
    id: "connections",
    kind: "connections",
    title: "Estados de conexão",
    items: [
      {
        id: "github",
        label: "GitHub",
        state: "credentials_configured",
        detail: "Somente credencial fictícia; sem validação real.",
      },
      {
        id: "vercel",
        label: "Vercel",
        state: "operational_authorized",
        checkedAt: new Date(Date.now() - 120000).toISOString(),
        detail: "Evidência fictícia vencida.",
      },
    ],
  },
  {
    id: "media",
    kind: "media",
    title: "Mídia contextual",
    items: [
      {
        id: "image",
        type: "image",
        label: "Imagem de teste",
        url: "https://media.example/fixture.png",
      },
      {
        id: "video",
        type: "video",
        label: "Vídeo de teste",
        url: "https://media.example/fixture.mp4",
      },
    ],
  },
];
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    downloadsPath: path.resolve(out, "downloads"),
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox"],
  });
  const results = [];
  const pass = (scenario) => {
    results.push({ scenario, passed: true });
    console.log("PASS " + scenario);
  };
  try {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      acceptDownloads: true,
    });
    await voice(context);
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
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(30000);
    await page.goto(base);
    await page
      .getByRole("button", { name: "Escrever mensagem", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("complementary", { name: "Resultados holográficos" })
        .count(),
      0,
    );
    assert.equal(await page.locator("video").count(), 0);
    await page.screenshot({ path: path.join(out, "desktop-idle.png") });
    pass("Idle home has no fixed result panels or autoplay media");
    async function send(text) {
      if (
        await page
          .getByRole("button", { name: "Escrever mensagem", exact: true })
          .count()
      )
        await page
          .getByRole("button", { name: "Escrever mensagem", exact: true })
          .click();
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill(text);
      await page
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      await page.locator("main[data-state=idle]").waitFor();
    }
    await send("JK, me fale da história do Brasil");
    const hud = page.getByRole("complementary", {
      name: "Resultados holográficos",
    });
    await hud.waitFor();
    assert.equal(await hud.locator(".holo-panel").count(), 3);
    assert.equal(await hud.locator("svg path[role=button]").count(), 27);
    assert.equal(await page.locator(".response-hud").count(), 0);
    assert.ok(await page.evaluate(() => window.__spoken.length > 0));
    await page.screenshot({ path: path.join(out, "desktop-brazil.png") });
    pass(
      "Real reference route projects map, timeline and report while desktop response stays spoken",
    );
    await page
      .getByRole("button", { name: "Selecionar São Paulo", exact: true })
      .click();
    await page
      .locator(".holo-map-selection")
      .filter({ hasText: "São Paulo" })
      .waitFor();
    await page.getByRole("button", { name: "Aproximar mapa" }).click();
    await page.getByRole("button", { name: "Restaurar", exact: true }).click();
    await page.getByRole("button", { name: /1988.*Constituição/ }).click();
    await page
      .getByText("Promulgada em 5 de outubro de 1988.", { exact: true })
      .waitFor();
    pass("Map selection/zoom and timeline details respond to interaction");
    await page
      .getByRole("button", {
        name: "Expandir Território brasileiro",
        exact: true,
      })
      .click();
    assert.equal(await page.locator(".holo-expanded").count(), 1);
    await page
      .getByRole("button", {
        name: "Recolher Território brasileiro",
        exact: true,
      })
      .press("Escape");
    assert.equal(await page.locator(".holo-expanded").count(), 0);
    await page
      .getByRole("button", {
        name: "Fechar Roteiro de exploração",
        exact: true,
      })
      .click();
    assert.equal(await hud.locator(".holo-panel").count(), 2);
    await hud
      .getByRole("button", { name: "Roteiro de exploração", exact: true })
      .click();
    assert.equal(await hud.locator(".holo-panel").count(), 3);
    pass("Panels expand, close and reopen without changing the core");
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Exportar resultado holográfico",
        exact: true,
      })
      .click();
    const file = await download;
    await page.waitForFunction(() => !!window.__exportJSON);
    const downloaded = JSON.parse(
      await page.evaluate(() => window.__exportJSON),
    );
    await fs.writeFile(
      path.join(out, "exported-result.json"),
      JSON.stringify(downloaded, null, 2),
    );
    assert.match(file.suggestedFilename(), /^jk-holo-.*\.json$/);
    assert.equal(downloaded.format, "jk-holographic-result");
    assert.equal(downloaded.scene.source.kind, "reference");
    pass(
      "Export JSON payload and browser download initiation verified; isolated Chrome blocks file saving",
    );
    await page
      .getByRole("button", {
        name: "Fechar resultados holográficos",
        exact: true,
      })
      .click();
    assert.equal(await hud.count(), 0);
    await page
      .getByRole("button", { name: "Reabrir último resultado holográfico" })
      .click();
    await hud.waitFor();
    await page
      .getByRole("link", { name: "Abrir resultados desta sessão" })
      .click();
    await page
      .getByRole("heading", { name: "Resultados projetados", exact: true })
      .waitFor();
    await page
      .getByRole("heading", {
        name: "Brasil · território e história",
        exact: true,
      })
      .waitFor();
    await page.screenshot({ path: path.join(out, "session-library.png") });
    await page.getByRole("link", { name: "Voltar ao núcleo JK" }).click();
    await hud.waitFor();
    pass("Visual memory survives internal navigation and can reopen results");
    let mediaRequests = 0;
    await context.route("https://media.example/**", async (r) => {
      mediaRequests++;
      if (r.request().url().endsWith(".png"))
        await r.fulfill({
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=",
            "base64",
          ),
          contentType: "image/png",
        });
      else
        await r.fulfill({
          body: require("../fixtures/holo-video.cjs"),
          contentType: "video/mp4",
        });
    });
    await page.route("**/api/director/abacus", (r) =>
      r.request().method() === "POST"
        ? r.fulfill({
            json: {
              text: "Resultado simulado para verificar os módulos; nenhum serviço real foi executado.",
              model: "fixture",
              usage: null,
              visual: fixtureScene(assets),
            },
          })
        : r.continue(),
    );
    await send("Mostrar módulos do resultado de teste");
    await hud
      .getByRole("button", { name: "Mídia contextual", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Mídia contextual", exact: true })
      .waitFor();
    assert.equal(mediaRequests, 0);
    assert.equal(await page.locator("video").count(), 0);
    await page.getByRole("button", { name: "Carregar imagem externo" }).click();
    await page.locator(".holo-media img").waitFor();
    assert.equal(mediaRequests, 1);
    await page.getByRole("button", { name: "Carregar vídeo externo" }).click();
    await page.locator("video").waitFor();
    assert.equal(await page.locator("video").getAttribute("autoplay"), null);
    await page.locator("video").evaluate((video) => video.play());
    await page.waitForFunction(
      () => document.querySelector("video")?.currentTime > 0,
    );
    await page.locator("video").evaluate((video) => video.pause());
    pass(
      "External image/video load only on explicit action and never autoplay",
    );
    if (
      (await hud
        .getByRole("button", { name: "Comparação de opções", exact: true })
        .getAttribute("aria-pressed")) !== "true"
    )
      await hud
        .getByRole("button", { name: "Comparação de opções", exact: true })
        .click();
    assert.equal(await page.locator(".holo-compare section").count(), 2);
    await hud
      .getByRole("button", { name: "Métricas recebidas", exact: true })
      .click();
    assert.equal(await page.locator(".holo-metric").count(), 2);
    await hud
      .getByRole("button", { name: "Estados de conexão", exact: true })
      .click();
    await page.getByText("Revalidação necessária", { exact: true }).waitFor();
    assert.equal(
      await page
        .locator("[data-connection-state=operational_authorized]")
        .count(),
      0,
    );
    await page.screenshot({ path: path.join(out, "desktop-modules.png") });
    pass(
      "Compare, metrics and connection evidence render without fabricated green status",
    );
    await page
      .getByRole("link", { name: "Abrir resultados desta sessão" })
      .click();

    await page.getByRole("link", { name: "Voltar ao núcleo JK" }).click();
    const analysisText =
      "O relatório enviado descreve três etapas. Esta análise é uma síntese do arquivo e não mede a performance de um site.";
    await page.route("**/api/analyze", (r) =>
      r.fulfill({
        body:
          [
            { type: "stage", stage: "analyzing" },
            { type: "delta", text: analysisText },
            { type: "done", text: analysisText },
          ]
            .map((x) => JSON.stringify(x))
            .join("\n") + "\n",
        contentType: "application/x-ndjson",
      }),
    );
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Escolher mídia ou documento" })
      .click();
    await (
      await chooser
    ).setFiles([
      {
        name: "reference.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    ]);
    await page
      .getByRole("textbox", { name: "Mensagem para o Jarvis" })
      .fill("Analise a imagem e explique o resultado");
    await page
      .getByRole("button", { name: "Enviar mensagem", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Referências enviadas", exact: true })
      .waitFor();
    await page.locator("main[data-state=idle]").waitFor();
    assert.ok(
      await page.evaluate(
        (text) => window.__spoken.join(" ").includes(text),
        analysisText,
      ),
    );
    assert.equal(await page.locator(".response-hud").count(), 0);
    await page
      .getByRole("link", { name: "Abrir resultados desta sessão" })
      .click();
    await page
      .getByRole("heading", { name: "Resultados projetados", exact: true })
      .waitFor();
    await page.locator(".holo-media img").waitFor();
    await page.waitForFunction(
      () => document.querySelector(".holo-media img")?.naturalWidth > 0,
    );
    pass(
      "Attachment analysis stays spoken and local preview survives navigation in memory",
    );
    await page.getByRole("button", { name: "Limpar memória visual" }).click();
    await page
      .getByRole("heading", { name: "Nenhum resultado nesta sessão" })
      .waitFor();
    await page.reload();
    await page
      .getByRole("heading", { name: "Nenhum resultado nesta sessão" })
      .waitFor();
    pass("Clearing or reloading removes the transient visual collection");
    assert.deepEqual(errors, []);
    await context.close();
    for (const [name, width, height] of [
      ["iphone", 390, 844],
      ["small-phone", 360, 667],
      ["landscape", 1024, 560],
    ]) {
      const c = await browser.newContext({
        viewport: { width, height },
        isMobile: width < 600,
        userAgent:
          width < 600
            ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
            : undefined,
        reducedMotion: "reduce",
      });
      await voice(c, { unsupported: width >= 600 });
      await c.addCookies([
        {
          name: "jarvis_session",
          value: cookie,
          url: base,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      const p = await c.newPage();
      await p.goto(base);
      await p
        .getByRole("button", { name: "Escrever mensagem", exact: true })
        .click();
      await p
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill("Me explique a história do Brasil");
      await p
        .getByRole("button", { name: "Enviar mensagem", exact: true })
        .click();
      await p
        .getByRole("complementary", { name: "Resultados holográficos" })
        .waitFor();
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      assert.equal(
        await p.locator(".holo-panel").count(),
        width <= 850 ? 1 : 3,
      );
      await p
        .getByRole("button", { name: "Selecionar São Paulo", exact: true })
        .waitFor();
      const panel = await p.locator(".holo-panel").first().boundingBox(),
        dock = await p.locator(".interaction-dock").boundingBox();
      assert.ok(
        panel && dock && panel.y + panel.height <= dock.y + 2,
        "Projection must end above controls",
      );
      await p.screenshot({ path: path.join(out, name + "-response.png") });
      if (width < 600) {
        await p
          .getByRole("button", {
            name: "Expandir Território brasileiro",
            exact: true,
          })
          .click();
        await p.screenshot({
          path: path.join(out, name + "-expanded-map.png"),
        });
        await p
          .getByRole("button", {
            name: "Recolher Território brasileiro",
            exact: true,
          })
          .click();
      }
      if (width < 600) {
        await p
          .getByRole("button", { name: "Marcos da história", exact: true })
          .click();
        assert.equal(
          await p.locator(".holo-panel[data-module=timeline]").count(),
          1,
        );
      } else await p.locator(".response-hud").waitFor();
      await c.close();
      pass(name + " responsive output, motion preference and text fallback");
    }
    await fs.writeFile(
      path.join(out, "browser-results.json"),
      JSON.stringify(
        {
          upstreams: "simulated; real application reference endpoint tested",
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
