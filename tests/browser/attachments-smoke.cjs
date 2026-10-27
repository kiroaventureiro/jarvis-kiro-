const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3147";
const out = process.env.TEST_OUTPUT_DIR || "work/attachment-evidence";
const answer =
  "Analisei relatorio.txt e imagem.png. O relatório registra crescimento de 12%. A imagem é uma referência visual.";
const ndjson = (audio = false) =>
  [
    ...(audio
      ? [
          { type: "stage", stage: "transcribing" },
          { type: "transcript", text: "Compare os anexos" },
        ]
      : []),
    { type: "stage", stage: "analyzing" },
    { type: "delta", text: answer.slice(0, 45) },
    { type: "delta", text: answer.slice(45) },
    { type: "done", text: answer, files: ["relatorio.txt", "imagem.png"] },
  ]
    .map((e) => JSON.stringify(e))
    .join("\n") + "\n";
async function drag(page, selector, files) {
  const transfer = await page.evaluateHandle((items) => {
    const data = new DataTransfer();
    for (const item of items) {
      const bytes = item.base64
        ? Uint8Array.from(atob(item.base64), (c) => c.charCodeAt(0))
        : item.content;
      data.items.add(
        new File([bytes], item.name, {
          type: item.type || "text/plain",
          lastModified: 123,
        }),
      );
    }
    return data;
  }, files);
  await page.dispatchEvent(selector, "dragenter", { dataTransfer: transfer });
  return transfer;
}
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yFZkAAAAASUVORK5CYII=";
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
      const submissions = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        window.__revoked = 0;
        window.__recordStopped = 0;
        const revoke = URL.revokeObjectURL.bind(URL);
        URL.revokeObjectURL = (url) => {
          window.__revoked++;
          revoke(url);
        };
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: {
            getUserMedia: async () => ({
              getTracks: () => [
                {
                  stop() {
                    window.__recordStopped++;
                  },
                },
              ],
            }),
          },
        });
        window.MediaRecorder = class {
          static isTypeSupported() {
            return true;
          }
          constructor() {
            this.state = "inactive";
          }
          start() {
            this.state = "recording";
          }
          stop() {
            this.state = "inactive";
            this.ondataavailable?.({
              data: new Blob(["fixture"], { type: "audio/webm" }),
            });
            this.onstop?.();
          }
        };
      });
      await page.route("**/api/analyze", async (route) => {
        const body = route.request().postDataBuffer().toString();
        submissions.push(body);
        await route.fulfill({
          contentType: "application/x-ndjson",
          body: ndjson(body.includes('name="audio"')),
        });
      });
      await page.goto(base);
      await page
        .getByRole("button", { name: "Escrever mensagem", exact: true })
        .waitFor();
      assert.equal(await page.locator(".attachment-hud").count(), 0);
      const data = await drag(page, ".stage-header", [
        { name: "relatorio.txt", content: "Crescimento de 12%" },
        { name: "imagem.png", base64: png, type: "image/png" },
      ]);
      await page
        .getByText("Solte no campo do Jarvis", { exact: true })
        .waitFor();
      await page.screenshot({
        path: path.join(out, name + "-drag.png"),
        fullPage: true,
      });
      await page.dispatchEvent(".stage-header", "drop", { dataTransfer: data });
      await data.dispose();
      await page.getByRole("region", { name: "Arquivos da análise" }).waitFor();
      assert.equal(await page.locator(".attachment-card").count(), 2);
      assert.equal(
        submissions.length,
        0,
        "dropping files must not send them automatically",
      );
      assert.equal(await page.locator(".drop-hologram").count(), 0);
      assert.equal(await page.locator("input[type=file]").isVisible(), false);
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill("Compare os arquivos e prepare um resumo");
      await page.screenshot({
        path: path.join(out, name + "-files.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Enviar mensagem" }).click();
      await page.getByText("Análise concluída", { exact: true }).waitFor();
      await page
        .locator(".response-hud")
        .getByText(answer, { exact: true })
        .waitFor();
      assert.equal(submissions.length, 1);
      assert.ok(
        submissions[0].includes("relatorio.txt") &&
          submissions[0].includes("imagem.png") &&
          submissions[0].includes("Compare os arquivos"),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const dock = await page.locator(".interaction-dock").boundingBox(),
        hud = await page.locator(".response-hud").boundingBox(),
        attachment = await page.locator(".attachment-hud").boundingBox();
      assert.ok(dock && hud && attachment);
      if (width < 850) {
        assert.ok(hud.y + hud.height <= dock.y + 2);
        assert.ok(attachment.y + attachment.height <= hud.y + 2);
      }
      await page.screenshot({
        path: path.join(out, name + "-analysis.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Expandir", exact: true }).click();
      await page
        .locator(".response-hud")
        .getByText(answer, { exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Recolher", exact: true }).click();
      await page
        .getByRole("button", { name: "Gravar orientação sobre os arquivos" })
        .click();
      await page
        .getByRole("button", { name: "Concluir orientação por voz" })
        .waitFor();
      await page
        .getByRole("button", { name: "Concluir orientação por voz" })
        .click();
      await page.getByText("Análise concluída", { exact: true }).waitFor();
      assert.equal(submissions.length, 2);
      assert.ok(submissions[1].includes('name="audio"'));
      assert.ok(await page.evaluate(() => window.__recordStopped > 0));
      await page.getByRole("button", { name: "Remover imagem.png" }).click();
      assert.equal(await page.locator(".attachment-card").count(), 1);
      assert.ok(await page.evaluate(() => window.__revoked > 0));
      await page.getByRole("button", { name: "Remover relatorio.txt" }).click();
      assert.equal(await page.locator(".attachment-hud").count(), 0);
      const bad = await drag(page, ".interaction-dock", [
        { name: "programa.exe", content: "MZ" },
      ]);
      await page.dispatchEvent(".interaction-dock", "drop", {
        dataTransfer: bad,
      });
      await bad.dispose();
      await page.getByText(/Formato ainda não suportado/).waitFor();
      assert.equal(await page.locator(".attachment-card").count(), 0);
      assert.equal(submissions.length, 2);
      const paste = await page.evaluateHandle(() => {
        const data = new DataTransfer();
        data.items.add(
          new File(["Texto de um relatório colado"], "colado.txt", {
            type: "text/plain",
          }),
        );
        return data;
      });
      await page.evaluate(
        (data) =>
          document.querySelector("main").dispatchEvent(
            new ClipboardEvent("paste", {
              bubbles: true,
              cancelable: true,
              clipboardData: data,
            }),
          ),
        paste,
      );
      await paste.dispose();
      await page.getByText("colado.txt", { exact: true }).waitFor();
      assert.equal(await page.locator(".attachment-card").count(), 1);
      await page.route("**/api/analyze", (route) =>
        route.fulfill({
          status: 401,
          json: { error: "Autentique seu dispositivo para analisar arquivos." },
        }),
      );
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill("Resuma");
      await page.getByRole("button", { name: "Enviar mensagem" }).click();
      await page
        .getByRole("alert")
        .getByText("Autentique seu dispositivo para analisar arquivos.", {
          exact: true,
        })
        .waitFor();
      assert.equal(await page.locator(".attachment-card").count(), 1);
      assert.equal(
        await page.getByRole("button", { name: "Enviar mensagem" }).isEnabled(),
        true,
      );
      assert.deepEqual(errors, []);
      results.push({
        viewport: name,
        drop: true,
        paste: true,
        analysis: true,
        voiceInstruction: true,
        cleanup: true,
        authorizationError: true,
      });
      await context.close();
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route("**/api/analyze", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route
        .fulfill({ contentType: "application/x-ndjson", body: ndjson() })
        .catch(() => {});
    });
    await page.goto(base);
    const data = await drag(page, "main", [
      { name: "relatorio.txt", content: "Teste" },
    ]);
    await page.dispatchEvent("main", "drop", { dataTransfer: data });
    await data.dispose();
    await page
      .getByRole("textbox", { name: "Mensagem para o Jarvis" })
      .fill("Resuma");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await page.getByRole("button", { name: "Interromper análise" }).click();
    await page.getByText(/Análise interrompida. Os anexos/).waitFor();
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(await page.locator(".response-hud").count(), 0);
    results.push({ scenario: "cancel ignores late response", passed: true });
    await context.close();
    await fs.writeFile(
      path.join(out, "attachment-results.json"),
      JSON.stringify(results, null, 2),
    );
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
