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
      args: ["--no-sandbox"],
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
    await page.goto(base);
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    const research = await context.request.post(
      base + "/api/director/research",
      {
        headers: { Origin: base },
        data: { query: "Como funciona um semicondutor?" },
      },
    );
    assert.equal(research.status(), 200);
    const data = await research.json();
    assert.equal(data.available, true);
    assert.ok(data.visual.sources.length);
    pass(
      "Neural voice research endpoint can retrieve general public references without another model call",
    );
    await page
      .getByRole("button", { name: "Ativar microfone", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Desativar microfone", exact: true })
      .waitFor();
    await page.evaluate(() => {
      for (const type of ["response.created", "output_audio_buffer.started"])
        window.__dc.onmessage({ data: JSON.stringify({ type }) });
    });
    await page.clock.runFor(300);
    assert.equal(
      await page.locator("main").getAttribute("data-state"),
      "responding",
    );
    await page
      .getByRole("button", { name: "Ativar escuta por Jarvis", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ativar escuta", exact: true })
      .click();
    await page.clock.runFor(1500);
    assert.notEqual(
      await page.evaluate(() => window.__pc.connectionState),
      "closed",
    );
    assert.equal(
      await page.locator("main").getAttribute("data-state"),
      "responding",
    );
    assert.equal(
      await page.evaluate(() => window.__recs.filter((r) => r.active).length),
      0,
    );
    pass(
      "Arming browser listening during neural narration preserves the current session and audio state",
    );
    await page.evaluate(() => {
      window.__dc.onmessage({
        data: JSON.stringify({
          type: "response.done",
          response: { status: "completed" },
        }),
      });
      window.__dc.onmessage({
        data: JSON.stringify({ type: "output_audio_buffer.stopped" }),
      });
    });
    await page.clock.runFor(1200);
    assert.equal(
      await page.evaluate(() => window.__pc.connectionState),
      "closed",
    );
    assert.ok(await page.evaluate(() => window.__recs.some((r) => r.active)));
    assert.ok(await page.evaluate(() => window.__stopped > 0));
    pass(
      "Mode handoff closes neural input only after speech ends and then activates continuous recognition",
    );
    assert.deepEqual(errors, []);
    pass(
      "Neural-to-browser handoff completes without uncaught errors or real paid sessions",
    );
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
