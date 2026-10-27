import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const cache = new Map();
async function urlFor(file) {
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith(".json")) {
    const u =
      "data:text/javascript;base64," +
      Buffer.from("export default " + fs.readFileSync(file, "utf8")).toString(
        "base64",
      );
    cache.set(file, u);
    return u;
  }
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
              m[2].endsWith(".json") ? m[2] : m[2] + ".ts",
            ),
          ),
        ),
    );
  const url =
    "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  cache.set(file, url);
  return url;
}
const load = (p) => urlFor(path.resolve(p)).then((u) => import(u));
const {
  normalizeScene,
  publicHref,
  mediaHref,
  exportScene,
  visibleModules,
  connectionPresentation,
} = await load("lib/holo/validation.ts");
const {
  composeScene,
  localVisualReference,
  planScene,
  operationalScene,
  attachmentScene,
  brazilReferenceScene,
} = await load("lib/holo/orchestrator.ts");
const base = () => ({
  version: 1,
  id: "sample",
  title: "Verified visual",
  mode: "technical",
  createdAt: new Date().toISOString(),
  source: { kind: "connector", label: "Fixture evidence" },
  modules: [
    {
      id: "report",
      kind: "report",
      title: "Report",
      summary: "Real response",
      items: [],
    },
  ],
});
test("ordinary greetings leave the visual stage clean", () => {
  assert.equal(
    composeScene("Bom dia Jarvis", {
      text: "Bom dia! O que vamos fazer hoje?",
    }),
    null,
  );
  assert.equal(
    localVisualReference("Jarvis, quais sistemas estão configurados?"),
    null,
  );
});
test("Brazil explanation has sourced map and interactive historical timeline without a model call", () => {
  const reply = localVisualReference("JK, me fale sobre a história do Brasil");
  assert.equal(reply.provider, "local_operational");
  assert.equal(reply.usage, null);
  const scene = normalizeScene(reply.visual);
  assert.equal(scene.source.kind, "reference");
  assert.deepEqual(
    scene.modules.map((m) => m.kind),
    ["map", "timeline", "report"],
  );
  assert.match(scene.source.label, /não é pesquisa ao vivo/);
  assert.equal(
    scene.modules[1].events
      .find((e) => e.when === "1988")
      .href.startsWith("https://www2.camara.leg.br/"),
    true,
  );
});
test("official geometry contains all 27 selectable federation units and data paths only", () => {
  const map = JSON.parse(fs.readFileSync("config/holo-brazil-map.json"));
  assert.equal(map.regions.length, 27);
  assert.equal(new Set(map.regions.map((x) => x.id)).size, 27);
  for (const r of map.regions) {
    assert.ok(r.name);
    assert.match(r.d, /^[MLZ0-9.,-]+$/);
  }
  assert.match(map.url, /servicodados.ibge.gov.br/);
});
test("technical summaries do not fabricate performance values or connected accounts", () => {
  const scene = composeScene("Diagnostique este código", {
    text: "Problema: a imagem referenciada não foi encontrada.\nPrioridade: verificar o caminho no projeto autorizado.\nPróxima etapa: pedir confirmação antes de gravar qualquer mudança.",
  });
  assert.equal(scene.mode, "technical");
  assert.ok(
    !scene.modules.some((m) => ["metrics", "connections"].includes(m.kind)),
  );
  assert.match(scene.source.label, /sem verificação externa/);
});
test("creative ideas and comparisons come from the actual response", () => {
  const scene = composeScene("Me dê ideias para um vídeo", {
    text: "Opção A: uma conversa entre pai e filho sobre a primeira viagem.\nOpção B: um desafio com três memórias da infância, com final afetuoso.",
  });
  assert.equal(scene.mode, "creative");
  assert.equal(scene.modules[0].kind, "compare");
  assert.match(scene.modules[0].columns[1].points[0], /três memórias/);
});
test("timeline parser uses explicit years and labels uncertain generated chronology", () => {
  const scene = composeScene("Explique esta evolução", {
    text: "2021 — Protótipo inicial em uma única página.\n2024 — Expansão para módulos e novas integrações verificadas pelo projeto.",
  });
  const timeline = scene.modules.find((m) => m.kind === "timeline");
  assert.equal(timeline.events.length, 2);
  assert.match(timeline.events[0].detail, /Extraído da resposta/);
});
test("connector metrics count execution evidence rather than inventing site benchmarks", () => {
  const scene = planScene({
    id: "plan-123",
    title: "Diagnóstico",
    status: "failed",
    steps: [
      {
        action: { provider: "github", operation: "repo" },
        status: "done",
        result: { name: "test" },
      },
      {
        action: { provider: "vercel", operation: "deployments" },
        status: "failed",
        error: "UPSTREAM_AUTH",
      },
    ],
  });
  assert.equal(scene.modules[1].values[0].value, 1);
  assert.equal(scene.modules[1].values[2].value, 1);
  assert.match(scene.modules[1].unit, /não é medição de performance/);
});
test("operational snapshot never turns unknown vault state into a disconnected claim", () => {
  const s = operationalScene({
    schemaVersion: 1,
    nativeRegistryState: "unavailable",
    generatedAt: new Date().toISOString(),
    integrations: [
      {
        id: "github",
        name: "GitHub",
        state: "not_configured",
        note: "state not available",
      },
    ],
  });
  assert.equal(s.modules[0].items[0].state, "not_consulted");
  assert.equal(operationalScene({ integrations: [] }), null);
});
test("verified connection lights expire instead of staying green indefinitely", () => {
  const now = Date.now();
  assert.equal(
    connectionPresentation(
      "operational_authorized",
      new Date(now - 61000).toISOString(),
      now,
    ).stale,
    true,
  );
  assert.equal(
    connectionPresentation(
      "operational_authorized",
      new Date(now - 1000).toISOString(),
      now,
    ).state,
    "operational_authorized",
  );
  assert.equal(
    connectionPresentation("connection_validated", undefined, now).state,
    "credentials_configured",
  );
});
test("invalid or oversized scenes cannot mount arbitrary modules", () => {
  for (const s of [
    { ...base(), version: 2 },
    { ...base(), modules: Array(9).fill(base().modules[0]) },
    {
      ...base(),
      modules: [
        {
          ...base().modules[0],
          kind: "html",
          body: "<script>alert(1)</script>",
        },
      ],
    },
    { ...base(), source: { kind: "unknown", label: "x" } },
    { ...base(), title: "x".repeat(45000) },
  ])
    assert.equal(normalizeScene(s), null);
});
test("private, executable, credential-bearing and unsafe media URLs are rejected", () => {
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,foo",
    "//evil.invalid",
    "https://user:pass@evil.invalid/x",
    "https://127.0.0.1/a",
    "https://10.0.0.2/a",
    "https://host.local/a",
    "https://host.example/a?token=private",
    "https://[::1]/a",
  ])
    assert.equal(publicHref(href), undefined);
  assert.equal(mediaHref("https://media.example/file.svg"), undefined);
  assert.equal(
    mediaHref("https://media.example/a.mp4"),
    "https://media.example/a.mp4",
  );
  assert.equal(publicHref("/conexoes#plan-abc"), "/conexoes#plan-abc");
});
test("credential patterns are removed from structured visual text and exports", () => {
  const s = normalizeScene({
    ...base(),
    modules: [
      { ...base().modules[0], summary: "token ghp_FAKE_TEST_SECRET1234567890" },
    ],
  });
  assert.ok(!exportScene(s).includes("ghp_"));
  assert.match(s.modules[0].summary, /oculto/);
});
test("media URLs require supported explicit asset types and survive normalization without autoplay flags", () => {
  const s = normalizeScene({
    ...base(),
    modules: [
      {
        id: "media",
        kind: "media",
        title: "Media",
        items: [
          {
            id: "one",
            type: "video",
            label: "Video",
            url: "https://media.example/clip.mp4",
            autoplay: true,
          },
        ],
      },
    ],
  });
  assert.equal(s.modules[0].items[0].autoplay, undefined);
  assert.equal(
    normalizeScene({
      ...base(),
      modules: [
        {
          id: "media",
          kind: "media",
          title: "Media",
          items: [{ id: "one", type: "image", url: "javascript:alert(1)" }],
        },
      ],
    }),
    null,
  );
});
test("local attachments reference in-memory file IDs rather than persisting blobs or base64", () => {
  const s = attachmentScene(
    "O arquivo contém uma tabela de resultados. Verifique os valores antes de utilizá-los em um relatório definitivo.",
    [{ id: "local-1", name: "reference.png", image: true }],
  );
  assert.equal(s.modules[0].kind, "media");
  assert.equal(s.modules[0].items[0].localId, "local-1");
  assert.equal(s.modules[0].items[0].url, undefined);
  assert.equal(s.source.kind, "attachment");
});
test("panel policy caps simultaneous projections and respects explicit hiding", () => {
  const s = brazilReferenceScene();
  assert.equal(
    visibleModules(
      s,
      s.modules.map((m) => m.id),
      true,
    ).length,
    1,
  );
  assert.equal(visibleModules(s, [], false).length, 0);
  assert.equal(
    visibleModules(
      s,
      s.modules.map((m) => m.id),
      false,
    ).length,
    3,
  );
});
test("invalid metric values cannot claim successful measurement", () => {
  for (const value of [NaN, Infinity, -1e15, 1e15])
    assert.equal(
      normalizeScene({
        ...base(),
        modules: [
          {
            id: "metrics",
            kind: "metrics",
            title: "Metrics",
            unit: "ms",
            style: "bars",
            values: [{ label: "latency", value }],
          },
        ],
      }),
      null,
    );
});

test("user media references are prepared without remote fetching, generation or video analysis", () => {
  const reply = localVisualReference(
    "Mostre este vídeo https://media.example/my-clip.mp4",
  );
  assert.equal(reply.usage, null);
  assert.equal(reply.visual.modules[0].kind, "media");
  assert.equal(reply.visual.modules[0].items[0].type, "video");
  assert.match(reply.text, /não realiza geração nem análise/);
  assert.equal(localVisualReference("Mostre https://localhost/a.mp4"), null);
});
