const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--mute-audio",
    ],
  });
  const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3153",
    out = process.env.TEST_OUTPUT_DIR || "work/jk-evidence";
  try {
    const context = await browser.newContext({
      viewport: { width: 900, height: 700 },
    });
    await context.addInitScript(() => {
      window.__captures = 0;
      window.__audioContexts = [];
      const NativeContext = window.AudioContext;
      window.AudioContext = class extends NativeContext {
        constructor(...args) {
          super(...args);
          window.__audioContexts.push(this);
        }
      };
      navigator.mediaDevices.getUserMedia = async () => {
        window.__captures++;
        const ctx = new AudioContext(),
          oscillator = ctx.createOscillator(),
          gain = ctx.createGain(),
          destination = ctx.createMediaStreamDestination();
        gain.gain.value = 0.12;
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start();
        await ctx.resume();
        window.__syntheticContext = ctx;
        window.__syntheticStream = destination.stream;
        window.__oscillator = oscillator;
        return destination.stream;
      };
      HTMLMediaElement.prototype.play = async function () {};
      class Channel extends EventTarget {
        readyState = "connecting";
        constructor() {
          super();
          window.__dc = this;
        }
        send() {}
        close() {
          this.readyState = "closed";
          this.dispatchEvent(new Event("close"));
          this.onclose?.();
        }
      }
      window.RTCPeerConnection = class {
        connectionState = "new";
        constructor() {
          window.__pc = this;
        }
        createDataChannel() {
          return (this.dc = new Channel());
        }
        addTrack() {}
        addTransceiver() {}
        async createOffer() {
          return { type: "offer", sdp: "synthetic-test-sdp" };
        }
        async setLocalDescription() {}
        async setRemoteDescription() {
          this.ontrack?.({ streams: [window.__syntheticStream] });
          this.dc.readyState = "open";
          this.dc.dispatchEvent(new Event("open"));
          this.dc.onopen?.();
        }
        close() {
          this.connectionState = "closed";
        }
      };
      window.__send = (type) =>
        window.__dc.onmessage?.({ data: JSON.stringify({ type }) });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/voice", (r) =>
      r.fulfill({ json: { value: "synthetic-session-only" } }),
    );
    await page.route("https://api.openai.com/**", (r) =>
      r.fulfill({ body: "synthetic-answer", contentType: "application/sdp" }),
    );
    await page.goto(base);
    await page.locator(".jk-core[data-renderer=webgl]").waitFor();
    assert.equal(await page.evaluate(() => window.__captures), 0);
    await page
      .getByRole("button", { name: "Ativar microfone", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Desativar microfone", exact: true })
      .waitFor();
    await page.evaluate(() =>
      window.__send("input_audio_buffer.speech_started"),
    );
    await page.locator("main[data-audio-visual=input-level]").waitFor();
    await page.locator(".jk-core[data-phase=listening]").waitFor();
    await fs.mkdir(out, { recursive: true });
    await page.screenshot({ path: path.join(out, "real-signal-input.png") });
    await page.evaluate(() => {
      window.__send("input_audio_buffer.speech_stopped");
      window.__send("output_audio_buffer.started");
    });
    await page.locator("main[data-audio-visual=output-level]").waitFor();
    await page.locator(".jk-core[data-phase=responding]").waitFor();
    assert.equal(await page.evaluate(() => window.__captures), 1);
    await page.screenshot({ path: path.join(out, "real-signal-output.png") });
    await page
      .getByRole("button", { name: "Encerrar sessão", exact: true })
      .click();
    await page.locator("main[data-audio-visual=representative]").waitFor();
    assert.equal(
      await page.evaluate(() =>
        window.__syntheticStream
          .getAudioTracks()
          .every((t) => t.readyState === "ended"),
      ),
      true,
    );
    await page.waitForFunction(() =>
      window.__audioContexts
        .filter((c) => c !== window.__syntheticContext)
        .every((c) => c.state === "closed"),
    );
    await page.evaluate(() => {
      window.__oscillator.stop();
      return window.__syntheticContext.close();
    });
    assert.deepEqual(errors, []);
    const result = {
      scenario: "authorized-stream-envelope",
      source:
        "synthetic oscillator; no operating-system microphone or provider calls",
      inputAnalyser: true,
      outputAnalyser: true,
      captureRequests: 1,
      noExtraCaptureForGraphics: true,
      visualModeHonest: true,
      audioResourcesClosed: true,
    };
    await fs.writeFile(
      path.join(out, "audio-results.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
