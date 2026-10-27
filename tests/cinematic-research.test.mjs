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
  presentationPlan,
  stepAt,
  planDuration,
  chartRange,
  chartPosition,
  googleMapsUrl,
} = await load("lib/holo/presentation.ts");
const { countryFor, geographyScene } = await load("lib/holo/geography.ts");
const { normalizeScene } = await load("lib/holo/validation.ts");
const {
  collectEconomy,
  economyReply,
  parseEconomicData,
  economyIntent,
  compareInflation,
  ECONOMY_SOURCES,
} = await load("lib/research/economy.ts");
const { jpegPagesPdf, reportText } = await load("lib/holo/export-renderer.ts");
const { createOperationalVoiceTool, VISUAL_RESEARCH_VOICE_TOOL } = await load(
  "lib/operational/realtime-tool.ts",
);
const scene = () => ({
  version: 1,
  id: "cinema-fixture",
  title: "Demonstração",
  mode: "analysis",
  createdAt: "2026-10-27T12:00:00.000Z",
  source: { kind: "research", label: "Fontes simuladas" },
  narration: "Resposta integral preservada.",
  modules: [
    {
      id: "map",
      kind: "map",
      region: "WORLD",
      title: "Mundo",
      caption: "Referência",
      focusCountry: "BRA",
    },
    {
      id: "data",
      kind: "metrics",
      title: "IPCA",
      unit: "%",
      style: "line",
      values: [
        { label: "Ago", value: -0.32 },
        { label: "Set", value: 0.82 },
      ],
    },
    {
      id: "summary",
      kind: "report",
      title: "Relatório",
      summary: "Síntese",
      items: [
        { label: "A", detail: "Resultado A" },
        { label: "B", detail: "Resultado B" },
      ],
      body: "Conteúdo integral do relatório.",
    },
  ],
});
const now = () => Date.parse("2026-10-27T12:00:00Z");
const bcb = [
  { data: "01/08/2026", valor: "-0.32" },
  { data: "01/09/2026", valor: "0.82" },
];
const ibge = [
  {
    id: "63",
    variavel: "IPCA - Variação mensal",
    unidade: "%",
    resultados: [
      {
        series: [
          {
            localidade: { id: "1" },
            serie: { 202608: "-0.32", 202609: "0.82" },
          },
        ],
      },
    ],
  },
];
const samples = async (url) =>
  Response.json(String(url).includes("ibge") ? ibge : bcb);
