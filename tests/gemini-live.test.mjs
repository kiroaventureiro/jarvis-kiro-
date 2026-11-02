import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const compile = (file, replacements = {}) => {
  let code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [name, value] of Object.entries(replacements)) code = code.replace(new RegExp(`import[^;]+from "${name}";`, "g"), value);
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
};
const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 130)); };
const state = { audio: [], callbacks: null, responses: [], inputs: [], connects: 0 };
globalThis.__geminiTest = state;
const { GeminiLiveVoiceAdapter } = await compile("lib/voice/gemini-live-adapter.ts", {
  "@google/genai": `const GoogleGenAI = class { constructor(options) { globalThis.__geminiTest.credentials = options; } live = { connect: async ({callbacks, config}) => { const s = globalThis.__geminiTest; s.callbacks = callbacks; s.config = config; s.connects++; return { close() {}, sendRealtimeInput(v) { s.inputs.push(v); }, sendClientContent(v) { s.typed = v; }, sendToolResponse(v) { s.responses.push(v); } }; } }; };`,
  "./gemini-audio": `const GeminiAudio = class { unlockPlayback() { this.unlocked = true; } async start(fn) { this.capture = fn; this.starts = (this.starts || 0) + 1; globalThis.__geminiTest.audio.push(this); } pauseCapture() { this.paused = (this.paused || 0) + 1; } volume(v) { this.level = v; } play(v) { (this.played ||= []).push(v); } interrupt() { this.interrupted = (this.interrupted || 0) + 1; } close() { this.closed = true; } };`,
  "./gemini-config": `const GEMINI_JARVIS_TOOL = "jarvis_conversation";`,
});
let calls = [], states = [], users = [], replies = [], volume = 0.4, command;
async function setup() {
  state.responses = []; calls = []; states = []; users = []; replies = [];
  command = async text => ({ text: `Jarvis: ${text}` });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ token: "ephemeral-test", model: "gemini-3.8-live", newSessionExpiresAt: new Date(Date.now() + 60000).toISOString(), expiresAt: new Date(Date.now() + 1800000).toISOString() }) });
  const adapter = new GeminiLiveVoiceAdapter({
    command: (text, signal) => { calls.push({ text, signal }); return command(text, signal); },
    onState: v => states.push(v), onUser: v => users.push(v), onReply: v => replies.push(v),
    onSpeechUnavailable() {}, desktopAudioAllowed: () => true, volume: () => volume, navigate() {},
  });
  adapter.start(); await tick(); return adapter;
}
const message = v => state.callbacks.onmessage(v);
const tool = (id = "call-1", name = "jarvis_conversation", args = {}) => ({ toolCall: { functionCalls: [{ id, name, args }] } });
const transcript = text => ({ serverContent: { inputTranscription: { text, finished: true } } });
test("Gemini Live hybrid lifecycle", async t => {
  await t.test("PCM continuous input; Jarvis owns the answer; volume and immediate interruption", async () => {
    const adapter = await setup();
    const audio = state.audio.at(-1); assert.equal(audio.unlocked, true, "speaker output is unlocked by the explicit user gesture"); audio.capture("pcm-input");
    assert.equal(state.inputs.at(-1).audio.mimeType, "audio/pcm;rate=16000");
    message({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm", data: "premature" } }] } } });
    assert.equal(audio.played, undefined);
    message(transcript("Lembre do projeto")); message(tool()); await tick();
    assert.equal(calls.length, 1); assert.equal(calls[0].text, "Lembre do projeto");
    assert.equal(state.responses[0].functionResponses[0].response.text, "Jarvis: Lembre do projeto");
    message({ serverContent: { modelTurn: { parts: [1, 2].map(n => ({ inlineData: { mimeType: "audio/pcm;rate=24000", data: `audio${n}` } })) } } });
    assert.deepEqual(audio.played, ["audio1", "audio2"]); assert.equal(audio.level, 0.4);
    volume = 0; adapter.audioMuted(); assert.equal(audio.level, 0);
    const before = audio.interrupted; message({ serverContent: { interrupted: true } });
    assert.equal(audio.interrupted, before + 1); assert.equal(calls[0].signal.aborted, true);
    adapter.stop(); assert.equal(audio.closed, true); assert.equal(states.at(-1).enabled, false);
  });
  await t.test("infinite listening toggle pauses only the microphone; Gemini session and text replies stay connected", async () => {
    const adapter = await setup();
    const connects = state.connects;
    const audio = state.audio.at(-1);
    adapter.suspendForExternal();
    assert.equal(states.at(-1).enabled, true, "external UI activity must not turn off the user's infinite-listening toggle");
    assert.equal(states.at(-1).connected, true);
    message(transcript("Pergunta antes de pausar"));
    message(tool("spoken-before-pause"));
    await tick();
    message({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm", data: "reply-audio" } }] } } });
    assert.deepEqual(audio.played, ["reply-audio"]);
    adapter.disableListening();
    assert.equal(audio.paused, 1);
    assert.equal(states.at(-1).phase, "speaking", "pausing the mic must not demote an active reply to idle");
    assert.equal(states.at(-1).enabled, false);
    assert.equal(states.at(-1).connected, true);
    assert.equal(adapter.sendText("Responder mesmo com o infinito desligado"), true);
    message(tool("text-while-paused"));
    await tick();
    assert.equal(calls.at(-1).text, "Responder mesmo com o infinito desligado");
    assert.equal(state.connects, connects);
    adapter.start();
    await tick();
    assert.equal(state.connects, connects);
    assert.equal(state.audio.at(-1).starts, 2);
    assert.equal(states.at(-1).enabled, true);
    adapter.stop();
  });
  await t.test("turn is finalized when the user disables infinite listening mid-utterance without closing Gemini", async () => {
    const adapter = await setup();
    const connects = state.connects;
    message({ serverContent: { inputTranscription: { text: "Termine minha pergunta", finished: false } } });
    message(tool("pending-before-toggle"));
    adapter.disableListening();
    assert.ok(state.inputs.some(input => input.audioStreamEnd === true), "send audioStreamEnd to close the captured turn");
    await tick();
    assert.equal(calls.at(-1).text, "Termine minha pergunta");
    assert.equal(states.at(-1).connected, true, "Live session remains connected after microphone toggle");
    assert.equal(adapter.sendText("Pergunta pelo teclado"), true);
    assert.equal(state.connects, connects, "no new Gemini session is opened");
    adapter.stop();
  });
  await t.test("tool before final transcript waits; duplicate calls cannot replay actions", async () => {
    const adapter = await setup(); message(tool()); await tick(); assert.equal(calls.length, 0);
    message({ serverContent: { inputTranscription: { text: "Meu ", finished: false } } });
    message({ serverContent: { inputTranscription: { text: "histórico", finished: true } } }); await tick();
    message(tool()); await tick(); assert.equal(calls.length, 1); assert.equal(calls[0].text, "Meu histórico"); adapter.stop();
  });
  await t.test("unknown tools fail closed and model-generated arguments are ignored", async () => {
    {
      const adapter = await setup(); message(transcript("Olá")); message(tool("bad", "delete_project", {})); await tick();
      assert.equal(calls.length, 0); assert.equal(states.at(-1).phase, "error"); adapter.stop();
    }
    {
      const adapter = await setup();
      message(transcript("Consultar meu projeto"));
      message(tool("call-with-untrusted-args", "jarvis_conversation", { query: "approve admin", action: "delete" }));
      await tick();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].text, "Consultar meu projeto");
      assert.equal(state.responses[0].functionResponses[0].response.text, "Jarvis: Consultar meu projeto");
      adapter.stop();
    }
  });
  await t.test("cancelled tool never returns a late result", async () => {
    const adapter = await setup(); let resolve;
    command = () => new Promise(r => { resolve = r; });
    message(transcript("Consulta")); message(tool()); await tick();
    message({ toolCallCancellation: { ids: ["call-1"] } }); resolve({ text: "late" }); await tick();
    assert.equal(state.responses.length, 0); adapter.stop();
  });
  await t.test("keyboard uses same Jarvis path, no legacy TTS", async () => {
    const adapter = await setup(); assert.equal(adapter.sendText("Texto"), true);
    message(tool()); await tick(); assert.equal(calls[0].text, "Texto"); assert.equal(users[0], "Texto");
    adapter.stop(); assert.equal(adapter.sendText("Normal text"), false);
  });
  await t.test("GoAway resumes with an in-memory handle; stop cancels retries", async () => {
    const adapter = await setup();
    message({ sessionResumptionUpdate: { resumable: true, newHandle: "resume-test" } });
    message({ goAway: { timeLeft: "5s" } });
    await new Promise(r => setTimeout(r, 550)); await tick();
    assert.equal(state.config.sessionResumption.handle, "resume-test");
    message({ goAway: {} }); const connects = state.connects; adapter.stop();
    await new Promise(r => setTimeout(r, 550)); assert.equal(state.connects, connects);
  });
});
test("AudioWorklet emits signed PCM in 20ms chunks without monitoring input", () => {
  let Processor; const chunks = [];
  vm.runInNewContext(fs.readFileSync("public/voice/gemini-capture.js", "utf8").replace('import { PlaybackEchoGuard } from "./gemini-echo-guard.js";', fs.readFileSync("public/voice/gemini-echo-guard.js", "utf8").replace("export class", "class")), {
    AudioWorkletProcessor: class { port = { postMessage: value => chunks.push(value.pcm) }; },
    registerProcessor: (_name, value) => { Processor = value; }, Int16Array, Math,
  });
  const worklet = new Processor();
  for (let i = 0; i < 5; i++) worklet.process([[new Float32Array(128).fill(i % 2 ? -1 : 1)]]);
  assert.equal(chunks.length, 2); assert.equal(chunks[0].byteLength, 640);
  assert.equal(new Int16Array(chunks[0])[0], 32767); assert.equal(new Int16Array(chunks[0])[128], -32768);
});
test("audio capture, PCM decode, cancellable playback and late permission cleanup", async () => {
  const contexts = [], tracks = [], nodes = [];
  globalThis.AudioContext = class {
    state = "running"; currentTime = 1; destination = {}; audioWorklet = { addModule: async () => {} };
    constructor(config) { this.config = config; contexts.push(this); }
    async resume() { this.state = "running"; }
    addEventListener() {}
    createGain() { return { gain: { value: 1 }, connect() { return this; }, disconnect() {} }; }
    createMediaStreamSource() { return { connect() {} }; }
    createBuffer(_channels, length, rate) { const floats = new Float32Array(length); this.decoded = floats; return { getChannelData: () => floats, duration: length / rate }; }
    createBufferSource() { const source = { onended: null, connect() {}, disconnect() {}, start(time) { this.time = time; }, stop() { this.stopped = true; } }; nodes.push(source); return source; }
    async close() { this.state = "closed"; }
  };
  globalThis.AudioWorkletNode = class { port = {}; constructor() { globalThis.__capture = this; } connect() { return this; } disconnect() {} };
  const track = () => { const t = { stop() { this.stopped = true; } }; tracks.push(t); return t; };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaDevices: { async getUserMedia(options) {
    assert.equal(options.audio.echoCancellation, true); assert.equal(options.audio.noiseSuppression, true);
    const t = track(); return { getTracks: () => [t], getAudioTracks: () => [t] };
  } } } });
  const { GeminiAudio } = await compile("lib/voice/gemini-audio.ts");
  const audio = new GeminiAudio(); let pcm, drained = 0;
  audio.onDrained = () => { drained++; };
  await audio.start(data => { pcm = data; });
  assert.equal(contexts[0].config.sampleRate, 16000);
  globalThis.__capture.port.onmessage({ data: { pcm: new Int16Array([32767, -32768]).buffer, echoFrames: 0 } });
  assert.deepEqual([...Buffer.from(pcm, "base64")], [255, 127, 0, 128]);
  audio.play(pcm); assert.equal(contexts[0].decoded[0], 32767 / 32768); assert.equal(contexts[0].decoded[1], -1);
  audio.play(pcm); assert.equal(nodes.length, 1, "only one buffer is scheduled at a time");
  nodes[0].onended(); assert.equal(nodes.length, 2); assert.ok(nodes[1].time >= nodes[0].time);
  audio.interrupt(); assert.equal(nodes[1].stopped, true);
  audio.pauseCapture();
  assert.ok(tracks[0].stopped);
  assert.equal(contexts[0].state, "running", "pausing the infinite microphone must preserve the Gemini output context");
  contexts[0].state = "suspended";
  for (let i = 0; i < 200; i++) audio.play(pcm);
  await tick();
  assert.equal(contexts[0].state, "running", "playback automatically resumes a suspended AudioContext");
  assert.equal(nodes.length, 3, "a long reply is queued instead of scheduling seconds into the future");
  for (let i = 2; i < 201; i++) nodes[i].onended();
  assert.equal(nodes.length, 202, "all queued audio chunks are played in order");
  nodes[201].onended();
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(drained, 1, "drain notification waits for the final chunk instead of firing between chunks");
  await audio.start(() => {});
  assert.equal(contexts.length, 1, "re-enabling the microphone must reuse the live audio context");
  assert.equal(tracks.length, 2);
  audio.close(); assert.ok(tracks[1].stopped); assert.equal(contexts[0].state, "closed");
  let grant;
  navigator.mediaDevices.getUserMedia = () => new Promise(r => { grant = r; });
  const late = new GeminiAudio(); const pending = late.start(() => {}); await tick(); late.close();
  const t = track(); grant({ getTracks: () => [t] }); await pending; assert.ok(t.stopped);
});
test("HTTP failures are actionable and never open microphone or alternate TTS", async () => {
  const adapter = await setup(); adapter.stop();
  for (const [status, code] of [[401, "AUTH_REQUIRED"], [403, "LIVE_DISABLED"], [503, "SESSION_BUDGET_INVALID"]]) {
    const captures = state.audio.length, connections = state.connects;
    globalThis.fetch = async () => ({ ok: false, status, json: async () => ({ code, error: "unsafe upstream token should never be shown" }) });
    adapter.start(); await tick();
    assert.equal(state.audio.length, captures); assert.equal(state.connects, connections);
    assert.equal(states.at(-1).phase, "error"); assert.match(states.at(-1).message, new RegExp(`HTTP ${status}.*${code}`));
    assert.ok(!states.at(-1).message.includes("unsafe upstream"));
    assert.equal(adapter.sendText("No fallback"), false); adapter.stop();
  }
});
test("late playback transcript does not cancel own audio or become a Jarvis command", async () => {
  const adapter = await setup(); message(transcript("Uma consulta")); message(tool()); await tick();
  message({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm", data: "audio" } }] } } });
  const audio = state.audio.at(-1), interrupted = audio.interrupted;
  message(transcript("Vazamento da própria resposta")); await tick();
  assert.equal(audio.interrupted, interrupted); assert.equal(calls.length, 1);
  message({ serverContent: { interrupted: true, inputTranscription: { text: "Fala humana nova", finished: true } } });
  message(tool("call-human")); await tick();
  assert.equal(audio.interrupted > interrupted, true); assert.equal(calls.at(-1).text, "Fala humana nova"); adapter.stop();
});
test("playback reference rejects delayed echo and preserves near-end/double-talk", async () => {
  const { PlaybackEchoGuard } = await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync("public/voice/gemini-echo-guard.js", "utf8")).toString("base64")}`);
  const guard = new PlaybackEchoGuard(); let seed = 17;
  const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed / 0x100000000 - 0.5) * 0.4; };
  const previous = [];
  for (let frame = 0; frame < 16; frame++) {
    const ref = Float32Array.from({ length: 320 }, noise); previous.push(ref);
    const echo = frame >= 4 ? Float32Array.from(previous[frame - 4], v => v * 0.55) : new Float32Array(320);
    assert.equal(guard.process(echo, ref), frame >= 4, `echo at frame ${frame}`);
  }
  const human = Float32Array.from({ length: 320 }, noise);
  assert.equal(guard.process(human, new Float32Array(320)), false);
  const mixed = Float32Array.from(previous.at(-2), (v, i) => v * 0.5 + human[i]);
  assert.equal(guard.process(mixed, Float32Array.from({ length: 320 }, noise)), false);
});
test("Gemini Live is the default engine only on explicitly approved Preview deployments", () => {
  const page = fs.readFileSync("app/page.tsx", "utf8");
  assert.match(page, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(page, /JARVIS_GEMINI_LIVE_ENABLED === "true"/);
  assert.match(page, /JARVIS_GEMINI_LIVE_PAID_ALLOWED === "true"/);
  assert.match(page, /JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR/);
  assert.match(page, /experimentalGemini=\{experimentalGemini\}/);
  assert.doesNotMatch(page, /process\.env\.VERCEL_ENV === "production"\s*\|\|/);
});
test("exclusive owner blocks browser and neural speech until released", async () => {
  const { claimGeminiAudio, assertLegacyAudioAllowed } = await compile("lib/voice/audio-owner.ts");
  assert.doesNotThrow(assertLegacyAudioAllowed); const release = claimGeminiAudio();
  assert.throws(assertLegacyAudioAllowed, /GEMINI_EXCLUSIVE/); release(); release();
  assert.doesNotThrow(assertLegacyAudioAllowed);
  for (const file of ["speech-output.ts", "neural-speech-output.ts"])
    assert.match(fs.readFileSync(`lib/voice/${file}`, "utf8"), /assertLegacyAudioAllowed\(\)/);
  const parent = fs.readFileSync("app/components/JarvisExperience.tsx", "utf8");
  assert.match(parent, /if \(geminiRequested && !workspace.files.length\) \{ liveActivate.current\?\.\(\); return; \}/);
  assert.match(parent, /desktopVoice && !geminiRequested && !muteRef.current/);
  assert.match(parent, /resposta somente por texto/);
  assert.match(parent, /shown.length && !holoSession.current && \(typing \|\| history\)/);
  const wake = fs.readFileSync("app/components/WakeListener.tsx", "utf8");
  assert.ok(!wake.includes('const experimental = new URLSearchParams'));
  assert.doesNotMatch(wake, /document\.hidden[\s\S]{0,180}controller\.stop/);
  assert.match(wake, /engine\.current\?\.disableListening\(\)/);
  const adapter = fs.readFileSync("lib/voice/gemini-live-adapter.ts", "utf8");
  assert.match(adapter, /sessionActive/);
  assert.match(adapter, /connected: this\.sessionActive && this\.ready/);
  assert.match(adapter, /sendText\(text: string\)[\s\S]*?if \(!this\.sessionActive\) return false/);
});

test("stale tool cancellation must not suppress a newer audible answer", async () => {
  const adapter = await setup();
  message(transcript("Pergunta atual"));
  message(tool("current-call"));
  await tick();
  assert.equal(state.responses.length, 1);
  const before = state.audio.at(-1).played?.length || 0;
  message({ toolCallCancellation: { ids: ["outdated-call"] } });
  message({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: "current-voice" } }] } } });
  assert.equal(state.audio.at(-1).played?.length, before + 1, "unrelated cancellation cannot mute current PCM");
  adapter.stop();
});

test("infinite-audio entry selects Gemini before trying to activate the microphone", () => {
  const component = fs.readFileSync("app/components/JarvisExperience.tsx", "utf8");
  const start = component.indexOf("async function microphone()");
  const end = component.indexOf("\\n  }", start);
  const handler = component.slice(start, start + 900);
  assert.ok(handler.includes("setGeminiRequested(true)"), "infinite audio selects Gemini Live");
  assert.ok(handler.includes("liveActivate.current?.()"), "subsequent use activates Gemini and browser microphone together");
  assert.ok(!component.includes('>Ativar Gemini Live</button>'), "no separate Gemini toggle to inadvertently reset microphone");
  const listener = fs.readFileSync("app/components/WakeListener.tsx", "utf8");
  assert.match(listener, /if \(props\.geminiRequested && !authorized\) setConsent\(true\)/);
  assert.match(listener, /engine\.current\?\.start\(\)/);
});
