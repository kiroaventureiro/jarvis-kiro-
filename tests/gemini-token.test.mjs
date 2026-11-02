import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const config = await import("@google/genai");
const transpile = file => ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const policy = await import(url(transpile("lib/request-origin.ts")));
globalThis.__tokenTest = { authorized: true, requests: [], admitted: 0 };
const state = globalThis.__tokenTest;
globalThis.__tokenOrigin = policy.requestOriginAllowed;
globalThis.__tokenSDK = config;
let code = transpile("app/api/voice/gemini-token/route.ts");
const replacements = {
  "@google/genai": `const GoogleGenAI = class { constructor(options) { globalThis.__tokenTest.options = options; } authTokens = { create: async request => { const s = globalThis.__tokenTest; s.requests.push(request); if (s.fail) throw new Error("sensitive upstream message"); return { name: "ephemeral-only" }; } }; };`,
  "../../../../lib/voice/gemini-config": `const {geminiLiveConfig, GEMINI_LIVE_MODEL} = await import(${JSON.stringify(url(transpile("lib/voice/gemini-config.ts").replace('import { Modality, Type } from "@google/genai";', 'const {Modality, Type} = globalThis.__tokenSDK;')))});`,
  "../../../../lib/request-origin": `const requestOriginAllowed = globalThis.__tokenOrigin;`,
  "next/server": `const NextResponse = { json: (body, options) => Response.json(body, options) };`,
  "../../../../lib/auth": `const authorized = async () => globalThis.__tokenTest.authorized;`,
  "../../../../lib/connectors/server": `const connectorStore = { configured: () => true };`,
  "../../../../lib/voice/ledger": `const admitVoiceSession = async () => { const s = globalThis.__tokenTest; s.admitted++; if (s.limited) throw new Error("VOICE_SESSION_LIMIT"); return {sessionId: "session-test", persistent:true}; };`,
  "../../../../lib/jarvis-profile": `const getJarvisProfile = () => ({ identity: {name:"Jarvis",role:"assistant"},voice:{style:"calm"},principles:[] }); const getIntegrationStatus = () => [];`,
  "../../../../lib/jarvis-operational-context": `const jarvisOperationalContext = async () => "context";`,
  "../../../../lib/jarvis-memory": `const lookupJarvisMemory = () => [];`,
  "../../../../lib/cognitive/protocol": `const cognitiveProtocol = () => "protocol";`,
};
for (const [name, value] of Object.entries(replacements)) code = code.replace(new RegExp(`import[^;]+from "${name}";`, "g"), value);
const { POST, GET } = await import(url(code));
const request = (origin = "https://preview.example", body = {}) => new Request("https://preview.example/api/voice/gemini-token", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ clientSessionId: "12345678-1234-1234-1234-123456789abc", ...body }) });
function reset() {
  Object.assign(state, { authorized: true, requests: [], admitted: 0, fail: false, limited: false });
  Object.assign(process.env, { VERCEL_ENV: "preview", GEMINI_API_KEY: "test-server-only-not-a-real-key", JARVIS_GEMINI_LIVE_ENABLED: "true", JARVIS_GEMINI_LIVE_PAID_ALLOWED: "true", JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR: "3" });
}
test("token endpoint enforces security before contacting Google", async t => {
  await t.test("unauthorized, cross origin, production, disabled, unpaid, invalid budget", async () => {
    for (const [field, value, expected] of [
      ["authorized", false, 401], ["VERCEL_ENV", "production", 403],
      ["JARVIS_GEMINI_LIVE_ENABLED", "false", 403], ["JARVIS_GEMINI_LIVE_PAID_ALLOWED", "false", 403],
      ["JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR", "0", 503], ["GEMINI_API_KEY", "", 503],
    ]) {
      reset(); if (field === "authorized") state.authorized = value; else process.env[field] = value;
      const response = await POST(request()); assert.equal(response.status, expected, field); assert.equal(state.requests.length, 0);
    }
    reset(); assert.equal((await POST(request("https://attacker.example"))).status, 403);
    assert.equal((await POST(request("https://preview.example", { handle: 7 }))).status, 400);
    assert.equal((await POST(request("https://preview.example", { clientSessionId: undefined }))).status, 400, "missing client session ID is rejected");
    assert.equal((await POST(request("https://preview.example", { clientSessionId: "invalid" }))).status, 400, "malformed client session ID is rejected");
  });
  await t.test("issues single use, constrained audio token; only ephemeral credential returned", async () => {
    reset(); const now = Date.now(); const response = await POST(request("https://preview.example", { handle: "resume-opaque" }));
    assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
    const text = await response.text(); assert.ok(!text.includes(process.env.GEMINI_API_KEY));
    assert.equal(JSON.parse(text).token, "ephemeral-only");
    const c = state.requests[0].config; assert.equal(c.uses, 1);
    assert.ok(Date.parse(c.newSessionExpireTime) - now <= 61000);
    assert.ok(Date.parse(c.expireTime) - now <= 1801000);
    assert.equal(c.liveConnectConstraints.config.sessionResumption.handle, "resume-opaque");
    assert.deepEqual(c.liveConnectConstraints.config.responseModalities, ["AUDIO"]);
    assert.equal(c.liveConnectConstraints.config.tools[0].functionDeclarations[0].name, "jarvis_conversation");
    assert.deepEqual(c.liveConnectConstraints.config.tools[0].functionDeclarations[0].parameters.properties, {});
  });
  await t.test("persistent rate limit and sanitized upstream failures", async () => {
    reset(); state.limited = true; assert.equal((await POST(request())).status, 429); assert.equal(state.requests.length, 0);
    reset(); state.fail = true; const response = await POST(request()); assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("sensitive upstream"));
  });
});

test("read-only endpoint readiness never issues tokens or admits sessions", async () => {
  reset(); const response = await GET(request()); assert.equal(response.status, 200);
  assert.equal(state.requests.length, 0); assert.equal(state.admitted, 0);
  reset(); process.env.JARVIS_GEMINI_LIVE_ENABLED = "false";
  const blocked = await GET(request()); assert.equal(blocked.status, 403); assert.equal((await blocked.json()).code, "LIVE_DISABLED");
  reset(); state.authorized = false; assert.equal((await GET(request())).status, 401);
});