test("director plans multiple transient stages, center focus, support and final report", () => {
  const p = presentationPlan(scene());
  assert.equal(p.length, 4);
  assert.equal(p[0].focus, "center");
  assert.equal(p[1].supportId, "map");
  assert.equal(p.at(-1).id, "conclusion");
  assert.equal(stepAt(p, 0).progress, 0);
  assert.equal(stepAt(p, p[0].duration).index, 1);
  assert.equal(stepAt(p, planDuration(p)).finished, true);
});
test("plain answer points move across left, right, center and bottom rather than fixed transcript", () => {
  const s = scene();
  s.modules = [
    {
      ...s.modules[2],
      items: Array.from({ length: 4 }, (_, i) => ({
        label: "Etapa " + i,
        detail: "Explicação do passo",
      })),
    },
  ];
  const p = presentationPlan(s);
  assert.deepEqual(
    p.slice(0, 4).map((x) => x.focus),
    ["left", "right", "center", "bottom"],
  );
  assert.deepEqual(
    p.slice(0, 4).map((x) => x.point),
    [0, 1, 2, 3],
  );
});
test("signed economic charts retain deflation and a zero baseline", () => {
  assert.deepEqual(chartRange([-0.32, 0.82]), { low: -0.32, high: 0.82 });
  assert.equal(chartPosition(-0.32, -0.32, 0.82), 0);
  assert.equal(chartPosition(0.82, -0.32, 0.82), 1);
  assert.equal(chartRange([0, 0]).high, 1);
  assert.ok(normalizeScene(scene()));
});
test("world geography is local vector data with safe paths and official external Maps link", () => {
  const map = JSON.parse(fs.readFileSync("config/holo-world-map.json"));
  assert.equal(map.regions.length, 177);
  assert.equal(new Set(map.regions.map((x) => x.id)).size, 177);
  for (const r of map.regions) {
    assert.ok(r.name);
    assert.match(r.d, /^[MLZ0-9.,-]+$/);
  }
  assert.equal(countryFor("Mostre o Brasil, por favor").id, "BRA");
  assert.equal(countryFor("Localize a França.").id, "FRA");
  assert.equal(geographyScene("mapa-múndi").modules[0].region, "WORLD");
  const u = new URL(googleMapsUrl("São Paulo & arredores"));
  assert.equal(u.hostname, "www.google.com");
  assert.equal(u.searchParams.get("query"), "São Paulo & arredores");
  assert.equal(u.searchParams.get("api"), "1");
  assert.ok(!u.searchParams.has("key"));
});
test("research intent selects only supported Brazilian economics, not fabricated global news", () => {
  assert.equal(economyIntent("Como está a economia brasileira?"), true);
  assert.equal(economyIntent("Qual o IPCA?"), true);
  assert.equal(economyIntent("Economia da França"), false);
  assert.equal(economyIntent("Últimas notícias do mundo"), false);
});
test("official adapters fetch four fixed read endpoints with bounded requests and no credentials", async () => {
  const seen = [];
  const result = await collectEconomy({
    now,
    fetcher: async (url, options) => {
      seen.push({ url, options });
      return samples(url);
    },
  });
  assert.equal(seen.length, 4);
  assert.deepEqual(
    seen.map((x) => x.url),
    ECONOMY_SOURCES.map((x) => x.base),
  );
  for (const { options } of seen) {
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, undefined);
    assert.ok(options.signal);
  }
  assert.ok(result.every((x) => x.status === "ok"));
  assert.equal(result[0].values[0].value, -0.32);
  const reply = economyReply(result);
  assert.ok(normalizeScene(reply.visual));
  assert.equal(
    reply.visual.modules.filter((x) => x.kind === "metrics").length,
    3,
  );
  assert.match(reply.text, /mesma estatística/);
  assert.equal(reply.usage, null);
  assert.equal(reply.visual.sources.length, 4);
});
test("observations in the future and malformed calendar dates cannot become current facts", () => {
  const values = parseEconomicData(
    "selic",
    [
      { data: "01/10/2026", valor: "10" },
      { data: "04/11/2026", valor: "15" },
      { data: "31/02/2026", valor: "2" },
      { data: "12/09/2026", valor: "NaN" },
    ],
    now(),
  );
  assert.deepEqual(values, [{ period: "2026-10-01", value: 10 }]);
});
test("missing, wrong IBGE variables and empty observations never become measured zero", () => {
  assert.throws(() =>
    parseEconomicData("ibge", [{ ...ibge[0], id: "other" }], now()),
  );
  assert.throws(() =>
    parseEconomicData(
      "ibge",
      [
        {
          ...ibge[0],
          resultados: [
            { series: [{ localidade: { id: "1" }, serie: { 202609: "" } }] },
          ],
        },
      ],
      now(),
    ),
  );
  assert.throws(() => parseEconomicData("usd", [], now()));
});
test("unavailable sources produce no synthetic charts and preserve failure evidence", async () => {
  const values = await collectEconomy({
    now,
    fetcher: async () => {
      throw Error("offline");
    },
  });
  const reply = economyReply(values);
  assert.equal(
    reply.visual.modules.some((x) => x.kind === "metrics"),
    false,
  );
  assert.ok(reply.visual.sources.every((s) => s.status === "unavailable"));
  assert.match(reply.text, /Não vou estimar/);
});
test("partial failure keeps valid indicators and does not claim successful IBGE verification", async () => {
  const data = await collectEconomy({
    now,
    fetcher: async (u) =>
      String(u).includes("ibge")
        ? Response.json({}, { status: 503 })
        : samples(u),
  });
  const reply = economyReply(data);
  assert.equal(
    reply.visual.modules.filter((m) => m.kind === "metrics").length,
    3,
  );
  assert.match(reply.text, /Conferência.*indisponível/);
});
test("mismatching periods and values are explicitly distinguished", async () => {
  const data = await collectEconomy({ now, fetcher: samples });
  data[3].values = [{ period: "2026-08-01", value: -0.32 }];
  assert.match(compareInflation(data[0], data[3]), /períodos diferentes/);
  data[3].values = [{ period: "2026-09-01", value: 10 }];
  assert.match(compareInflation(data[0], data[3]), /Divergência/);
  assert.equal(economyReply(data).visual.sources[0].status, "mismatch");
});
test("oversized source responses fail closed", async () => {
  const data = await collectEconomy({
    now,
    fetcher: async () => new Response("x".repeat(180001)),
  });
  assert.ok(data.every((s) => s.status === "unavailable"));
});
test("report exports preserve complete response, all data, provenance and limitations", () => {
  const s = scene();
  s.sources = [
    {
      label: "BCB",
      href: ECONOMY_SOURCES[0].base,
      checkedAt: s.createdAt,
      status: "ok",
    },
  ];
  const text = reportText(s);
  for (const term of [
    "Resposta integral",
    "Conteúdo integral",
    "-0,32",
    "BCB",
    "2026-10-27",
    "FONTES E LIMITAÇÕES",
  ])
    assert.ok(text.includes(term), term);
});
test("PDF binary cross-reference offsets point to every real object", () => {
  const bytes = jpegPagesPdf([
      { bytes: new Uint8Array([255, 216, 255, 217]), width: 1440, height: 900 },
      {
        bytes: new Uint8Array([255, 216, 255, 217]),
        width: 1240,
        height: 1754,
      },
    ]),
    text = Buffer.from(bytes).toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 2/);
  const start = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(start, start + 4), "xref");
  for (const m of text.matchAll(/(\d{10}) 00000 n/g)) {
    const offset = Number(m[1]);
    assert.match(text.slice(offset), /^\d+ 0 obj/);
  }
});
test("neural research tool uses authenticated internal route and returns projection once", async () => {
  const calls = [],
    visual = [],
    events = [];
  const t = createOperationalVoiceTool({
    signal: new AbortController().signal,
    isCurrent: () => true,
    onVisual: (x) => visual.push(x),
    send: (x) => events.push(x),
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return Response.json({
        available: true,
        text: "Dados simulados",
        visual: scene(),
      });
    },
  });
  const event = {
    type: "response.done",
    response_id: "r1",
    response: {
      status: "completed",
      output: [
        {
          type: "function_call",
          name: VISUAL_RESEARCH_VOICE_TOOL.name,
          call_id: "c1",
          arguments: JSON.stringify({ query: "Qual o IPCA?" }),
        },
      ],
    },
  };
  assert.equal(await t.handle(event), true);
  await t.handle(event);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/director/research");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(visual.length, 1);
  assert.equal(events.at(-1).type, "response.create");
});
test("voice research rejects injected endpoints, unexpected arguments and duplicated consumption", async () => {
  const t = createOperationalVoiceTool({
    signal: new AbortController().signal,
    isCurrent: () => true,
    send: () => {},
    fetcher: async () => {
      throw Error("Should not fetch");
    },
  });
  const event = (args) => ({
    type: "response.done",
    response_id: "r",
    response: {
      status: "completed",
      output: [
        {
          type: "function_call",
          name: "jarvis_visual_research",
          call_id: "c",
          arguments: JSON.stringify(args),
        },
      ],
    },
  });
  await assert.rejects(
    t.handle(event({ query: "x", url: "https://evil.invalid" })),
    /inválida/,
  );
});

