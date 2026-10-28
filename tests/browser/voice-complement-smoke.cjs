const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHmac } = require("node:crypto");
const base = process.env.TEST_BASE_URL || "http://localhost:3156",
  out = process.env.TEST_OUTPUT_DIR || "../../outputs/visual-freedom/handoff";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("Loopback fixture required");
const make = (
  id,
  modules,
  narration = "Explicação de teste com conteúdo verificável no cenário simulado.",
) => ({
  version: 1,
  id,
  title: "JK 3.0 · validação funcional",
  mode: "explanation",
  createdAt: new Date().toISOString(),
  source: {
    kind: "reference",
    label: "Cenário simulado · validação da interface",
  },
  narration,
  modules,
});
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
    }),
    results = [];
  const pass = (scenario) => {
    results.push({ scenario, passed: true });
    console.log("PASS " + scenario);
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
      window.__utterances = [];
      window.__speechCurrent = null;
      window.__speechCancels = 0;
      window.__downloads = 0;
      window.__exports = {};
      window.__canvasText = [];
      window.__overlaps = 0;
      const originalContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/i.test(type)
          ? null
          : originalContext.call(this, type, ...args);
      };
      const oldText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        window.__canvasText.push(String(text));
        return oldText.call(this, text, ...args);
      };
      const oldURL = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        if (
          [
            "application/pdf",
            "application/json",
            "image/png",
            "video/webm",
          ].includes(blob.type)
        )
          window.__exports[blob.type] = blob;
        return oldURL(blob);
      };
      const anchor = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download) window.__downloads++;
        return anchor.call(this);
      };
      const api = new EventTarget();
      api.paused = false;
      api.getVoices = () => [
        {
          voiceURI: "fixture-br-a",
          name: "Voz pt-BR A",
          lang: "pt-BR",
          localService: true,
          default: true,
        },
        {
          voiceURI: "fixture-br-b",
          name: "Voz pt-BR B",
          lang: "pt-BR",
          localService: true,
          default: false,
        },
        {
          voiceURI: "fixture-en",
          name: "English",
          lang: "en-US",
          localService: true,
          default: false,
        },
      ];
      api.speak = (u) => {
        if (window.__speechCurrent?.onend && !window.__speechCurrent.__ended)
          window.__overlaps++;
        window.__utterances.push(u);
        window.__speechCurrent = u;
        queueMicrotask(() => u.onstart?.());
      };
      api.cancel = () => {
        window.__speechCancels++;
        window.__speechCurrent = null;
        api.paused = false;
      };
      api.pause = () => {
        api.paused = true;
      };
      api.resume = () => {
        api.paused = false;
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
    });
    await context.route(
      "https://upload.wikimedia.org/wikipedia/commons/a/ab/Rio_fixture.jpg",
      (r) =>
        r.fulfill({
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=",
            "base64",
          ),
          contentType: "image/png",
        }),
    );
    const page = await context.newPage(),
      errors = [],
      providerPosts = [];
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/api/director/abacus"))
        providerPosts.push(r.postDataJSON());
    });
    let visual = null;
    await page.route("**/api/director/abacus", (r) =>
      r.request().method() === "POST" && visual
        ? r.fulfill({
            json: {
              text: visual.narration,
              visual,
              model: "fixture",
              usage: null,
            },
          })
        : r.continue(),
    );

    await context.addInitScript(() => {
      window.__recs = [];
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
      window.SpeechRecognition = Rec;
      window.webkitSpeechRecognition = Rec;
    });

    await context.addInitScript(() => {
      window.__stopped = 0;
      class Ch extends EventTarget {
        constructor() {
          super();
          this.readyState = "connecting";
          window.__dc = this;
        }
        send() {}
        close() {
          this.readyState = "closed";
          this.onclose?.();
        }
      }
      window.RTCPeerConnection = class {
        constructor() {
          this.connectionState = "new";
          window.__pc = this;
        }
        createDataChannel() {
          return (this.dc = new Ch());
        }
        addTrack() {}
        addTransceiver() {}
        async createOffer() {
          return { sdp: "fixture-sdp", type: "offer" };
        }
        async setLocalDescription() {}
        async setRemoteDescription() {
          this.dc.readyState = "open";
          this.dc.dispatchEvent(new Event("open"));
          this.dc.onopen?.();
        }
        close() {
          this.connectionState = "closed";
          this.dc.close();
        }
      };
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => ({
            getTracks: () => [
              {
                enabled: true,
                stop() {
                  window.__stopped++;
                },
              },
            ],
            getAudioTracks: () => [],
          }),
        },
      });
    });
    await page.route("**/api/voice", (r) =>
      r.fulfill({ json: { value: "fixture-only-session" } }),
    );
    await page.route("https://api.openai.com/**", (r) =>
      r.fulfill({ body: "fixture-sdp", contentType: "application/sdp" }),
    );

    await context.addInitScript(() => {
      window.__sent = [];
      const createElement = document.createElement.bind(document);
      document.createElement = (name, options) => {
        const el = createElement(name, options);
        if (name === "audio") window.__neuralAudio = el;
        return el;
      };
      HTMLMediaElement.prototype.play = async () => {};
      window.__finishVoice = () => {
        const u = window.__speechCurrent;
        if (u && !u.__ended) {
          u.__ended = true;
          u.onend?.();
        }
      };
    });
    // The test-only RTC channel records tool outputs; it never connects to a paid voice service.
    await page.goto(base);
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    const send = async (text) => {
      if (
        await page
          .getByRole("button", { name: "Escrever mensagem", exact: true })
          .count()
      )
        await page
          .getByRole("button", { name: "Escrever mensagem", exact: true })
          .click();
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis", exact: true })
        .fill(text);
      await page
        .getByRole("textbox", { name: "Mensagem para o Jarvis", exact: true })
        .press("Enter");
    };
    const text =
      "A integração Abacus está configurada e autorizada. O catálogo da conta foi consultado. O saldo observado é datado.";
    visual = make(
      "duplicate-report",
      [
        {
          id: "mirror",
          kind: "report",
          title: "Pontos em destaque",
          summary: text,
          items: [
            {
              label: "A integração Abacus está configurada e autorizada.",
              detail: text,
            },
          ],
          body: text,
        },
        {
          id: "chart",
          kind: "metrics",
          title: "Referência complementar",
          unit: "exemplos simulados",
          style: "bars",
          values: [
            { label: "A", value: 2 },
            { label: "B", value: 4 },
          ],
        },
      ],
      text,
    );
    await send("Explique o estado da conta e mostre a referência");
    await page.clock.runFor(400);
    await page.waitForFunction(() => window.__utterances.length > 0);
    assert.equal(await page.getByText(text, { exact: true }).count(), 0);
    assert.equal(
      await page
        .getByRole("heading", { name: "Pontos em destaque", exact: true })
        .count(),
      0,
    );
    assert.ok(await page.locator('[data-kind="metrics"]').count());
    pass(
      "Desktop shows a real demonstration without projecting spoken paragraphs or generic transcript headings",
    );
    await page.screenshot({
      path: path.join(out, "01-complement-active.png"),
      animations: "disabled",
    });
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => window.__finishVoice());
      await page.clock.runFor(15000);
      if ((await page.locator("main").getAttribute("data-state")) === "idle")
        break;
    }
    const speech = await page.evaluate(() =>
      window.__utterances
        .map((u) => u.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    assert.equal(speech, text);
    assert.equal(await page.evaluate(() => window.__overlaps), 0);
    pass(
      "Browser voice speaks the supplied answer exactly once without titles or visual descriptions",
    );
    await page.screenshot({
      path: path.join(out, "01-complement-only.png"),
      animations: "disabled",
    });
    visual = make(
      "plain-mirror",
      [
        {
          id: "r",
          kind: "report",
          title: "Pontos em destaque",
          summary: text,
          items: [{ label: "Resumo", detail: text }],
          body: text,
        },
      ],
      text,
    );
    await send("Explique a configuração");
    await page.clock.runFor(500);
    await page.waitForFunction(() => window.__utterances.length > 1);
    assert.equal(
      await page
        .getByRole("complementary", { name: "Resultados holográficos" })
        .count(),
      0,
    );
    assert.equal(await page.getByText(text, { exact: true }).count(), 0);
    pass("A response with no independent visual remains voice-only");
    await page.evaluate(() => window.__finishVoice());
    await page.clock.runFor(600);
    await page
      .getByRole("button", { name: "Silenciar áudio", exact: true })
      .click();
    await send("Explique sem áudio");
    await page.clock.runFor(800);
    await page.getByText(text, { exact: true }).waitFor();
    pass("Text fallback remains available when voice is muted");
    await page
      .getByRole("button", { name: "Ativar áudio", exact: true })
      .click();
    visual = make(
      "voice-error-chart",
      [
        {
          id: "chart",
          kind: "metrics",
          title: "Gráfico complementar",
          unit: "exemplos",
          style: "bars",
          values: [{ label: "A", value: 2 }],
        },
      ],
      text,
    );
    await send("Mostre um gráfico e explique");
    await page.clock.runFor(500);
    await page.waitForFunction(() => !!window.__speechCurrent?.onerror);
    await page.evaluate(() =>
      window.__speechCurrent.onerror({ error: "not-allowed" }),
    );
    await page.clock.runFor(200);
    await page.getByText(text, { exact: true }).waitFor();
    pass("Managed browser narration exposes text only after synthesis failure");
    await page.goto(base);
    const observation = {
      plan: "Basic",
      remainingCredits: 13231,
      observedAt: new Date().toISOString(),
      connectedServices: ["Gmail"],
      connectorCatalogCount: 48,
      mcpCatalogCount: 402,
      installedMcpCount: 0,
      activeTasks: ["Morning brief"],
      personalAgents: ["Chief of Staff (2)"],
    };
    assert.equal(
      (
        await context.request.put(base + "/api/director/abacus/hub", {
          headers: { Origin: base },
          data: observation,
        })
      ).status(),
      200,
    );
    const status = await context.request.get(
      base + "/api/director/operational-status?verify=1",
    );
    assert.equal(status.status(), 200);
    const metadata = await status.json();
    assert.equal(metadata.abacus.modelCount, 4);
    assert.equal(metadata.abacus.toolsCount, 2);
    assert.equal(metadata.abacus.observation.plan, "Basic");
    pass(
      "The actual neural status route supplies model catalog and encrypted account observation",
    );
    await page
      .getByRole("button", { name: "Ativar microfone", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Desativar microfone", exact: true })
      .waitFor();
    await page.evaluate(() => {
      window.__pc.dc.send = (e) => window.__sent.push(JSON.parse(e));
      window.__pc.ontrack({ streams: [new MediaStream()] });
      window.__dc.onmessage({
        data: JSON.stringify({
          type: "conversation.item.input_audio_transcription.completed",
          item_id: "user-abacus",
          transcript: "Quais recursos da minha conta Abacus você conhece?",
        }),
      });
      const call = {
        type: "response.done",
        response_id: "tool-response",
        response: {
          status: "completed",
          output: [
            {
              type: "function_call",
              name: "jarvis_operational_status",
              call_id: "abacus-call",
              arguments: "{}",
            },
          ],
        },
      };
      window.__dc.onmessage({ data: JSON.stringify(call) });
      window.__dc.onmessage({ data: JSON.stringify(call) });
    });
    await page.waitForFunction(() =>
      window.__sent.some((e) => e.item?.type === "function_call_output"),
    );
    const sent = await page.evaluate(() => window.__sent);
    const output = JSON.parse(
      sent.find((e) => e.item?.type === "function_call_output").item.output,
    );
    assert.equal(output.abacus.modelCount, 4);
    assert.equal(output.abacus.observation.plan, "Basic");
    assert.equal(output.abacus.privateAccountForwarded, true);
    assert.equal(sent.filter((e) => e.type === "response.create").length, 1);
    pass(
      "The neural tool shares approved account metadata once for an explicit Abacus account question",
    );
    const spoken =
      "O catálogo da Abacus possui quatro modelos neste cenário de teste. Os dados privados da conta permanecem no JK.";
    const before = await page.evaluate(() => window.__utterances.length);
    await page.evaluate((spoken) => {
      for (const e of [
        { type: "response.created", response_id: "answer" },
        { type: "output_audio_buffer.started" },
        {
          type: "response.output_text.delta",
          item_id: "answer-item",
          delta: spoken,
        },
        {
          type: "response.output_audio_transcript.delta",
          item_id: "answer-item",
          delta: spoken,
        },
        {
          type: "response.output_audio_transcript.done",
          item_id: "answer-item",
          transcript: spoken,
        },
      ])
        window.__dc.onmessage({ data: JSON.stringify(e) });
    }, spoken);
    await page.clock.runFor(1000);
    assert.equal(await page.getByText(spoken, { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.__utterances.length), before);
    assert.ok(
      await page.getByRole("heading", { name: "Abacus", exact: true }).count(),
    );
    pass(
      "Neural audio remains the sole speaker and mixed transcript events stay off screen",
    );
    await page.screenshot({
      path: path.join(out, "02-neural-abacus.png"),
      animations: "disabled",
    });
    await page.evaluate(() => window.__neuralAudio.onerror(new Event("error")));
    await page.clock.runFor(200);
    await page.getByText(spoken, { exact: true }).waitFor();
    pass(
      "The spoken answer becomes readable only after neural audio is unavailable",
    );
    assert.deepEqual(errors, []);
    pass("No uncaught browser errors, microphone access or paid API calls");
  } finally {
    await fs.writeFile(
      path.join(out, "browser-results.json"),
      JSON.stringify(
        {
          results,
          count: results.length,
          services:
            "Loopback fixtures; public-source live checks are recorded separately; no paid APIs or real microphone",
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
