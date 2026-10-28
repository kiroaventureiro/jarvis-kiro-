const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createHmac } = require("node:crypto"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/holo-v2/exports";
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

    await send("Mostre um mapa-múndi interativo");
    await page
      .getByRole("button", { name: "Pausar demonstração", exact: true })
      .click();
    await page.screenshot({ path: path.join(out, "export-source.png") });
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
      "report.pdf",
    );
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    pass("PDF export retains a valid multipage report");
    const png = await exportFile(
      "PNG · demonstração principal",
      "image/png",
      "image.png",
    );
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    pass("PNG export still renders the main visualization");
    const json = JSON.parse(
      (
        await exportFile(
          "JSON · dados estruturados",
          "application/json",
          "scene.json",
        )
      ).toString(),
    );
    assert.equal(json.scene.modules[0].kind, "map");
    pass(
      "JSON keeps original source scene rather than a shortened presentation",
    );
    const webm = await exportFile(
      "Vídeo WebM · sem áudio",
      "video/webm",
      "video.webm",
    );
    assert.equal(webm.subarray(0, 4).toString("hex"), "1a45dfa3");
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
    assert.equal(playback.width, 1024);
    assert.equal(playback.height, 640);
    assert.ok(playback.time > playback.duration - 1);
    pass(
      "Silent WebM has finite duration, decodes and plays through the final visual",
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
    pass("Video cancellation releases busy state");
    await page.evaluate(() =>
      Object.defineProperty(window, "VideoEncoder", {
        value: undefined,
        configurable: true,
      }),
    );
    await page
      .getByRole("button", { name: "Vídeo WebM · sem áudio", exact: true })
      .click();
    await page.getByRole("alert").filter({ hasText: "codificador" }).waitFor();
    pass("Unsupported video encoding offers a clear PNG/PDF fallback");
    assert.deepEqual(errors, []);
    pass("Export paths do not produce uncaught browser errors");
  } finally {
    await fs.writeFile(
      path.join(out, "browser-results.json"),
      JSON.stringify(
        {
          checks,
          count: checks.length,
          services: "Loopback fixture, no paid model or account calls",
        },
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
