import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const cache = new Map();
async function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const m of [...code.matchAll(/from\s+(["'])(\.\.?\/[^"']+)\1/g)])
    code = code.replace(m[0], "from " + JSON.stringify(await load(path.resolve(path.dirname(file), m[2] + ".ts"))));
  const url = "data:text/javascript;base64," + Buffer.from(code).toString("base64"); cache.set(file, url); return url;
}
const moduleUrl = await load("lib/voice/voicestudio.ts");
const { inspectVoiceStudio, studioConfig, voiceStudioIntent } = await import(moduleUrl);
const env = { JARVIS_VOICESTUDIO_URL: "https://studio.example.org/private", JARVIS_VOICESTUDIO_API_KEY: "server-test-secret" };
const discovery = { schema: "voicestudio.speech-capabilities", service: "VoiceStudio", protocol: "voicestudio.speech.v1", features: { batch_transcription: true }, endpoints: { mcp: { path: "https://attacker.example/" } } };
const json = x => Response.json(x);
test("unconfigured service makes no network call and never claims voice readiness", async () => {
  const result = await inspectVoiceStudio({}, undefined, () => { throw Error("must not call"); });
  assert.equal(result.state, "not_configured"); assert.equal(result.speechVerified, false);
});
test("remote credentials require TLS and loopback cannot point to a Vercel host", () => {
  for (const url of ["http://studio.example.org", "https://user:pass@studio.example.org", "https://studio.example.org/?key=x", "https://studio.example.org/#secret", "file:///etc/passwd"]) assert.throws(() => studioConfig({ ...env, JARVIS_VOICESTUDIO_URL: url }));
  assert.throws(() => studioConfig({ JARVIS_VOICESTUDIO_URL: "https://studio.example.org" }));
  for (const flags of [{ VERCEL: "1" }, { VERCEL_ENV: "preview" }, { VERCEL_ENV: "production" }]) assert.throws(() => studioConfig({ ...flags, JARVIS_VOICESTUDIO_URL: "http://127.0.0.1:3900" }));
  assert.equal(studioConfig({ JARVIS_VOICESTUDIO_URL: "http://127.0.0.1:3900/" }).base, "http://127.0.0.1:3900");
});
test("only fixed read endpoints run; aliases do not count as saved profiles", async () => {
  const calls = [];
  const result = await inspectVoiceStudio(env, undefined, async (url, options) => {
    calls.push({ url, options });
    return url.endsWith("voicestudio-speech") ? json(discovery) : json({ voices: [{ type: "openai_alias" }, { type: "profile", name: "PRIVATE NAME", reference: "PRIVATE AUDIO" }] });
  });
  assert.equal(result.state, "read_verified"); assert.equal(result.savedProfiles, 1);
  assert.equal(result.speechVerified, false); assert.equal(result.captureEnabled, false);
  assert.equal(calls.length, 2);
  for (const { url, options } of calls) { assert.ok(url.startsWith(env.JARVIS_VOICESTUDIO_URL)); assert.equal(options.method, "GET"); assert.equal(options.redirect, "error"); assert.equal(options.headers.Authorization, "Bearer server-test-secret"); }
  assert.ok(!JSON.stringify(result).includes("PRIVATE")); assert.ok(!JSON.stringify(result).includes("server-test-secret"));
});
test("public discovery success does not hide rejection of profile read", async () => {
  const result = await inspectVoiceStudio(env, undefined, async url => url.endsWith("voicestudio-speech") ? json(discovery) : new Response("private details", { status: 403 }));
  assert.equal(result.state, "authentication_failed"); assert.equal(result.speechVerified, false);
});
test("incompatible service and oversized responses never establish verification", async () => {
  assert.equal((await inspectVoiceStudio(env, undefined, async () => json({ status: "ok" }))).state, "incompatible");
  assert.equal((await inspectVoiceStudio(env, undefined, async () => new Response("x".repeat(65537)))).state, "unavailable");
});
test("network errors do not disclose provider error bodies or secrets", async () => {
  const result = await inspectVoiceStudio(env, undefined, async () => { throw Error("server-test-secret PRIVATE"); });
  assert.equal(result.state, "unavailable"); assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  assert.equal(voiceStudioIntent("O Voice Studio está conectado?"), true);
  assert.equal(voiceStudioIntent("Qual é o estúdio de vídeo?"), false);
});
test("aborted discovery returns without retrying or starting capture", async () => {
  const c = new AbortController(); c.abort(); let calls = 0;
  const result = await inspectVoiceStudio(env, c.signal, async (_, options) => { calls++; options.signal.throwIfAborted(); });
  assert.equal(result.state, "unavailable"); assert.equal(calls, 1); assert.equal(result.captureEnabled, false);
});
test("neural status tool routes VoiceStudio to the implemented reader once", async () => {
  const { createOperationalVoiceTool } = await import(await load("lib/operational/realtime-tool.ts"));
  const calls = [], sent = [];
  const handler = createOperationalVoiceTool({ signal: new AbortController().signal, isCurrent: () => true, send: e => sent.push(e), fetcher: async (url, options) => { calls.push({ url, options }); return json({ available: true, model: "jk-voicestudio", text: "Ainda não configurado", studio: { state: "not_configured" } }); } });
  const event = { type: "response.done", response_id: "studio-response", response: { status: "completed", output: [{ type: "function_call", name: "jarvis_operational_status", call_id: "studio-call", arguments: JSON.stringify({ query: "O VoiceStudio está conectado?" }) }] } };
  await handler.handle(event); await handler.handle(event);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, "/api/director/research");
  assert.match(calls[0].options.body, /VoiceStudio/);
  assert.equal(sent.filter(e => e.type === "response.create").length, 1);
});
test("actual status route rejects unauthenticated and cross-origin requests before probing", async () => {
  let owner = false, calls = 0;
  globalThis.__studioRouteOwner = () => owner;
  globalThis.__studioRouteProbe = () => { calls++; return { state: "not_configured" }; };
  const dataUrl = s => "data:text/javascript;base64," + Buffer.from(s).toString("base64");
  let code = ts.transpileModule(fs.readFileSync("app/api/voice/studio/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  code = code.replace(/from "[^"]*\/auth"/, "from " + JSON.stringify(dataUrl("export const authorized = async () => globalThis.__studioRouteOwner();")));
  code = code.replace(/from "[^"]*\/http"/, "from " + JSON.stringify(await load("lib/abacus/http.ts")));
  code = code.replace(/from "[^"]*\/voicestudio"/, "from " + JSON.stringify(dataUrl("export const inspectVoiceStudio = async () => globalThis.__studioRouteProbe();")));
  const { POST } = await import(dataUrl(code));
  assert.equal((await POST(new Request("https://jk.test/api/voice/studio", { method: "POST" }))).status, 401);
  owner = true;
  assert.equal((await POST(new Request("https://jk.test/api/voice/studio", { method: "POST", headers: { Origin: "https://other.test" } }))).status, 403);
  assert.equal(calls, 0);
  const response = await POST(new Request("https://jk.test/api/voice/studio", { method: "POST", headers: { Origin: "https://jk.test" } }));
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/); assert.equal(calls, 1);
  delete globalThis.__studioRouteOwner; delete globalThis.__studioRouteProbe;
});
