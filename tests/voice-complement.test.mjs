import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const urls = new Map();
async function urlFor(file) {
  if (urls.has(file)) return urls.get(file);
  if (file.endsWith(".json"))
    return (
      "data:text/javascript;base64," +
      Buffer.from("export default " + fs.readFileSync(file, "utf8")).toString(
        "base64",
      )
    );
  let code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  for (const m of [...code.matchAll(/from\s+(["'])(\.\.?\/[^"']+)\1/g)])
    code = code.replace(
      m[0],
      "from " +
        JSON.stringify(
          await urlFor(
            path.resolve(
              path.dirname(file),
              m[2] + (m[2].endsWith(".json") ? "" : ".ts"),
            ),
          ),
        ),
    );
  const u =
    "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  urls.set(file, u);
  return u;
}
const load = (p) => urlFor(path.resolve(p)).then((u) => import(u));

const { complementaryScene } = await load("lib/holo/complementary.ts");
const { narrationScript, NarrationCoordinator } = await load(
  "lib/holo/narration.ts",
);
const { planContent } = await load("lib/holo/content-planner.ts");
const { composeScene } = await load("lib/holo/orchestrator.ts");
const { abacusVoiceEvidence, abacusEvidenceScene } = await load(
  "lib/abacus/voice-evidence.ts",
);
const { createOperationalVoiceTool } = await load(
  "lib/operational/realtime-tool.ts",
);
const base = (modules, narration = "") => ({
  version: 1,
  id: "test",
  title: "Resultado",
  mode: "technical",
  createdAt: new Date().toISOString(),
  source: { kind: "reference", label: "Teste" },
  modules,
  narration,
});
test("Quoted operational answer is spoken once without reading visual titles or descriptions", () => {
  const text =
    "A integração Abacus está configurada e autorizada. A validação é limitada à conversa. O saldo observado não é o orçamento.";
  const s = composeScene("Quais recursos da conta Abacus?", { text }),
    p = planContent(s);
  const script = narrationScript(s, p, text)
    .map((x) => x.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  assert.equal(script, text);
  assert.ok(!script.includes("Pontos em destaque"));
  assert.equal(script.match(/A integração Abacus/g).length, 1);
});
test("A generic transcript panel disappears instead of masquerading as a demonstration", () => {
  const text =
    "A integração Abacus está configurada e autorizada, com validação recente para conversas. Isso não prova o saldo em créditos.";
  const raw = composeScene(
    "Quais recursos da minha conta Abacus você conhece?",
    { text },
  );
  assert.equal(complementaryScene(raw, text), null);
});
test("Independent visuals and extra references remain while mirrored prose and report body are hidden", () => {
  const speech =
    "A inflação sofreu mudanças ao longo dos últimos meses. Estes dados não representam uma previsão.";
  const s = base(
    [
      { id: "text", kind: "text", title: "Fala", text: speech, tags: [] },
      {
        id: "report",
        kind: "report",
        title: "Fontes",
        summary: speech,
        body: speech,
        items: [],
        href: "https://www.ibge.gov.br/",
      },
      {
        id: "chart",
        kind: "metrics",
        title: "IPCA",
        unit: "%",
        style: "line",
        values: [{ label: "Mês", value: 1 }],
      },
    ],
    speech,
  );
  const v = complementaryScene(s, speech);
  assert.equal(v.modules.length, 2);
  assert.equal(v.modules[0].summary, "");
  assert.equal(v.modules[0].body, undefined);
  assert.equal(v.modules[1].kind, "metrics");
  assert.equal(v.narration, speech);
});
test("Visual details do not repeat the point label already used as title", () => {
  const s = base([
    {
      id: "r",
      kind: "report",
      title: "Catálogo",
      summary: "",
      items: [{ label: "Modelos disponíveis", detail: "165" }],
    },
  ]);
  const p = planContent(s);
  assert.equal(p[0].content.title, "Modelos disponíveis");
  assert.equal(p[0].content.summary, "165");
});
test("Narration never prefers a longer visual narration over the actual supplied answer", () => {
  const s = base(
    [
      {
        id: "r",
        kind: "report",
        title: "Não ler este título",
        summary: "Não ler esta descrição.",
        items: [],
      },
    ],
    "Texto visual antigo e mais extenso que a fala atual.",
  );
  const text = "Resposta atual.";
  assert.equal(
    narrationScript(s, planContent(s), text)
      .map((x) => x.text)
      .join(" ")
      .trim(),
    text,
  );
});
test("Resizing or re-registering while speaking never starts a second simultaneous utterance", async () => {
  const s = base([
      {
        id: "r",
        kind: "report",
        title: "Catálogo",
        summary: "Primeiro quadro.",
        items: [{ label: "Outro", detail: "Outro quadro." }],
      },
    ]),
    p = planContent(s),
    c = new NarrationCoordinator(),
    calls = [];
  let resolve;
  const done = c.begin(
    s,
    "Primeiro fato. Segundo fato.",
    new AbortController().signal,
    {
      speak: (t) => {
        calls.push(t);
        return new Promise((r) => (resolve = r));
      },
      cancel: () => {},
    },
  );
  c.register(s.id, p, p[0].id);
  c.register(s.id, p, p[1].id);
  assert.equal(calls.length, 1);
  resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(c.state.phase, "waiting");
  assert.equal(c.state.stepId, p[1].id);
  c.cancel();
  await done.catch(() => {});
});
test("Neural evidence explicitly includes model catalog and imported account without inventing execution", () => {
  const h = {
    state: "verified",
    discovery: {
      models: [{ id: "route-llm" }, { id: "flux2" }],
      tools: [],
      toolsState: "verified",
      checkedAt: new Date().toISOString(),
    },
    observation: {
      plan: "Basic",
      remainingCredits: 13231,
      observedAt: new Date().toISOString(),
      connectedServices: ["Gmail"],
      activeTasks: ["Morning brief"],
      personalAgents: ["Chief of Staff (2)"],
    },
    observationStale: false,
  };
  const e = abacusVoiceEvidence(h);
  assert.equal(e.modelCount, 2);
  assert.equal(e.toolsCount, 0);
  assert.equal(e.observation.remainingCredits, 13231);
  assert.equal(e.generationVerified, false);
  assert.equal(e.videoExecution, false);
  assert.ok(abacusEvidenceScene(e).modules.length);
});
test("The neural operational tool keeps private account evidence in JK and resumes once with public catalog facts", async () => {
  const sent = [],
    seen = [];
  const evidence = abacusVoiceEvidence({
    state: "verified",
    discovery: {
      models: Array.from({ length: 165 }, (_, i) => ({ id: "model-" + i })),
      tools: [],
      toolsState: "verified",
      checkedAt: new Date().toISOString(),
    },
    observation: {
      plan: "Basic",
      remainingCredits: 13231,
      observedAt: new Date().toISOString(),
      connectedServices: ["Gmail"],
      activeTasks: [],
      personalAgents: [],
    },
    observationStale: false,
  });
  const tool = createOperationalVoiceTool({
    signal: new AbortController().signal,
    isCurrent: () => true,
    send: (e) => sent.push(e),
    onSnapshot: (s) => seen.push(s),
    fetcher: async () =>
      Response.json({ schemaVersion: 1, integrations: [], abacus: evidence }),
  });
  const event = {
    type: "response.done",
    response_id: "r1",
    response: {
      status: "completed",
      output: [
        {
          type: "function_call",
          call_id: "c1",
          name: "jarvis_operational_status",
          arguments: "{}",
        },
      ],
    },
  };
  await tool.handle(event);
  await tool.handle(event);
  assert.equal(sent.length, 2);
  assert.equal(seen.length, 1);
  const out = JSON.parse(sent[0].item.output);
  assert.equal(out.abacus.modelCount, 165);
  assert.equal(out.abacus.observation, null);
  assert.equal(seen[0].abacus.observation.plan, "Basic");
  assert.equal(out.abacus.privateAccountForwarded, false);
  assert.equal(sent.filter((x) => x.type === "response.create").length, 1);
});

test("Layout changes cannot silently drop remaining sentences or repeat completed ones", async () => {
  const s = base([
      { id: "a", kind: "report", title: "A", summary: "Dado A", items: [] },
      { id: "b", kind: "report", title: "B", summary: "Dado B", items: [] },
    ]),
    p = planContent(s),
    c = new NarrationCoordinator(),
    calls = [],
    pending = [];
  c.register(s.id, p, p[0].id);
  const done = c.begin(
    s,
    "Primeiro fato. Segundo fato. Terceiro fato.",
    new AbortController().signal,
    {
      speak: (t) => {
        calls.push(t);
        return new Promise((r) => pending.push(r));
      },
      cancel: () => {},
    },
  );
  c.register(s.id, [p[0]], p[0].id);
  pending[0]();
  await Promise.resolve();
  await Promise.resolve();
  c.finish(s.id);
  assert.equal(calls.length, 2);
  assert.equal(calls[1], "Terceiro fato.");
  pending[1]();
  await done;
  assert.equal(calls.join(" "), "Primeiro fato. Segundo fato. Terceiro fato.");
});

test("A research tool cannot forward private Abacus account text indirectly", async () => {
  const { neuralOperationalOutput } = await load(
    "lib/operational/realtime-tool.ts",
  );
  const privateReply = {
    model: "jk-abacus-hub",
    text: "Plano Basic, 13231 créditos, Gmail, Morning brief, Chief of Staff (2)",
    visual: { narration: "dados privados" },
  };
  const safe = JSON.stringify(neuralOperationalOutput(privateReply));
  for (const secret of ["13231", "Morning brief", "Chief of Staff", "Gmail"])
    assert.ok(!safe.includes(secret));
  assert.ok(safe.includes("não foram enviados"));
});

test("Owner-authorized question scope forwards only the approved fields and supports immediate opt out", async () => {
  const {
    abacusAccountQuestion,
    readAbacusVoiceSharing,
    setAbacusVoiceSharing,
  } = await load("lib/abacus/voice-sharing.ts");
  const { neuralOperationalOutput } = await load(
    "lib/operational/realtime-tool.ts",
  );
  const saved = globalThis.localStorage;
  const prefs = new Map();
  globalThis.localStorage = {
    getItem: (k) => prefs.get(k) ?? null,
    setItem: (k, v) => prefs.set(k, v),
  };
  try {
    assert.equal(readAbacusVoiceSharing(), true);
    assert.equal(
      abacusAccountQuestion(
        "Quais recursos da minha conta Abacus você conhece?",
      ),
      true,
    );
    for (const q of [
      "Como está a economia brasileira?",
      "Crie um vídeo na Abacus",
      "Quais projetos Kiro você conhece?",
    ])
      assert.equal(abacusAccountQuestion(q), false);
    const observation = {
      plan: "Basic",
      remainingCredits: 13231,
      observedAt: "2026-10-28",
      connectedServices: ["Gmail"],
      activeTasks: ["Morning brief"],
      personalAgents: ["Chief of Staff (2)"],
      apiKey: "forbidden",
      emailContent: "forbidden",
      payment: "forbidden",
    };
    const raw = { abacus: { modelCount: 165, observation } };
    const approved = neuralOperationalOutput(
      raw,
      readAbacusVoiceSharing() &&
        abacusAccountQuestion("Qual o saldo da conta Abacus?"),
    );
    assert.equal(approved.abacus.privateAccountForwarded, true);
    assert.deepEqual(
      Object.keys(approved.abacus.observation).sort(),
      [
        "plan",
        "remainingCredits",
        "observedAt",
        "connectedServices",
        "activeTasks",
        "personalAgents",
      ].sort(),
    );
    assert.ok(!JSON.stringify(approved).includes("forbidden"));
    setAbacusVoiceSharing(false);
    assert.equal(readAbacusVoiceSharing(), false);
    assert.equal(
      neuralOperationalOutput(raw, readAbacusVoiceSharing()).abacus.observation,
      null,
    );
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
});
