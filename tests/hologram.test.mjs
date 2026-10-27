import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
async function load(file) {
  const source = fs.readFileSync(file, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );
}
const policy = await load("lib/hologram/policy.ts"),
  { createGeometry } = await load("lib/hologram/geometry.ts"),
  { observeAudio } = await load("lib/hologram/audio.ts");
test("core follows actual voice, file and assistant states", () => {
  for (const [state, voice, busy, recording, expected] of [
    ["idle", "off", false, false, "idle"],
    ["idle", "waiting", false, false, "waiting"],
    ["idle", "command", false, false, "listening"],
    ["listening", "off", false, false, "listening"],
    ["idle", "off", false, true, "listening"],
    ["processing", "off", false, false, "processing"],
    ["connecting", "off", false, false, "processing"],
    ["idle", "off", true, false, "processing"],
    ["idle", "speaking", false, false, "responding"],
    ["responding", "off", false, false, "responding"],
    ["idle", "resuming", false, false, "processing"],
    ["error", "waiting", false, false, "error"],
    ["idle", "error", false, false, "error"],
  ])
    assert.equal(policy.corePhase(state, voice, busy, recording), expected);
});
test("signal intensity affects listening and speaking while fallback stays bounded", () => {
  for (const phase of [
    "idle",
    "waiting",
    "listening",
    "processing",
    "responding",
    "error",
  ])
    for (let t = 0; t < 30; t += 0.3) {
      const energy = policy.phaseEnergy(phase, t, null);
      assert.ok(energy.energy > 0.2 && energy.energy < 2);
      assert.ok(energy.speed > 0);
    }
  for (const phase of ["listening", "responding"]) {
    assert.ok(
      policy.phaseEnergy(phase, 1, 1).energy >
        policy.phaseEnergy(phase, 1, 0).energy,
    );
    assert.equal(
      policy.phaseEnergy(phase, 1, 8).energy,
      policy.phaseEnergy(phase, 1, 1).energy,
    );
  }
  assert.ok(
    policy.phaseEnergy("processing", 1, null).speed >
      policy.phaseEnergy("idle", 1, null).speed,
  );
});
test("resolution, particle and frame budgets adapt to small or limited devices", () => {
  assert.equal(policy.graphicsProfile("auto", 390, 3, 8, 8).dpr, 1);
  assert.equal(policy.graphicsProfile("auto", 1440, 3, 8, 8).dpr, 1.5);
  assert.equal(policy.graphicsProfile("eco", 1440, 2, 16, 16).fps, 24);
  assert.equal(policy.graphicsProfile("auto", 1440, 2, 4, 4).particles, 80);
  const size = policy.canvasSize(3000, 2000, 3);
  assert.ok(size.width * size.height < 1_405_000);
  const adaptive = new policy.AdaptiveResolution(1.5);
  for (let i = 0; i < 23; i++) assert.equal(adaptive.observe(100, 25), false);
  assert.equal(adaptive.observe(100, 25), true);
  assert.equal(adaptive.dpr, 1.25);
  for (let i = 0; i < 1000; i++) adaptive.observe(100, 25);
  assert.equal(adaptive.dpr, 0.75);
  const overloaded = new policy.AdaptiveResolution(1.5);
  for (let i = 0; i < 8; i++) overloaded.observe(160, 25);
  assert.equal(overloaded.dpr, 0.75);
  assert.equal(overloaded.fallback, false);
  for (let i = 0; i < 12; i++) overloaded.observe(160, 25);
  assert.equal(overloaded.fallback, true);
});
test("shell and independent orbits contain depth and finite deterministic geometry", () => {
  const a = createGeometry(500),
    b = createGeometry(500);
  assert.equal(a.particles, 150);
  assert.deepEqual(a.lines, b.lines);
  assert.equal(a.lines.length % 14, 0);
  assert.ok(a.lines.length < 50000);
  assert.ok([...a.lines, ...a.points].every(Number.isFinite));
  for (let family = 1; family <= 4; family++) {
    const depth = [];
    for (let i = 0; i < a.lines.length; i += 7)
      if (a.lines[i + 3] === family) depth.push(a.lines[i + 2]);
    assert.ok(Math.min(...depth) < -0.5);
    assert.ok(Math.max(...depth) > 0.5);
  }
  assert.equal(createGeometry(-1).particles, 0);
});
test("audio observation never obtains permission or stops an owned stream", async () => {
  const original = globalThis.AudioContext;
  let created = 0,
    closed = 0,
    disconnected = 0,
    stopCalls = 0,
    amplitude = 128,
    connections = 0;
  const track = {
      enabled: true,
      readyState: "live",
      stop() {
        stopCalls++;
      },
    },
    stream = { getAudioTracks: () => [track] };
  class Context {
    state = "running";
    constructor() {
      created++;
    }
    createMediaStreamSource() {
      return {
        connect() {
          connections++;
        },
        disconnect() {
          disconnected++;
        },
      };
    }
    createAnalyser() {
      return {
        fftSize: 256,
        smoothingTimeConstant: 0,
        getByteTimeDomainData(bytes) {
          bytes.fill(amplitude);
        },
        disconnect() {
          disconnected++;
        },
      };
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      closed++;
      this.state = "closed";
      return Promise.resolve();
    }
  }
  globalThis.AudioContext = Context;
  try {
    assert.equal(observeAudio(null, "input-level").mode, "representative");
    assert.equal(created, 0);
    const meter = observeAudio(stream, "input-level");
    assert.equal(meter.mode, "input-level");
    assert.equal(meter.read(), 0);
    amplitude = 180;
    assert.ok(meter.read() > 0);
    assert.equal(connections, 1);
    track.readyState = "ended";
    assert.equal(meter.mode, "representative");
    assert.equal(meter.read(), null);
    meter.dispose();
    meter.dispose();
    assert.equal(closed, 1);
    assert.equal(disconnected, 2);
    assert.equal(stopCalls, 0);
    assert.equal(meter.read(), null);
  } finally {
    globalThis.AudioContext = original;
  }
});
test("unavailable or suspended audio uses an honest representative fallback", () => {
  const original = globalThis.AudioContext;
  try {
    globalThis.AudioContext = class {
      constructor() {
        throw Error("unsupported");
      }
    };
    const meter = observeAudio(
      { getAudioTracks: () => [{ enabled: true, readyState: "live" }] },
      "output-level",
    );
    assert.equal(meter.mode, "representative");
    assert.equal(meter.read(), null);
    meter.dispose();
  } finally {
    globalThis.AudioContext = original;
  }
});

test("economic preference remains usable when storage is unavailable", () => {
  const stored = Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
    oldWindow = globalThis.window;
  let emitted = 0;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        throw Error("blocked");
      },
      setItem() {
        throw Error("quota");
      },
    },
  });
  globalThis.window = {
    dispatchEvent() {
      emitted++;
    },
  };
  try {
    policy.setGraphicsPreference("eco");
    assert.equal(policy.readGraphicsPreference(), "eco");
    assert.equal(emitted, 1);
    policy.setGraphicsPreference("auto");
  } finally {
    if (stored) Object.defineProperty(globalThis, "localStorage", stored);
    else delete globalThis.localStorage;
    globalThis.window = oldWindow;
  }
});
