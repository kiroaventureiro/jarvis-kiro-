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

const { NarrationCoordinator, narrationScript } = await load(
  "lib/holo/narration.ts",
);
const { planContent } = await load("lib/holo/content-planner.ts");
const { HoloDirector } = await load("lib/holo/director.ts");
const { speechChunks } = await load("lib/voice/speech-output.ts");
const { brazilFocuses, regionalMap } = await load(
  "lib/holo/geographic-focus.ts",
);
const { normalizeScene } = await load("lib/holo/validation.ts");
const { localVisualReference } = await load("lib/holo/orchestrator.ts");
const {
  CommonsResearch,
  parseCommonsPage,
  commonsUpload,
  commonsTitle,
  imageSearchIntent,
} = await load("lib/research/commons.ts");
const { conversationAction } = await load("lib/holo/conversation-actions.ts");
const { developmentIntent } = await load(
  "lib/connectors/development-intent.ts",
);
const { buildAbacusPlan } = await load("lib/abacus/protocol.ts");
const { reportText } = await load("lib/holo/export-renderer.ts");
const scene = () => ({
  version: 1,
  id: "narrative-test",
  title: "Explicação",
  mode: "explanation",
  createdAt: new Date().toISOString(),
  source: { kind: "reference", label: "Teste" },
  modules: [
    {
      id: "map",
      title: "Brasil",
      kind: "map",
      region: "BR",
      caption: "O território brasileiro.",
    },
    {
      id: "report",
      title: "Contexto",
      kind: "report",
      summary: "Explicação importante.",
      items: [],
    },
  ],
});
const turn = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function speaker() {
  const calls = [],
    pending = [];
  let cancelled = 0;
  return {
    calls,
    pending,
    get cancelled() {
      return cancelled;
    },
    speak(text, signal) {
      calls.push(text);
      return new Promise((resolve, reject) =>
        pending.push({ resolve, reject, signal }),
      );
    },
    cancel() {
      cancelled++;
    },
  };
}
function start(s = scene()) {
  const coordinator = new NarrationCoordinator(),
    plan = planContent(s),
    output = speaker(),
    controller = new AbortController();
  coordinator.register(s.id, plan, plan[0].id);
  let done = false,
    error = null;
  const result = coordinator
    .begin(
      s,
      "O Brasil apresenta diversidade. A explicação completa deve permanecer disponível.",
      controller.signal,
      output,
    )
    .then(
      () => {
        done = true;
      },
      (e) => {
        error = e;
      },
    );
  return {
    coordinator,
    plan,
    output,
    controller,
    result,
    get done() {
      return done;
    },
    get error() {
      return error;
    },
    s,
  };
}
test("shared script preserves the supplied answer without adding visual narration", () => {
  const s = scene(),
    p = planContent(s),
    text =
      "O Brasil apresenta diversidade. O contexto precisa ser compreendido. FINAL INTEGRAL DA EXPLICAÇÃO.";
  const script = narrationScript(s, p, text);
  assert.equal(script.length, p.length);
  for (const sentence of [
    "O Brasil apresenta diversidade.",
    "O contexto precisa ser compreendido.",
    "FINAL INTEGRAL DA EXPLICAÇÃO.",
  ])
    assert.ok(script.some((x) => x.text.includes(sentence)));
  assert.equal(
    script
      .map((x) => x.text)
      .filter(Boolean)
      .join(" "),
    text,
  );
});
test("speech chunks do not silently truncate long explanations or split Unicode units", () => {
  const text =
    "Uma explicação extensa com acentos e família 👨‍👩‍👧‍👦. ".repeat(350) +
    "FIM INTEGRAL";
  const p = speechChunks(text);
  assert.ok(p.join(" ").includes("FIM INTEGRAL"));
  assert.equal(p.join(" ").match(/família/g).length, 350);
  assert.ok(p.length < text.length / 240);
  assert.ok(p.every((x) => !x.includes("\ufffd")));
  assert.ok(p.every((x) => x.length <= 640));
});
test("voice session remains pending until both spoken chapter and visual completion", async () => {
  const f = start();
  assert.equal(f.coordinator.state.phase, "speaking");
  f.coordinator.finish(f.s.id);
  assert.equal(f.done, false);
  f.output.pending[0].resolve();
  await turn();
  assert.equal(f.coordinator.state.phase, "waiting");
  assert.equal(f.done, false);
  f.coordinator.activate(f.s.id, f.plan[1].id);
  assert.equal(f.output.calls.length, 2);
  f.output.pending[1].resolve();
  await turn();
  f.coordinator.finish(f.s.id);
  await f.result;
  assert.equal(f.done, true);
});
test("no independent timer starts the next spoken chapter before its visual is activated", async () => {
  const f = start();
  f.output.pending[0].resolve();
  await turn();
  assert.equal(f.output.calls.length, 1);
  assert.equal(f.coordinator.state.stepId, f.plan[0].id);
  f.controller.abort();
  await f.result;
});
test("current narration can exceed visual safety time without being cut by a visual timer", () => {
  const p = planContent(scene()),
    d = new HoloDirector(p);
  for (let i = 0; i < 800; i++)
    d.tick(
      100,
      { stepId: p[0].id, written: true, seen: true, unseenPixels: 0 },
      { fraction: 0, fresh: true, ended: false },
    );
  assert.equal(d.state.status, "playing");
  assert.equal(d.state.index, 0);
});
test("new narration cancels the old session and ignores stale speech completions", async () => {
  const f = start(),
    s = { ...scene(), id: "second" },
    p = planContent(s),
    out = speaker();
  f.coordinator.register(s.id, p, p[0].id);
  const run = f.coordinator
    .begin(s, "Uma nova explicação.", new AbortController().signal, out)
    .catch(() => {});
  await f.result;
  assert.equal(f.error.name, "AbortError");
  assert.ok(f.output.cancelled > 0);
  f.output.pending[0].resolve();
  await turn();
  assert.equal(f.coordinator.state.sceneId, "second");
  assert.equal(f.coordinator.state.phase, "speaking");
  f.coordinator.cancel();
  await run;
});
test("voice error requires explicit retry or silent continuation without automatic calls", async () => {
  const f = start();
  f.output.pending[0].reject(Error("Voz falhou"));
  await turn();
  assert.equal(f.coordinator.state.phase, "error");
  f.coordinator.activate(f.s.id, f.plan[1].id);
  assert.equal(f.output.calls.length, 1);
  f.coordinator.retry();
  assert.equal(f.output.calls.length, 2);
  f.controller.abort();
  await f.result;
});
test("silent continuation resolves only when the visual flow finishes", async () => {
  const f = start();
  f.output.pending[0].reject(Error("Falha"));
  await turn();
  f.coordinator.silence();
  assert.equal(f.coordinator.state.phase, "silent");
  assert.equal(f.done, false);
  f.coordinator.finish(f.s.id);
  await f.result;
  assert.equal(f.done, true);
});
test("native speech pause and resume do not restart or duplicate the utterance", async () => {
  const f = start();
  let pause = 0,
    resume = 0;
  f.output.pause = () => {
    pause++;
    return true;
  };
  f.output.resume = () => resume++;
  f.coordinator.pause(f.s.id);
  assert.equal(f.coordinator.state.phase, "paused");
  f.coordinator.resume(f.s.id);
  assert.equal(pause, 1);
  assert.equal(resume, 1);
  assert.equal(f.output.calls.length, 1);
  f.controller.abort();
  await f.result;
});
test("fallback pause cancels the active utterance and restarts only on explicit resume", async () => {
  const f = start();
  f.coordinator.pause(f.s.id);
  assert.ok(f.output.cancelled > 0);
  assert.equal(f.output.calls.length, 1);
  f.coordinator.resume(f.s.id);
  assert.equal(f.output.calls.length, 2);
  f.output.pending[0].resolve();
  await turn();
  assert.equal(f.coordinator.state.phase, "speaking");
  f.controller.abort();
  await f.result;
});
test("unmount cancels a pending session while immediate strict-mode reattachment is preserved", async () => {
  const f = start();
  f.coordinator.detach(f.s.id);
  f.coordinator.register(f.s.id, f.plan, f.plan[0].id);
  await turn();
  assert.equal(f.coordinator.state.phase, "speaking");
  f.coordinator.detach(f.s.id);
  await turn();
  await f.result;
  assert.equal(f.error.name, "AbortError");
});
test("missing visual attachment reports a recoverable failure rather than hanging invisibly", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const c = new NarrationCoordinator(),
    s = scene(),
    out = speaker();
  const r = c
    .begin(s, "Texto", new AbortController().signal, out)
    .catch(() => {});
  t.mock.timers.tick(2600);
  assert.equal(c.state.phase, "error");
  assert.equal(out.calls.length, 0);
  c.cancel();
  await r;
});
test("a pre-aborted request never opens narration or speaks", async () => {
  const c = new NarrationCoordinator(),
    abort = new AbortController(),
    out = speaker();
  abort.abort();
  await assert.rejects(c.begin(scene(), "Texto", abort.signal, out), {
    name: "AbortError",
  });
  assert.equal(out.calls.length, 0);
});
test("Brazil region focus uses all nine Northeast states and explicit current-boundary context", () => {
  const f = brazilFocuses("Brasil, Nordeste e Rio de Janeiro");
  assert.equal(f.find((x) => x.name === "Nordeste").ids.length, 9);
  assert.deepEqual(regionalMap("Mostre o Rio de Janeiro").focusRegions, ["33"]);
  assert.match(
    regionalMap("Mostre o Nordeste").caption,
    /não representa fronteiras históricas/,
  );
});
test("geographic focus is preserved by validation and does not create unknown state identifiers", () => {
  const s = scene();
  s.modules[0] = {
    ...s.modules[0],
    focusRegions: ["21", "22", "33"],
    focusLabel: "Região atual",
  };
  assert.deepEqual(normalizeScene(s).modules[0].focusRegions, [
    "21",
    "22",
    "33",
  ]);
  s.modules[0].focusRegions = ["http://localhost"];
  assert.equal(normalizeScene(s).modules[0].focusRegions, undefined);
});
test("an explicit complete Brazil request returns substantive chapters and full export text", () => {
  const r = localVisualReference("Explique a história completa do Brasil");
  assert.ok(r.text.length > 2000);
  assert.equal(
    r.visual.modules.find((x) => x.kind === "timeline").events.length,
    8,
  );
  assert.ok(reportText(r.visual).includes("A Constituição de 1988"));
  assert.ok(r.visual.narration.includes("Nordeste"));
  assert.match(r.text, /não uma exposição exaustiva/);
});
test("asking for depth does not change the authorized token limit or select a paid fallback", () => {
  const p = buildAbacusPlan("Quero uma explicação completa em capítulos");
  assert.equal(p.max_tokens, 350);
  assert.equal(p.model, "route-llm");
  assert.match(p.messages[0].content, /apenas uma parte/);
});
const page = (patch = {}) => ({
  title: "File:Rio de Janeiro.jpg",
  imageinfo: [
    {
      thumburl:
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Rio.jpg/960px-Rio.jpg?utm_source=commons",
      extmetadata: {
        Artist: { value: "<b>Fotógrafo de teste</b>" },
        LicenseShortName: { value: "CC BY-SA 4.0" },
        LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" },
        ImageDescription: { value: "Photograph of Rio de Janeiro" },
        ...patch,
      },
    },
  ],
});
test("Commons metadata returns real-source attribution, permitted license and explicit image type", () => {
  const i = parseCommonsPage(page());
  assert.equal(i.author, "Fotógrafo de teste");
  assert.equal(i.nature, "photograph");
  assert.ok(!i.url.includes("utm_"));
  assert.match(i.sourceHref, /commons.wikimedia.org/);
});
test("unconfirmed image types are labeled reference rather than invented photography", () => {
  assert.equal(
    parseCommonsPage(page({ ImageDescription: { value: "Vista do Rio" } }))
      .nature,
    "reference",
  );
});
test("image validation rejects unsupported license, missing author and known AI-generated media", () => {
  assert.equal(
    parseCommonsPage(
      page({ LicenseShortName: { value: "All rights reserved" } }),
    ),
    null,
  );
  assert.equal(parseCommonsPage(page({ Artist: { value: "" } })), null);
  assert.equal(
    parseCommonsPage(page({ Categories: { value: "AI-generated images" } })),
    null,
  );
});
test("public domain is accepted only with explicit metadata, and HTML is never executed", () => {
  const i = parseCommonsPage(
    page({
      LicenseShortName: { value: "Public domain" },
      LicenseUrl: { value: "" },
      Artist: { value: "<img onerror=alert(1)>Autor" },
    }),
  );
  assert.equal(i.license, "Public domain");
  assert.equal(i.author, "Autor");
});
test("external images cannot target arbitrary hosts, credentials or non-image files", () => {
  for (const u of [
    "https://127.0.0.1/a.jpg",
    "https://upload.wikimedia.org.evil.test/a.jpg",
    "https://evil.test/a.jpg",
    "https://user:pass@upload.wikimedia.org/wikipedia/commons/a.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/a.svg",
  ])
    assert.equal(commonsUpload(u), undefined);
  assert.equal(commonsTitle("File:X.jpg|Other"), undefined);
});
test("real-source adapter verifies response and content type before exposing image results", async () => {
  const calls = [];
  const engine = new CommonsResearch(async (url, opts) => {
    calls.push({ url: String(url), method: opts?.method || "GET" });
    return String(url).includes("/w/api.php")
      ? Response.json({ query: { pages: [page()] } })
      : new Response(null, { headers: { "content-type": "image/jpeg" } });
  });
  const images = await engine.search("Rio de Janeiro");
  assert.equal(images.length, 1);
  assert.equal(calls[1].method, "HEAD");
  assert.equal(new URL(calls[0].url).searchParams.get("gsrnamespace"), "6");
  const n = calls.length;
  await engine.image("File:Rio de Janeiro.jpg");
  assert.equal(calls.length, n);
});
test("a missing or non-image remote file is not reported as available", async () => {
  const engine = new CommonsResearch(async (url) =>
    String(url).includes("/w/api.php")
      ? Response.json({ query: { pages: [page()] } })
      : new Response("not an image", {
          headers: { "content-type": "text/html" },
        }),
  );
  assert.deepEqual(await engine.search("Rio"), []);
});
test("public-source rate limit stops repeated traffic without model calls", async () => {
  const engine = new CommonsResearch(
    async () => Response.json({ query: { pages: [] } }),
    () => 1000,
  );
  for (let i = 0; i < 18; i++) await engine.search("Rio");
  await assert.rejects(engine.search("Rio"), /limite temporário/);
});
test("image search sends a query only for explicit requests, not arbitrary private text", () => {
  assert.equal(
    imageSearchIntent("Analise este contrato com fotos anexadas"),
    null,
  );
  assert.equal(
    imageSearchIntent("Mostre uma foto real do Cristo Redentor"),
    "Cristo Redentor",
  );
  assert.equal(
    imageSearchIntent("Busque imagens de onça-pintada"),
    "onça-pintada",
  );
});
test("conversation distinguishes local preparation from unexecuted external saving or sharing", () => {
  assert.deepEqual(conversationAction("Prepare um PDF desta análise"), {
    kind: "export",
    format: "pdf",
  });
  assert.deepEqual(conversationAction("Salve no projeto esse relatório"), {
    kind: "external",
  });
  assert.deepEqual(conversationAction("Envie esse PDF"), { kind: "external" });
  assert.equal(conversationAction("O que é um PDF?"), null);
});
test("self-development intent selects fixed relevant files without granting any write operation", () => {
  const x = developmentIntent(
    "Jarvis, encontre o problema da sua voz e proponha correção",
  );
  assert.equal(x.project, "jarvis-kiro");
  assert.equal(x.area, "voice");
  assert.ok(x.paths.includes("lib/voice/speech-output.ts"));
  assert.ok(x.paths.every((p) => !p.includes(".env")));
  assert.equal(developmentIntent("Explique como funciona uma voz"), null);
});

