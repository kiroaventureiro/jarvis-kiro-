const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3147",
  out = process.env.TEST_OUTPUT_DIR || "work/voice-evidence";
async function mock(context, { unsupported = false } = {}) {
  await context.addInitScript(
    ({ unsupported }) => {
      window.__recs = [];
      window.__utterances = [];
      window.__synthCurrent = null;
      window.__cancelled = 0;
      window.__outsideCalls = [];
      class Rec {
        constructor() {
          window.__recs.push(this);
        }
        start() {
          this.active = true;
          this.onstart?.();
        }
        abort() {
          this.active = false;
          this.onend?.();
        }
        stop() {
          this.abort();
        }
      }
      if (!unsupported) {
        window.SpeechRecognition = Rec;
        window.webkitSpeechRecognition = Rec;
      } else {
        window.SpeechRecognition = undefined;
        window.webkitSpeechRecognition = undefined;
      }
      const synth = new EventTarget();
      synth.getVoices = () => [
        {
          voiceURI: "br-1",
          name: "Voz pt-BR compatível",
          lang: "pt-BR",
          localService: true,
          default: true,
        },
        {
          voiceURI: "br-2",
          name: "Voz escolhida pelo usuário",
          lang: "pt-BR",
          localService: true,
          default: false,
        },
        {
          voiceURI: "en-1",
          name: "English voice",
          lang: "en-US",
          localService: true,
          default: false,
        },
      ];
      synth.speak = (utter) => {
        window.__synthCurrent = utter;
        window.__utterances.push({
          text: utter.text,
          lang: utter.lang,
          voiceURI: utter.voice?.voiceURI,
          rate: utter.rate,
          pitch: utter.pitch,
          volume: utter.volume,
        });
        utter.onstart?.();
      };
      synth.cancel = () => {
        window.__cancelled++;
        const current = window.__synthCurrent;
        window.__synthCurrent = null;
        current?.onerror?.({ error: "canceled" });
      };
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: synth,
      });
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text;
        }
      };
      window.__emit = (text) => {
        const rec = window.__recs.at(-1);
        if (rec?.active)
          rec.onresult?.({
            resultIndex: 0,
            results: [{ isFinal: true, 0: { transcript: text } }],
          });
      };
      window.__finish = () => {
        const u = window.__synthCurrent;
        window.__synthCurrent = null;
        u?.onend?.();
      };
    },
    { unsupported },
  );
}
async function activate(page) {
  await page
    .getByRole("button", { name: "Ativar escuta por Jarvis", exact: true })
    .click();
  const allow = page.getByRole("button", {
    name: "Ativar escuta",
    exact: true,
  });
  if (await allow.count()) await allow.click();
  await page
    .getByRole("button", { name: "Desligar escuta contínua", exact: true })
    .waitFor();
}
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
      ["iphone-layout", 390, 844],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: width < 850,
        isMobile: width < 850,
        reducedMotion: "reduce",
      });
      await mock(context);
      const page = await context.newPage();
      const errors = [],
        calls = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/api/director/abacus", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            json: {
              paidCallsAllowed: false,
              callsPerHour: 0,
              usage: { calls: 0 },
            },
          });
          return;
        }
        calls.push(JSON.parse(route.request().postData()));
        await route.fulfill({
          json: {
            text: "Aqui estão três ideias para o seu projeto.",
            model: "route-llm",
            usage: null,
          },
        });
      });
      await page.goto(base);
      await page
        .getByRole("button", { name: "Ativar escuta por Jarvis", exact: true })
        .waitFor();
      assert.equal(await page.evaluate(() => window.__recs.length), 0);
      await activate(page);
      assert.equal(await page.evaluate(() => window.__recs[0].lang), "pt-BR");
      await page.evaluate(() =>
        window.__emit("Conversa sem a palavra de ativação"),
      );
      assert.equal(calls.length, 0);
      await page.evaluate(() => window.__emit("Bom dia, Jarvis"));
      await page.locator("main[data-voice-phase=speaking]").waitFor();
      const greeting = page.getByText(
        "Bom dia! Estou à disposição. O que vamos fazer hoje?",
        { exact: true },
      );
      if (name === "desktop") {
        await page
          .locator("main[data-speech-presentation=voice-first]")
          .waitFor();
        assert.equal(await greeting.count(), 0);
        assert.equal(await page.locator(".response-hud").count(), 0);
      } else await greeting.waitFor();
      assert.equal(calls.length, 0);
      assert.equal(
        await page.evaluate(() => window.__recs.filter((r) => r.active).length),
        0,
      );
      assert.equal(
        await page.evaluate(() => window.__utterances[0].lang),
        "pt-BR",
      );
      await page.evaluate(() => window.__emit("Jarvis escute a própria voz"));
      assert.equal(calls.length, 0);
      await page.screenshot({
        path: path.join(out, name + "-speaking.png"),
        fullPage: true,
      });
      await page.evaluate(() => window.__finish());
      await page.waitForFunction(
        () => window.__recs.filter((r) => r.active).length === 1,
      );
      await page.evaluate(() => window.__emit("Me dê ideias para o projeto"));
      await page.locator("main[data-voice-phase=speaking]").waitFor();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].message, "Me dê ideias para o projeto");
      await page.evaluate(() => window.__finish());
      await page.waitForFunction(
        () => window.__recs.filter((r) => r.active).length === 1,
      );
      await page.evaluate(() => window.__emit("Me dê ideias para o projeto"));
      assert.equal(calls.length, 1);
      await page
        .getByRole("button", { name: "Desligar escuta contínua", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => window.__recs.filter((r) => r.active).length),
        0,
      );
      await page
        .getByRole("button", { name: "Escrever mensagem", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis" })
        .fill("Pedido pelo teclado");
      await page.getByRole("button", { name: "Enviar mensagem" }).click();
      if (name === "desktop") {
        await page.locator("main[data-state=responding]").waitFor();
        assert.equal(
          await page
            .getByText("Aqui estão três ideias para o seu projeto.", {
              exact: true,
            })
            .count(),
          0,
        );
        await page.evaluate(() => window.__finish());
      }
      await page.locator("main[data-state=idle]").waitFor();
      assert.equal(calls.length, 2);
      assert.equal(calls[1].message, "Pedido pelo teclado");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.goto(base + "/configuracoes");
      await page
        .getByRole("combobox", { name: "Voz em português brasileiro" })
        .selectOption("br-2");
      await page.getByRole("slider", { name: "Velocidade da voz" }).fill("0.9");
      await page.getByRole("slider", { name: "Tom da voz" }).fill("0.8");
      await page.getByRole("checkbox", { name: /Após ouvir a prévia/ }).check();
      await page.getByRole("button", { name: "Ouvir prévia da voz" }).click();
      await page.waitForFunction(() => !!window.__synthCurrent);
      const spoken = await page.evaluate(() => window.__utterances.at(-1));
      assert.equal(spoken.voiceURI, "br-2");
      assert.equal(spoken.rate, 0.9);
      assert.equal(spoken.pitch, 0.8);
      await page.evaluate(() => window.__finish());
      await page.getByText(/Prévia concluída/).waitFor();
      await page.reload();
      await page.waitForFunction(
        () =>
          document.querySelector(
            'select[aria-label="Voz em português brasileiro"]',
          )?.value === "br-2",
      );
      assert.equal(
        await page
          .getByRole("combobox", { name: "Voz em português brasileiro" })
          .inputValue(),
        "br-2",
      );
      await page
        .getByRole("button", { name: "Consultar autorização e limites" })
        .click();
      await page.getByText(/Abacus RouteLLM: uso pago bloqueado/).waitFor();
      await page.screenshot({
        path: path.join(out, name + "-settings.png"),
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      assert.equal(
        (await page.request.post(base + "/api/voice")).status(),
        401,
      );
      results.push({
        viewport: name,
        greeting: true,
        speechPresentation:
          name === "desktop" ? "voice-only" : "mobile-transcript",
        echoBlocked: true,
        continuation: true,
        deduplication: true,
        typed: true,
        voiceSelection: true,
        preview: true,
        authentication: true,
      });
      await context.close();
    }
    for (const mode of ["failure", "muted", "mute-during", "no-voice"]) {
      const fallback = await browser.newContext();
      await mock(fallback);
      const fp = await fallback.newPage();
      await fp.goto(base);
      await fp.locator("main[data-speech-presentation=voice-first]").waitFor();
      if (mode === "muted")
        await fp
          .getByRole("button", { name: "Silenciar áudio", exact: true })
          .click();
      if (mode === "no-voice")
        await fp.evaluate(() => {
          window.speechSynthesis.getVoices = () => [];
        });
      await activate(fp);
      await fp.evaluate(() => window.__emit("Bom dia, Jarvis"));
      if (mode === "mute-during") {
        await fp.locator("main[data-voice-phase=speaking]").waitFor();
        await fp
          .getByRole("button", { name: "Silenciar áudio", exact: true })
          .click();
        await fp.waitForFunction(
          () => window.__recs.filter((r) => r.active).length === 1,
        );
      }
      if (mode === "failure") {
        await fp.locator("main[data-voice-phase=speaking]").waitFor();
        assert.equal(
          await fp
            .getByText("Bom dia! Estou à disposição. O que vamos fazer hoje?", {
              exact: true,
            })
            .count(),
          0,
        );
        await fp.evaluate(() =>
          window.__synthCurrent.onerror({ error: "not-allowed" }),
        );
      }
      await fp
        .getByText("Bom dia! Estou à disposição. O que vamos fazer hoje?", {
          exact: true,
        })
        .waitFor();
      results.push({ scenario: "desktop text fallback " + mode, passed: true });
      await fallback.close();
    }
    const controls = await browser.newContext();
    await mock(controls);
    const cp = await controls.newPage();
    await cp.goto(base);
    await activate(cp);
    await cp.evaluate(() => window.__emit("Bom dia, Jarvis"));
    await cp.locator("main[data-voice-phase=speaking]").waitFor();
    await cp
      .getByRole("button", { name: "Desligar escuta contínua", exact: true })
      .click();
    assert.equal(await cp.evaluate(() => window.__synthCurrent), null);
    assert.equal(
      await cp.evaluate(() => window.__recs.filter((r) => r.active).length),
      0,
    );
    await cp.waitForTimeout(700);
    assert.equal(await cp.evaluate(() => window.__recs.length), 1);
    results.push({
      scenario: "off interrupts speech without restarting",
      passed: true,
    });
    await activate(cp);
    await cp.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await cp
      .getByRole("button", { name: "Ativar escuta por Jarvis", exact: true })
      .waitFor();
    assert.equal(
      await cp.evaluate(() => window.__recs.filter((r) => r.active).length),
      0,
    );
    await controls.close();
    results.push({ scenario: "hidden page stops microphone", passed: true });
    const unsupported = await browser.newContext();
    await mock(unsupported, { unsupported: true });
    const up = await unsupported.newPage();
    await up.goto(base);
    await up
      .getByRole("button", { name: "Ativar escuta por Jarvis", exact: true })
      .click();
    await up
      .getByRole("button", { name: "Ativar escuta", exact: true })
      .click();
    await up.getByText(/Reconhecimento de fala indisponível/).waitFor();
    assert.equal(await up.evaluate(() => window.__recs.length), 0);
    await unsupported.close();
    results.push({ scenario: "unsupported browser", passed: true });
    const denied = await browser.newContext();
    await mock(denied);
    const dp = await denied.newPage();
    await dp.goto(base);
    await activate(dp);
    await dp.evaluate(() =>
      window.__recs.at(-1).onerror({ error: "not-allowed" }),
    );
    await dp.getByText(/Permissão de microfone negada/).waitFor();
    await dp.waitForTimeout(1200);
    assert.equal(await dp.evaluate(() => window.__recs.length), 1);
    await denied.close();
    results.push({
      scenario: "permission denied stops permanently",
      passed: true,
    });
    const failed = await browser.newContext();
    await mock(failed);
    const fp = await failed.newPage();
    let attempts = 0;
    await fp.route("**/api/director/abacus", (route) => {
      attempts++;
      return route.fulfill({
        status: 502,
        json: { error: "Abacus indisponível" },
      });
    });
    await fp.goto(base);
    await activate(fp);
    await fp.evaluate(() => window.__emit("Jarvis, preciso de ajuda"));
    await fp.getByText(/Abacus indisponível/).waitFor();
    await fp.waitForTimeout(1200);
    assert.equal(attempts, 1);
    assert.equal(
      await fp.evaluate(() => window.__recs.filter((r) => r.active).length),
      0,
    );
    await failed.close();
    results.push({
      scenario: "provider failure no automatic paid retry",
      passed: true,
    });
    const ios = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
    });
    await mock(ios);
    const ip = await ios.newPage();
    await ip.goto(base);
    await activate(ip);
    assert.equal(await ip.evaluate(() => window.__recs[0].continuous), false);
    await ip.evaluate(() => window.__emit("Boa noite, Jarvis"));
    await ip.locator("main[data-voice-phase=speaking]").waitFor();
    await ip.evaluate(() => window.__finish());
    await ip
      .getByRole("button", { name: "Ativar escuta por Jarvis", exact: true })
      .waitFor();
    assert.equal(
      await ip.evaluate(() => window.__recs.filter((r) => r.active).length),
      0,
    );
    await ios.close();
    results.push({ scenario: "iOS conservative manual mode", passed: true });
    await fs.writeFile(
      path.join(out, "voice-results.json"),
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
