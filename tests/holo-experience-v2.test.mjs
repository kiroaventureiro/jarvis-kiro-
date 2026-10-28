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

const {
  wordUnits,
  revealPlan,
  visibleUnits,
  chunkText,
  semanticHighlights,
  highlightedRuns,
} = await load("lib/holo/reveal.ts");
const { planContent, contentBudget, moduleText, mayComplete, metricTone } =
  await load("lib/holo/content-planner.ts");
const { HoloDirector } = await load("lib/holo/director.ts");
const { reportText } = await load("lib/holo/export-renderer.ts");
const sample = () => ({
  version: 1,
  id: "v2",
  title: "Relatório demonstrativo",
  mode: "analysis",
  createdAt: new Date().toISOString(),
  source: { kind: "reference", label: "Dados simulados para teste" },
  narration: "Explicação de teste.",
  modules: [
    {
      id: "report",
      kind: "report",
      title: "Projeto de teste",
      summary: "Contexto breve.",
      items: Array.from({ length: 8 }, (_, i) => ({
        label: "Tema " + i,
        detail:
          "Informação essencial sobre o projeto. ".repeat(6) +
          "Marco final " +
          i +
          ".",
      })),
      body:
        "DOCUMENTO INTEGRAL. " +
        "Contexto detalhado que deve continuar no PDF. ".repeat(40),
    },
  ],
});
test("word reveal preserves accents, combining marks, family emoji, flags and modifiers", () => {
  const text = "Ação em São Paulo: café 👨‍👩‍👧‍👦 👍🏽 🇧🇷";
  const units = wordUnits(text);
  assert.equal(units.join(""), text);
  assert.ok(units.includes("👨‍👩‍👧‍👦 "));
  assert.ok(units.some((x) => x.includes("👍🏽")));
  for (let i = 0; i <= units.length; i++)
    assert.ok(!/\u200d$/.test(units.slice(0, i).join("")));
});
test("adaptive reveal accelerates long text by complete word groups", () => {
  const short = revealPlan("Uma explicação breve."),
    long = revealPlan("Informação contextual relevante. ".repeat(90));
  assert.equal(short.batch, 1);
  assert.ok(long.batch > 1);
  assert.equal(visibleUnits(short, 0), 0);
  assert.equal(visibleUnits(short, short.duration), short.units.length);
  assert.ok(long.duration < long.units.length * 105);
});
test("chunking is bounded and preserves every source word", () => {
  const text = "Uma explicação com acentuação e contexto essencial. ".repeat(
    24,
  );
  const parts = chunkText(text, 150);
  assert.ok(parts.length > 3);
  assert.ok(parts.every((x) => x.length <= 150));
  assert.equal(
    parts.join(" ").replace(/\s+/g, " ").trim(),
    text.replace(/\s+/g, " ").trim(),
  );
});
test("responsive planner splits all eight report items without the previous four-item cutoff", () => {
  const scene = sample(),
    plan = planContent(scene, { width: 390, height: 370 });
  assert.deepEqual(
    [...new Set(plan.filter((s) => s.point >= 0).map((s) => s.point))],
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  for (let i = 0; i < 8; i++)
    assert.ok(
      plan.some((s) => moduleText(s.content).includes("Marco final " + i)),
    );
  assert.ok(
    plan.every(
      (s) =>
        s.source === scene.source && s.minimumMs > 0 && s.reveal.completeAt > 0,
    ),
  );
});
test("smaller content area produces more bounded holograms without shrinking fonts or omitting text", () => {
  const scene = sample(),
    small = planContent(scene, { width: 320, height: 240 }),
    large = planContent(scene, { width: 1200, height: 700 });
  assert.ok(small.length > large.length);
  assert.ok(
    contentBudget({ width: 320, height: 240 }).characters <
      contentBudget({ width: 1200, height: 700 }).characters,
  );
  assert.equal(
    JSON.stringify(scene),
    JSON.stringify(sample()).replace(
      /"createdAt":"[^"]+"/,
      JSON.stringify(scene).match(/"createdAt":"[^"]+"/)[0],
    ),
  );
});
test("every timeline event and its final detail receive an automatic visual stage", () => {
  const s = sample();
  s.modules = [
    {
      id: "history",
      kind: "timeline",
      title: "História do Brasil",
      events: Array.from({ length: 8 }, (_, i) => ({
        when: String(1500 + i * 60),
        label: "Marco " + i,
        detail:
          "Contexto histórico documentado. ".repeat(5) +
          "Conclusão essencial " +
          i,
      })),
    },
  ];
  const p = planContent(s, { width: 390, height: 380 });
  for (let i = 0; i < 8; i++)
    assert.ok(
      p.some((x) => moduleText(x.content).includes("Conclusão essencial " + i)),
    );
  assert.ok(p.every((x) => x.content.events.length === 1));
});
test("complete report and all raw metrics remain in exports rather than replacing sources with visual summaries", () => {
  const scene = sample(),
    before = JSON.stringify(scene),
    plan = planContent(scene, { width: 320, height: 240 });
  assert.ok(plan.every((x) => x.content.kind !== "report" || !x.content.body));
  assert.equal(JSON.stringify(scene), before);
  assert.ok(reportText(scene).includes(scene.modules[0].body));
});
test("semantic highlights keep exact text and use selective, labeled categories", () => {
  const text = "Brasil em 1988: IPCA -0,32%, Selic e R$ 5,33. Supabase.";
  const h = semanticHighlights(text, ["Brasil"]);
  assert.ok(h.length <= 6);
  assert.ok(h.some((x) => x.kind === "region"));
  assert.ok(h.some((x) => x.kind === "date"));
  const runs = highlightedRuns(text, h);
  assert.equal(runs.map((r) => r.text).join(""), text);
  assert.equal(
    highlightedRuns("R$ 5,33", [{ text: "R$ 5,33", kind: "number" }])[0].kind,
    "number",
  );
});
test("indicator colors differ while signed values, periods and chart scales stay unchanged", () => {
  assert.equal(
    new Set([
      metricTone("ipca", ""),
      metricTone("selic", ""),
      metricTone("usd", ""),
    ]).size,
    3,
  );
  const s = sample();
  s.modules = [
    {
      id: "ipca",
      kind: "metrics",
      title: "IPCA",
      unit: "%",
      style: "line",
      values: [
        { label: "Ago", period: "2026-08-01", value: -0.32 },
        { label: "Set", period: "2026-09-01", value: 0.82 },
      ],
    },
  ];
  assert.deepEqual(planContent(s)[0].content.values, s.modules[0].values);
});
test("geographic mentions receive progressive focused views and country references remain local", () => {
  const s = sample();
  s.narration = "Brasil, França e Japão são as áreas mencionadas.";
  s.modules = [
    {
      id: "world",
      kind: "map",
      region: "WORLD",
      title: "Contexto geográfico",
      focusCountry: "BRA",
      caption: "Malha simplificada.",
    },
  ];
  assert.deepEqual(
    planContent(s).map((x) => x.content.focusCountry),
    ["BRA", "FRA", "JPN"],
  );
});
test("elapsed time alone cannot finish a hologram with unfinished writing", () => {
  const step = planContent(sample())[0];
  assert.equal(
    mayComplete(step, {
      elapsed: 100000,
      written: false,
      seen: true,
      readingSince: 0,
      voiceFraction: 1,
      voiceFresh: false,
      voiceEnded: true,
    }),
    false,
  );
});
test("hidden essential content blocks transition even after narration and minimum time", () => {
  const step = planContent(sample())[0];
  assert.equal(
    mayComplete(step, {
      elapsed: 100000,
      written: true,
      seen: false,
      readingSince: 0,
      voiceFraction: 1,
      voiceFresh: true,
      voiceEnded: true,
    }),
    false,
  );
});
test("director waits for written, visible content and reading time then advances", () => {
  const plan = planContent(sample()),
    d = new HoloDirector(plan),
    flow = {
      stepId: plan[0].id,
      written: true,
      seen: true,
      unseenPixels: 0,
      visibleHeight: 320,
    };
  let iterations = 0;
  while (d.state.index === 0 && iterations++ < 300)
    d.tick(100, flow, { fraction: 1, fresh: false, ended: true });
  assert.equal(d.state.index, 1);
  assert.equal(d.state.elapsed, 0);
});
test("stale completion from a previous hologram cannot skip the next one", () => {
  const p = planContent(sample()),
    d = new HoloDirector(p);
  d.jump(1);
  d.resume();
  for (let i = 0; i < 80; i++)
    d.tick(
      100,
      { stepId: p[0].id, written: true, seen: true, unseenPixels: 0 },
      { fraction: 1, fresh: false, ended: true },
    );
  assert.equal(d.state.index, 1);
});
test("pause, hidden tabs and resume preserve visual position", () => {
  const p = planContent(sample()),
    d = new HoloDirector(p);
  d.tick(200, undefined, { fraction: 0, fresh: false, ended: true });
  d.pause();
  const elapsed = d.state.elapsed;
  d.tick(200, undefined, { fraction: 0, fresh: false, ended: true });
  assert.equal(d.state.elapsed, elapsed);
  d.resume();
  d.tick(200, undefined, { fraction: 0, fresh: false, ended: true }, 1, false);
  assert.equal(d.state.elapsed, elapsed);
  d.tick(100, undefined, { fraction: 0, fresh: false, ended: true });
  assert.equal(d.state.elapsed, elapsed + 100);
});
test("fresh voice boundaries hold a stage; missing events recover through the guided policy", () => {
  const p = planContent(sample()),
    d = new HoloDirector(p),
    flow = { stepId: p[0].id, written: true, seen: true, unseenPixels: 0 };
  for (let i = 0; i < 150; i++)
    d.tick(100, flow, { fraction: 0, fresh: true, ended: false });
  assert.equal(d.state.index, 0);
  d.tick(100, flow, { fraction: 0, fresh: false, ended: false });
  assert.equal(d.state.index, 1);
});
test("permanent visual failure pauses visibly rather than advancing or waiting forever", () => {
  const p = planContent(sample()),
    d = new HoloDirector(p);
  for (let i = 0; i < 1000 && d.state.status === "playing"; i++)
    d.tick(
      100,
      { stepId: p[0].id, written: false, seen: false, unseenPixels: 400 },
      { fraction: 1, fresh: false, ended: true },
    );
  assert.equal(d.state.status, "blocked");
  assert.equal(d.state.index, 0);
  assert.ok(d.state.issue);
  d.resume();
  assert.equal(d.state.status, "playing");
});
test("an unreadable viewport is paused instead of claiming hidden content was shown", () => {
  const p = planContent(sample()),
    d = new HoloDirector(p);
  for (let i = 0; i < 20; i++)
    d.tick(
      100,
      {
        stepId: p[0].id,
        written: true,
        seen: true,
        unseenPixels: 0,
        visibleHeight: 0,
      },
      { fraction: 1, fresh: false, ended: true },
    );
  assert.equal(d.state.status, "blocked");
  assert.equal(d.state.index, 0);
});