const { answerPlaceReference } = await load("lib/research/places.ts");
const { geographyScene } = await load("lib/holo/geography.ts");
const { findPlace, projectWorldPoint } = await load("lib/holo/place-policy.ts");
test("offline real city references locate Paris without an external geocoding request", () => {
  const r = answerPlaceReference("Mostre o mapa de Paris, França");
  assert.ok(r.visual.modules[0].focusPlaceId);
  assert.equal(r.visual.modules[0].focusCountry, "FRA");
  assert.match(r.text, /Paris/);
  assert.match(r.text, /Coordenadas/);
  assert.match(r.text, /não um mapa de ruas/);
});
test("city lookup does not run on unrelated private analysis and explains unresolved localities", () => {
  assert.equal(
    answerPlaceReference("Analise meus documentos confidenciais"),
    null,
  );
  assert.equal(
    answerPlaceReference("Mostre um mapa de LocalidadeInexistenteXYZ"),
    null,
  );
});
test("continental grouping uses the source countries rather than invented geographic boundaries", () => {
  const s = geographyScene("Mostre o mapa da Europa");
  assert.ok(s.modules[0].focusCountries.includes("FRA"));
  assert.ok(s.modules[0].focusCountries.includes("DEU"));
  assert.match(s.modules[0].caption, /transcontinentais/);
});
test("city projection agrees with a primary Natural Earth vertex in the existing map", () => {
  const p = projectWorldPoint(-53.373662, -33.768378);
  assert.ok(Math.abs(p.x - 351.7) < 0.1);
  assert.ok(Math.abs(p.y - 343.8) < 0.1);
});
test("Commons license link cannot redirect attribution to an unrelated host or incompatible license", () => {
  assert.equal(
    parseCommonsPage(
      page({
        LicenseUrl: {
          value:
            "https://evil.test/?url=https://creativecommons.org/licenses/by-sa/4.0",
        },
      }),
    ),
    null,
  );
  assert.equal(
    parseCommonsPage(
      page({
        LicenseUrl: { value: "https://creativecommons.org/licenses/by-nc/4.0" },
      }),
    ),
    null,
  );
});
test("credentials are rejected before a public image query leaves the application", async () => {
  let calls = 0;
  const engine = new CommonsResearch(async () => {
    calls++;
    return Response.json({ query: { pages: [] } });
  });
  await assert.rejects(
    engine.search("sk-proj-not_a_real_key_1234567890"),
    /credenciais/,
  );
  assert.equal(calls, 0);
});
