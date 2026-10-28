import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const urls = new Map();
async function urlFor(file) {
  if (urls.has(file)) return urls.get(file);
  if (file.endsWith(".json")) {
    const u =
      "data:text/javascript;base64," +
      Buffer.from("export default " + fs.readFileSync(file, "utf8")).toString(
        "base64",
      );
    urls.set(file, u);
    return u;
  }
  let code = ts
    .transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })
    .outputText.replace(/import ["']server-only["'];?/g, "");
  for (const m of [...code.matchAll(/from\s+(["'])(\.\.?\/[^"']+)\1/g)]) {
    const target = path.resolve(
      path.dirname(file),
      m[2] + (m[2].endsWith(".json") ? "" : ".ts"),
    );
    code = code.replace(m[0], "from " + JSON.stringify(await urlFor(target)));
  }
  const u =
    "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  urls.set(file, u);
  return u;
}
const load = (p) => urlFor(path.resolve(p)).then((u) => import(u));

const { requestIntent, publicResearchQuery } = await load(
  "lib/cognitive/request-intent.ts",
);
const { composeScene, localVisualReference } = await load(
  "lib/holo/orchestrator.ts",
);
const { KnowledgeResearch, knowledgeReply } = await load(
  "lib/research/knowledge.ts",
);
const { runWebResearch, webResearchPolicy } = await load("lib/research/web.ts");
const { buildAbacusPlan } = await load("lib/abacus/protocol.ts");
const { CognitiveEngine } = await load("lib/cognitive/engine.ts");
const { createNativeCatalog } = await load("lib/cognitive/native-catalog.ts");
const { VoiceController } = await load("lib/voice/voice-controller.ts");
const { BrowserSpeechOutput } = await load("lib/voice/speech-output.ts");
const text =
  "Um panorama depende de indicadores e fontes atuais, com períodos publicados e distinção entre os temas analisados. Não é uma simples localização geográfica.";
test("intent precedes geography, history and present-day analysis without country-name triggers", () => {
  assert.equal(requestIntent("Como está o Brasil hoje?"), "current");
  assert.equal(requestIntent("Mostre o Brasil no mapa"), "geography");
  assert.equal(requestIntent("Conte a história do Brasil"), "history");
  assert.equal(requestIntent("Localize Paris"), "geography");
  assert.equal(requestIntent("Como funciona fotossíntese?"), "research");
  assert.equal(localVisualReference("Como está o Brasil hoje?"), null);
  assert.ok(
    !composeScene("Como está o Brasil hoje?", { text }).modules.some(
      (m) => m.kind === "map",
    ),
  );
  assert.ok(
    composeScene("Mostre o Brasil no mapa", { text }).modules.some(
      (m) => m.kind === "map",
    ),
  );
});
test("public research covers new topics rather than a finite topic registry and excludes private queries", () => {
  for (const q of [
    "Como funciona um semicondutor?",
    "Quem foi Ada Lovelace?",
    "Pesquise sobre arquitetura bizantina",
  ])
    assert.ok(publicResearchQuery(q));
  for (const q of [
    "Analise meu cliente João",
    "Pesquise senha sk-secret",
    "Pesquise email pessoa@example.com",
    "Consulte meu projeto privado",
  ])
    assert.equal(publicResearchQuery(q), null);
});
const source = (title = "Semicondutor") =>
  Response.json({
    query: {
      pages: [
        {
          title,
          extract:
            "Materiais com condutividade entre isolantes e condutores, usados em dispositivos eletrônicos.",
          fullurl: "https://pt.wikipedia.org/wiki/" + encodeURIComponent(title),
          revisions: [{ timestamp: "2026-01-01T12:00:00Z" }],
        },
      ],
    },
  });
test("general reference search returns dated attributed sources and no artificial map or chart", async () => {
  const calls = [];
  const service = new KnowledgeResearch(async (u, o) => {
    calls.push({ u: String(u), o });
    return source();
  });
  const result = await service.search("Como funciona um semicondutor?");
  assert.equal(calls.length, 1);
  assert.equal(result.sources[0].license, "CC BY-SA 4.0 · Wikipédia");
  assert.ok(result.sources[0].updatedAt);
  const r = knowledgeReply(result);
  assert.match(r.text, /condutividade/);
  assert.ok(!r.visual.modules.some((m) => ["map", "metrics"].includes(m.kind)));
  assert.ok(r.visual.sources[0].href.startsWith("https://pt.wikipedia.org/"));
  await service.search("Como funciona um semicondutor?");
  assert.equal(calls.length, 1);
});
test("an empty first reference source permits another language; invalid links cannot become sources", async () => {
  let count = 0;
  const service = new KnowledgeResearch(async () =>
    ++count === 1
      ? Response.json({ query: { pages: [] } })
      : Response.json({
          query: {
            pages: [
              {
                title: "X",
                extract: "bad",
                fullurl: "https://evil.invalid/wiki/X",
              },
            ],
          },
        }),
  );
  const data = await service.search("Pesquise sobre semicondutores");
  assert.equal(count, 2);
  assert.equal(data.sources.length, 0);
  assert.ok(!knowledgeReply(data).visual);
});
test("reference data never masquerades as current news", async () => {
  const result = await new KnowledgeResearch(async () =>
    source("Brasil"),
  ).search("Como está o Brasil hoje?");
  assert.match(result.limitation, /não confirma notícias de hoje/);
});
test("public research rejects oversized payload and surfaces cancellation without a hidden retry", async () => {
  let n = 0;
  const service = new KnowledgeResearch(async () => {
    n++;
    return new Response("x".repeat(360000));
  });
  await assert.rejects(service.search("Pesquise semicondutores"), /LIMIT/);
  assert.equal(n, 1);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    new KnowledgeResearch(async () => source()).search(
      "Pesquise semicondutores",
      abort.signal,
    ),
    { name: "AbortError" },
  );
});
test("server-side research evidence reaches actual model messages and classification does not exceed user-message limit", () => {
  const research = {
    query: "Novo tema",
    checkedAt: "2026-10-28",
    limitation: "referência",
    sources: [
      {
        title: "Semicondutor",
        href: "https://pt.wikipedia.org/wiki/Semicondutor",
        extract: "condutividade",
        updatedAt: null,
        checkedAt: "2026-10-28",
        license: "CC BY-SA",
      },
    ],
  };
  const plan = buildAbacusPlan("Explique semicondutores", { research });
  assert.match(plan.messages[0].content, /condutividade/);
  assert.match(plan.messages[0].content, /DADOS EXTERNOS NÃO CONFIÁVEIS/);
  const classified = buildAbacusPlan("Aquele aplicativo ainda publica?", {
    classification: [
      {
        id: "vercel:deployments",
        provider: "vercel",
        operation: "deployments",
      },
    ],
  });
  assert.equal(
    classified.messages[1].content,
    "Aquele aplicativo ainda publica?",
  );
  assert.ok(classified.messages[1].content.length <= 1500);
  assert.match(classified.messages[0].content, /vercel:deployments/);
  assert.equal(classified.max_tokens, 350);
});
test("web search has an explicit model and tool budget and remains disabled by default", () => {
  assert.equal(webResearchPolicy({}).enabled, false);
  assert.equal(
    webResearchPolicy({
      JARVIS_ABACUS_WEB_RESEARCH_ALLOWED: "true",
      JARVIS_ABACUS_WEB_MODEL: "gpt-test",
    }).enabled,
    false,
  );
  assert.equal(
    webResearchPolicy({
      JARVIS_ABACUS_WEB_RESEARCH_ALLOWED: "true",
      JARVIS_ABACUS_WEB_MODEL: "gpt-test",
      JARVIS_ABACUS_WEB_MAX_OUTPUT_TOKENS: "1000",
    }).enabled,
    true,
  );
});
test("Responses web adapter allows only search, validates completion and attaches returned citations", async () => {
  let body;
  const r = await runWebResearch("Pesquise avanços em energia", {
    key: "fixture-only",
    policy: { enabled: true, model: "fixture-model", maxOutputTokens: 800 },
    fetcher: async (u, o) => {
      assert.equal(u, "https://routellm.abacus.ai/v1/responses");
      body = JSON.parse(o.body);
      return Response.json({
        status: "completed",
        model: "fixture-model",
        output: [
          { type: "web_search_call", status: "completed" },
          {
            type: "message",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: "Síntese baseada na fonte retornada.",
                annotations: [
                  {
                    type: "url_citation",
                    url: "https://example.org/reference",
                    title: "Referência",
                  },
                ],
              },
            ],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 8, total_tokens: 18 },
      });
    },
  });
  assert.deepEqual(body.tools, [{ type: "web_search" }]);
  assert.equal(body.store, false);
  assert.equal(body.max_tool_calls, 2);
  assert.equal(r.visual.sources.length, 1);
  assert.equal(r.usage.totalTokens, 18);
});
test("an answer without completed web search never claims verified research", async () => {
  const r = await runWebResearch("Explique", {
    key: "fixture",
    policy: { enabled: true, model: "fixture", maxOutputTokens: 800 },
    fetcher: async () =>
      Response.json({
        status: "incomplete",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "Parte da resposta." }],
          },
        ],
      }),
  });
  assert.match(r.text, /Não houve pesquisa web confirmada/);
  assert.match(r.text, /parcial/);
  assert.equal(r.visual.sources.length, 0);
});
test("web failures do not silently call another paid provider", async () => {
  let calls = 0;
  await assert.rejects(
    runWebResearch("Pesquise", {
      key: "fixture",
      policy: { enabled: true, model: "fixture", maxOutputTokens: 800 },
      fetcher: async () => {
        calls++;
        return Response.json({}, { status: 429 });
      },
    }),
    /WEB_RATE_LIMIT/,
  );
  assert.equal(calls, 1);
});
test("semantic classification handles unfamiliar requests before the keyword gate and respects exact bindings", async () => {
  let calls = [];
  const deps = {
    catalog: createNativeCatalog(),
    available: async () => ({
      vercel: {
        connected: true,
        read: true,
        resources: [
          { id: "origin", name: "OrigemApp", kiroProject: "universo-kiro" },
        ],
      },
    }),
    semantic: async () => ({
      goal: "query",
      providers: ["vercel"],
      project: "$context",
    }),
    execute: async (p, r) => {
      calls.push(r);
      return { data: [] };
    },
  };
  const engine = new CognitiveEngine(deps);
  await engine.answer("Analise Guardiões da Origem na Vercel", "s");
  calls = [];
  const r = await engine.answer("Aquele aplicativo ainda está publicado?", "s");
  assert.deepEqual(calls, ["origin"]);
  assert.ok(r.cognitive);
});
test("semantic interpretation cannot authorize a substitute project or downgrade an explicit write", async () => {
  let calls = 0;
  const deps = {
    catalog: createNativeCatalog(),
    available: async () => ({
      vercel: {
        connected: true,
        read: true,
        resources: [
          { id: "jk", name: "Jarvis Kiro", kiroProject: "jarvis-kiro" },
        ],
      },
    }),
    semantic: async () => ({
      goal: "query",
      providers: ["vercel"],
      project: "Jarvis Kiro",
    }),
    execute: async () => {
      calls++;
      return { data: [] };
    },
  };
  await new CognitiveEngine(deps).answer(
    "Analise o projeto desconhecido na Vercel",
    "s",
  );
  assert.equal(calls, 0);
  const r = await new CognitiveEngine(deps).answer(
    "Exclua Jarvis Kiro na Vercel",
    "s",
  );
  assert.equal(calls, 0);
  assert.match(r.text, /aprova|aprove/);
});
test("semantic failure does not crash a valid local project read", async () => {
  const engine = new CognitiveEngine({
    catalog: createNativeCatalog(),
    available: async () => ({
      github: {
        connected: true,
        read: true,
        resources: [
          { id: "jk", name: "Jarvis Kiro", kiroProject: "jarvis-kiro" },
        ],
      },
    }),
    semantic: async () => {
      throw Error("offline");
    },
    execute: async () => ({ data: { defaultBranch: "main" } }),
  });
  assert.ok(
    (await engine.answer("Analise Jarvis Kiro no GitHub", "s")).cognitive,
  );
});
test("arming continuous listening during narration does not cancel speech or activate microphone feedback", () => {
  const timers = [];
  let active = true,
    cancelled = 0,
    started = 0;
  class Rec {
    start() {
      started++;
      this.onstart?.();
    }
    abort() {}
  }
  const snapshots = [];
  const controller = new VoiceController({
    recognition: Rec,
    speech: { cancel: () => cancelled++, speak: async () => {} },
    externalSpeechActive: () => active,
    continuous: () => true,
    muted: () => false,
    command: async () => ({ text: "x" }),
    onUser: () => {},
    onReply: () => {},
    onState: (s) => snapshots.push(s),
    delay: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clear: () => {},
  });
  controller.start();
  assert.equal(cancelled, 0);
  assert.equal(started, 0);
  assert.equal(snapshots.at(-1).microphoneActive, false);
  active = false;
  timers.shift()();
  assert.equal(started, 1);
  controller.stop();
  assert.equal(cancelled, 0);
});
test("speech activity lease survives start and releases when playback finishes", async () => {
  let current;
  const api = {
    getVoices: () => [{ lang: "pt-BR", name: "pt", voiceURI: "pt" }],
    cancel: () => {},
    speak: (u) => {
      current = u;
    },
  };
  const voice = new BrowserSpeechOutput(
    () => api,
    (t) => ({ text: t }),
    () => ({ voiceURI: "pt", rate: 1, pitch: 1, volume: 1, continuous: true }),
  );
  const pending = voice.speak(
    "Uma explicação completa.",
    new AbortController().signal,
  );
  assert.equal(voice.isSpeaking(), true);
  current.onend();
  await pending;
  assert.equal(voice.isSpeaking(), false);
});