test("compact metrics split evolution and latest observation while keeping the same source series", () => {
  const s = sample();
  s.modules = [
    {
      id: "ipca",
      kind: "metrics",
      title: "IPCA mensal",
      unit: "%",
      style: "line",
      values: [
        { label: "Ago", value: -0.32 },
        { label: "Set", value: 0.82 },
      ],
    },
  ];
  const plan = planContent(s, { width: 320, height: 300 });
  assert.deepEqual(
    plan.map((p) => p.metricView),
    ["chart", "observation"],
  );
  for (const p of plan) assert.deepEqual(p.content.values, s.modules[0].values);
});

test("Unicode fallback also preserves full emoji and combining sequences", () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, "Segmenter");
  try {
    Object.defineProperty(Intl, "Segmenter", {
      value: undefined,
      configurable: true,
    });
    const text = "café 👨‍👩‍👧‍👦 👍🏽 🇧🇷";
    assert.equal(wordUnits(text).join(""), text);
    assert.ok(wordUnits(text).includes("👍🏽 "));
  } finally {
    Object.defineProperty(Intl, "Segmenter", descriptor);
  }
});
test("explicit personal titles can be highlighted without coloring arbitrary organizations as people", () => {
  assert.ok(
    semanticHighlights("Dom Pedro I e o Banco Central").some(
      (x) => x.kind === "person" && x.text === "Dom Pedro I",
    ),
  );
  assert.ok(
    !semanticHighlights("Banco Central do Brasil").some(
      (x) => x.kind === "person",
    ),
  );
});