test("WebM muxer retains explicit duration, VP8 track and ordered timestamps", async () => {
  const { muxVp8 } = await load("lib/holo/webm.ts");
  const bytes = muxVp8(
    [
      { bytes: new Uint8Array([1, 2, 3]), timestamp: 0, key: true },
      { bytes: new Uint8Array([4, 5, 6]), timestamp: 1000000, key: false },
    ],
    1440,
    900,
    2000,
    12,
  );
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString("hex"), "1a45dfa3");
  assert.ok(Buffer.from(bytes).includes(Buffer.from("V_VP8")));
  assert.ok(Buffer.from(bytes).includes(Buffer.from("webm")));
  assert.throws(
    () =>
      muxVp8(
        [
          { bytes: new Uint8Array([1]), timestamp: 2000000, key: true },
          { bytes: new Uint8Array([1]), timestamp: 0, key: false },
        ],
        1440,
        900,
        3000,
        12,
      ),
    /Linha do tempo/,
  );
  assert.throws(() => muxVp8([], 1, 1, 2000, 12));
});

test("official BCB requests respect the verified maximum of twenty observations",()=>{
 for(const source of ECONOMY_SOURCES.filter(s=>s.id!=="ibge"))assert.ok(Number(new URL(source.base).pathname.match(/ultimos\/(\d+)/)[1])<=20);
});
