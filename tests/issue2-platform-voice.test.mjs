import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const cache = new Map();
async function url(file) {
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(
    fs
      .readFileSync(file, "utf8")
      .replace(/import\s+["']server-only["'];?/g, ""),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  for (const m of [...code.matchAll(/from\s+(["'])(\.\.?\/[^"']+)\1/g)])
    code = code.replace(
      m[0],
      "from " +
        JSON.stringify(
          await url(path.resolve(path.dirname(file), m[2] + ".ts")),
        ),
    );
  const u =
    "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  cache.set(file, u);
  return u;
}
const load = (p) => url(path.resolve(p)).then((u) => import(u));
const { listAbacusResourceNames, probeAbacusPlatform } = await load(
  "lib/abacus/platform-read.ts",
);
const { abacusPlatformIntent } = await load("lib/abacus/platform-intent.ts");
const { createOperationalVoiceTool } = await load(
  "lib/operational/realtime-tool.ts",
);
const { probeAgentConversation } = await load("lib/abacus/agent-read.ts");
const { admitVoiceSession, recordVoiceUsage, voiceUsageStats } = await load(
  "lib/voice/ledger.ts",
);
const { voiceSessionPolicy } = await load("lib/voice/session-policy.ts");
test("Audio-understood query routes platform reads even without local ASR transcription", async () => {
  const calls = [];
  const tool = createOperationalVoiceTool({
    signal: new AbortController().signal,
    isCurrent: () => true,
    send: () => {},
    fetcher: async (u, o) => {
      calls.push([u, JSON.parse(o.body)]);
      return Response.json({
        available: true,
        model: "jk-abacus-platform",
        text: "Projetos consultados.",
      });
    },
  });
  await tool.handle({
    type: "response.done",
    response: {
      status: "completed",
      output: [
        {
          type: "function_call",
          name: "jarvis_operational_status",
          call_id: "audio-only",
          arguments: JSON.stringify({
            query: "Quais projetos tenho na Avacus?",
          }),
        },
      ],
    },
  });
  assert.equal(calls[0][0], "/api/director/research");
  assert.match(calls[0][1].query, /Avacus/);
});
test("Issue #2 real spoken request and ASR variants identify platform resources", () => {
  for (const m of [
    "Jarvis, quais projetos tenho na Abacus?",
    "Jarvis, verifica os projetos e deploys disponíveis na minha conta da Avacus.",
    "Verifique os deployments da Abagus",
    "Consulte os projetos da Abaqus",
  ])
    assert.equal(abacusPlatformIntent(m), true);
  assert.equal(abacusPlatformIntent("Qual o saldo da Abacus?"), false);
});
test("Names, project scope and read-only methods are verified against API output", async () => {
  const calls = [];
  const r = await listAbacusResourceNames(
    "not-a-real-secret",
    undefined,
    async (u, o) => {
      calls.push([String(u), o]);
      return Response.json({
        success: true,
        result: String(u).includes("listProjects")
          ? [
              {
                projectId: "project1",
                projectName: "Projeto real",
                useCase: "CHAT_LLM",
              },
            ]
          : [{ deploymentId: "dep1", deploymentName: "Agente real" }],
      });
    },
  );
  assert.equal(r.state, "verified");
  assert.deepEqual(r.projects, ["Projeto real"]);
  assert.deepEqual(r.deployments, ["Agente real"]);
  assert.equal(r.chatCandidates, 1);
  assert.match(calls[1][0], /projectId=project1/);
  assert.ok(calls.every((c) => c[1].method === "GET"));
  assert.ok(!JSON.stringify(r).includes("not-a-real-secret"));
  assert.ok(!JSON.stringify(r).includes("dep1"));
});
test("Partial failure preserves verified resources and reports missing names", async () => {
  const r = await listAbacusResourceNames("fixture", undefined, async (u) =>
    String(u).includes("listProjects")
      ? Response.json({
          success: true,
          result: [
            { projectId: "p1", name: "Um" },
            { projectId: "p2", name: "Dois" },
          ],
        })
      : String(u).includes("projectId=p2")
        ? new Response("", { status: 503 })
        : Response.json({ success: true, result: [{ name: "Deployment Um" }] }),
  );
  assert.equal(r.state, "partial");
  assert.deepEqual(r.deployments, ["Deployment Um"]);
  assert.equal(r.complete, false);
  assert.ok(r.warnings.length);
});
test("Bounds, pagination signals, malformed items and absence of credential are honest", async () => {
  let calls = 0;
  const empty = await listAbacusResourceNames(
    undefined,
    undefined,
    async () => {
      calls++;
      throw Error();
    },
  );
  assert.equal(empty.state, "unauthorized");
  assert.equal(calls, 0);
  const partial = await listAbacusResourceNames(
    "fixture",
    undefined,
    async () =>
      Response.json({
        success: true,
        result: [{ projectId: "p1", name: "P" }],
        hasMore: true,
      }),
  );
  assert.equal(partial.state, "partial");
  const malformed = await listAbacusResourceNames(
    "fixture",
    undefined,
    async () => Response.json({ success: true, result: ["bad"] }),
  );
  assert.equal(malformed.state, "invalid_response");
});
test("Neural status function is deterministically routed to actual resource reader for the user question", async () => {
  const sent = [],
    requests = [];
  const tool = createOperationalVoiceTool({
    signal: new AbortController().signal,
    isCurrent: () => true,
    question: () =>
      "Jarvis, verifica os projetos e deploys disponíveis na minha conta da Avacus.",
    send: (e) => sent.push(e),
    fetcher: async (u, o) => {
      requests.push([u, JSON.parse(o.body)]);
      return Response.json({
        available: true,
        model: "jk-abacus-platform",
        text: "Projetos: Projeto real. Deployments: Agente real.",
      });
    },
  });
  const e = {
    type: "response.done",
    response: {
      status: "completed",
      output: [
        {
          type: "function_call",
          name: "jarvis_operational_status",
          call_id: "platform-call",
          arguments: "{}",
        },
      ],
    },
  };
  await tool.handle(e);
  await tool.handle(e);
  assert.equal(requests[0][0], "/api/director/research");
  assert.match(requests[0][1].query, /Avacus/);
  assert.match(sent[0].item.output, /Projeto real/);
  assert.equal(sent.filter((x) => x.type === "response.create").length, 1);
});
test("Conversation metadata proof does not imply permission to continue or start agent tasks", async () => {
  const result = await probeAgentConversation(
    "convo1",
    "fixture",
    undefined,
    async () =>
      Response.json({
        success: true,
        result: {
          deploymentConversationId: "convo1",
          conversationType: "COMPLEX_AGENT",
          messages: ["private body"],
        },
      }),
  );
  assert.equal(result.metadataVerified, true);
  assert.equal(result.canContinue, false);
  assert.ok(!JSON.stringify(result).includes("private body"));
  const denied = await probeAgentConversation(
    "convo1",
    "fixture",
    undefined,
    async () => new Response("", { status: 403 }),
  );
  assert.equal(denied.state, "unauthorized");
  await assert.rejects(() => probeAgentConversation("https://evil", "fixture"));
});
test("Persistent session admission survives new instances, deduplicates usage and enforces session count", async () => {
  const state = {
    version: 1,
    connections: {},
    plans: [],
    audit: [],
    oauth: {},
  };
  const store = {
    configured: () => true,
    read: async () => structuredClone(state),
    update: async (fn) => fn(state),
  };
  const id = "00000000-0000-4000-8000-000000000001";
  await admitVoiceSession(store, id, 1, 1000);
  await assert.rejects(
    () => admitVoiceSession(store, "new", 1, 1100),
    /VOICE_SESSION_LIMIT/,
  );
  const report = {
    sessionId: id,
    responseId: "resp1",
    inputTokens: 10,
    outputTokens: 20,
  };
  await recordVoiceUsage(store, report, 1200);
  await recordVoiceUsage(store, report, 1200);
  const stats = voiceUsageStats((await store.read()).voiceUsage, 1300);
  assert.equal(stats.responses, 1);
  assert.equal(stats.inputTokens, 10);
  assert.equal(stats.source, "client_reported");
  await assert.rejects(() =>
    recordVoiceUsage(store, { ...report, inputTokens: -1 }, 1200),
  );
  await admitVoiceSession(store, "next", 1, 3601001);
  assert.equal(voiceUsageStats(state.voiceUsage, 3601100).sessions, 1);
});
test("Voice migration is explicit and server VAD interrupts speech while input is active", () => {
  assert.equal(voiceSessionPolicy({}).model, "gpt-realtime");
  assert.equal(
    voiceSessionPolicy({ JARVIS_OPENAI_VOICE_MODEL: "gpt-realtime-2.1" }).model,
    "gpt-realtime-2.1",
  );
  assert.equal(
    voiceSessionPolicy({}).audio.input.turn_detection.interrupt_response,
    true,
  );
  assert.throws(() =>
    voiceSessionPolicy({ JARVIS_OPENAI_VOICE_MODEL: "unapproved-model" }),
  );
});