test("categorical metrics keep every label and a shared scale across compact holograms", () => {
  const s = sample();
  s.modules = [
    {
      id: "status",
      kind: "metrics",
      title: "Ações verificadas",
      unit: "ações",
      style: "bars",
      values: [
        { label: "Concluídas", value: 8 },
        { label: "Pendentes", value: 3 },
        { label: "Falharam", value: 1 },
      ],
    },
  ];
  const p = planContent(s, { width: 320, height: 300 });
  assert.deepEqual(
    p.map((x) => x.metricView),
    ["categories", "categories", "categories"],
  );
  assert.deepEqual(
    p.flatMap((x) => x.content.values),
    s.modules[0].values,
  );
  for (const x of p) assert.deepEqual(x.metricDomain, { low: 0, high: 8 });
});

test("geographic focus preserves every explicitly mentioned country beyond the first five", () => {
  const s = sample();
  s.narration = "Brasil, França, Japão, Alemanha, Canadá e Argentina";
  s.modules = [
    {
      id: "world",
      kind: "map",
      region: "WORLD",
      title: "Contexto",
      caption: "Países mencionados",
    },
  ];
  const p = planContent(s);
  assert.equal(p.length, 6);
  assert.equal(new Set(p.map((x) => x.content.focusCountry)).size, 6);
});
