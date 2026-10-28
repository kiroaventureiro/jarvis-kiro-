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

const {
  AbacusDiscovery,
  parseModels,
  parseTools,
  normalizeObservation,
  hubQuestion,
  readJsonBounded,
} = await load("lib/abacus/hub.ts");
const { validateMediaRequest, runMedia, mediaIntent } = await load(
  "lib/abacus/media.ts",
);
const { libraryIntent, searchLibrary, PublicLibrary } = await load(
  "lib/research/library.ts",
);
const { boundedBody, sameOrigin } = await load("lib/abacus/http.ts");
test("Discovery uses only official authenticated GET endpoints, caches and never generates", async () => {
  const requests = [],
    d = new AbacusDiscovery(async (url, o) => {
      requests.push({ url, o });
      return Response.json(
        url.includes("/models")
          ? { data: [{ id: "route-llm", pricing: { prompt: "0.001" } }] }
          : {
              tools: [
                {
                  name: "read_inventory",
                  description: "Inventário",
                  supported: true,
                  requires_connectors: ["gmail"],
                },
              ],
            },
      );
    });
  const a = await d.inspect("fixture-key"),
    b = await d.inspect("fixture-key");
  assert.deepEqual(a, b);
  assert.equal(requests.length, 2);
  assert.ok(
    requests.every((r) => r.o.method === "GET" && r.o.redirect === "error"),
  );
  assert.equal(a.tools[0].executionAuthorized, false);
  assert.deepEqual(a.tools[0].requiresConnectors, ["gmail"]);
  assert.equal(a.models[0].priceMetadata.prompt, "0.001");
});
test("Unavailable tools cannot erase a valid model catalog or invent tool access", async () => {
  const d = new AbacusDiscovery(async (u) =>
    u.includes("/models")
      ? Response.json({ data: [{ id: "flux2" }] })
      : new Response("", { status: 403 }),
  );
  const r = await d.inspect("fixture");
  assert.equal(r.toolsState, "unavailable");
  assert.deepEqual(r.tools, []);
  assert.equal(r.models.length, 1);
});
test("Catalog invalid, empty and authentication failures remain failures", async () => {
  assert.throws(() => parseModels({ data: "bad" }));
  const d = new AbacusDiscovery(async () => new Response("", { status: 401 }));
  await assert.rejects(d.inspect("fixture"));
  assert.deepEqual(parseTools({ tools: [{ name: "bad tool()" }] }), []);
});
test("Account observation strips arbitrary data and rejects secrets, invalid counts and future stamps", () => {
  const v = {
    plan: "Basic",
    remainingCredits: 13347,
    observedAt: new Date().toISOString(),
    connectedServices: ["Gmail"],
    connectorCatalogCount: 48,
    mcpCatalogCount: 402,
    installedMcpCount: 0,
    apiKey: "do-not-store",
  };
  const a = normalizeObservation(v);
  assert.equal(a.remainingCredits, 13347);
  assert.equal(a.apiKey, undefined);
  assert.equal(a.source, "owner_observation");
  assert.throws(() => normalizeObservation({ ...v, remainingCredits: -1 }));
  assert.throws(() =>
    normalizeObservation({ ...v, connectedServices: ["user@example.com"] }),
  );
  assert.throws(() => normalizeObservation({ ...v, observedAt: "2100-01-01" }));
});
test("Abacus resource questions are resolved without mistaking a creation command for an inspection", () => {
  for (const q of [
    "Quais ferramentas da Abacus você conhece?",
    "Qual o plano e saldo de créditos na Abacus?",
    "Você consegue vídeo pela Abacus?",
  ])
    assert.equal(hubQuestion(q), true, q);
  assert.equal(hubQuestion("Crie uma imagem na Abacus"), false);
  assert.equal(hubQuestion("Qual a história do Brasil?"), false);
  assert.equal(mediaIntent("Gere uma imagem de uma nave"), "image");
  assert.equal(mediaIntent("Crie uma locução"), "audio");
  assert.equal(mediaIntent("Como funciona imagem?"), null);
});
test("Media accepts a bounded concrete request, never client tools/credentials or arbitrary models", () => {
  assert.deepEqual(
    validateMediaRequest({ kind: "image", model: "flux2", prompt: "Uma nave" }),
    { kind: "image", model: "flux2", prompt: "Uma nave" },
  );
  for (const extra of [
    { apiKey: "secret" },
    { tools: [] },
    { url: "https://internal" },
  ])
    assert.throws(() =>
      validateMediaRequest({
        kind: "image",
        model: "flux2",
        prompt: "A",
        ...extra,
      }),
    );
  assert.throws(() =>
    validateMediaRequest({ kind: "image", model: "unknown", prompt: "A" }),
  );
  assert.throws(() =>
    validateMediaRequest({
      kind: "vision",
      model: "route-llm",
      prompt: "A",
      image: "https://private.invalid/x",
    }),
  );
});
test("Image generation calls one documented completion with one image and no automatic tools", async () => {
  let count = 0;
  const result = await runMedia(
    { kind: "image", model: "flux2", prompt: "Uma árvore" },
    "fixture",
    undefined,
    async (u, o) => {
      count++;
      assert.equal(u, "https://routellm.abacus.ai/v1/chat/completions");
      const b = JSON.parse(o.body);
      assert.deepEqual(b.modalities, ["image"]);
      assert.equal(b.image_config.num_images, 1);
      assert.equal(b.abacus_tools, undefined);
      return Response.json({
        model: "flux2",
        choices: [
          {
            message: {
              images: [{ image_url: { url: "https://media.abacus.ai/a.png" } }],
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 3, completion_tokens: 2 },
      });
    },
  );
  assert.equal(count, 1);
  assert.equal(result.image, "https://media.abacus.ai/a.png");
  assert.equal(result.usage.totalTokens, 5);
});
test("Audio request uses documented paired modalities and fixed output format", async () => {
  const r = await runMedia(
    { kind: "audio", model: "gpt-audio-mini", prompt: "Bom dia" },
    "fixture",
    undefined,
    async (u, o) => {
      const b = JSON.parse(o.body);
      assert.deepEqual(b.modalities, ["text", "audio"]);
      assert.equal(b.audio.format, "mp3");
      return Response.json({
        choices: [{ message: { content: "Bom dia", audio: { data: "YWJj" } } }],
      });
    },
  );
  assert.equal(r.audio, "YWJj");
});
test("Vision sends only explicit image input and rejects action/tool replies", async () => {
  let b;
  const image = "data:image/png;base64,YWJj";
  await runMedia(
    { kind: "vision", model: "route-llm", prompt: "Descreva", image },
    "fixture",
    undefined,
    async (u, o) => {
      b = JSON.parse(o.body);
      return Response.json({
        choices: [{ message: { content: "Um exemplo" } }],
      });
    },
  );
  assert.equal(b.messages[1].content[1].image_url.url, image);
  await assert.rejects(
    runMedia(
      { kind: "image", model: "flux2", prompt: "A" },
      "fixture",
      undefined,
      async () =>
        Response.json({
          choices: [{ finish_reason: "tool_calls", message: {} }],
        }),
    ),
  );
});
test("Upstream rate limits and malformed media do not trigger retries", async () => {
  let n = 0;
  await assert.rejects(
    runMedia(
      { kind: "audio", model: "gpt-audio-mini", prompt: "A" },
      "fixture",
      undefined,
      async () => {
        n++;
        return new Response("", { status: 429 });
      },
    ),
  );
  assert.equal(n, 1);
  await assert.rejects(
    readJsonBounded(Response.json({ a: "x".repeat(500) }), 100),
  );
});
test("Public bibliography resolves natural requests but blocks detected private queries", () => {
  assert.equal(
    libraryIntent("Pesquise artigos científicos sobre semicondutores").provider,
    "crossref",
  );
  assert.equal(
    libraryIntent("Busque livros sobre cinema").provider,
    "openlibrary",
  );
  assert.equal(libraryIntent("Pesquise artigos sobre meu paciente"), null);
});
test("Crossref sends a fixed bounded metadata query and returns DOI evidence", async () => {
  const r = await searchLibrary(
    "crossref",
    "semiconductors",
    undefined,
    async (u, o) => {
      assert.equal(u.origin, "https://api.crossref.org");
      assert.equal(u.searchParams.get("rows"), "4");
      assert.equal(o.method, "GET");
      return Response.json({
        message: {
          items: [
            {
              DOI: "10.1234/example",
              title: ["Semiconductors"],
              author: [{ given: "A", family: "B" }],
              published: { "date-parts": [[2025]] },
            },
          ],
        },
      });
    },
  );
  assert.equal(r[0].href, "https://doi.org/10.1234/example");
  assert.equal(r[0].year, "2025");
});
test("Open Library rejects arbitrary upstream links, caches and bounds its calls", async () => {
  let n = 0;
  const l = new PublicLibrary(async () => {
    n++;
    return Response.json({
      docs: [
        {
          key: "/works/OL123W",
          title: "Cinema",
          author_name: ["Autor"],
          first_publish_year: 2000,
        },
        { key: "https://private.invalid", title: "bad" },
      ],
    });
  });
  const a = await l.search("openlibrary", "cinema");
  await l.search("openlibrary", "cinema");
  assert.equal(n, 1);
  assert.equal(a.length, 1);
  assert.equal(a[0].href, "https://openlibrary.org/works/OL123W");
});
test("Mutations reject cross-site requests and oversized bodies before service execution", async () => {
  assert.equal(
    sameOrigin(
      new Request("https://jk.example/api", {
        headers: { origin: "https://evil.example" },
      }),
    ),
    false,
  );
  assert.equal(
    sameOrigin(
      new Request("https://jk.example/api", {
        headers: { origin: "https://jk.example" },
      }),
    ),
    true,
  );
  await assert.rejects(
    boundedBody(
      new Request("https://jk.example/api", {
        method: "POST",
        body: "x".repeat(200),
      }),
      100,
    ),
  );
  assert.deepEqual(
    await boundedBody(
      new Request("https://jk.example/api", {
        method: "POST",
        body: '{"ok":true}',
      }),
      100,
    ),
    { ok: true },
  );
});

test("Informative model questions never initiate a generation request", () => {
  for (const q of [
    "Quais modelos podem gerar imagem na Abacus?",
    "Como criar uma imagem?",
    "Explique como gerar uma locução",
  ])
    assert.equal(mediaIntent(q), null, q);
  assert.equal(
    mediaIntent("Quero que você crie uma imagem de uma nave"),
    "image",
  );
  assert.equal(mediaIntent("Jarvis, por favor, gere uma ilustração"), "image");
});
test("Generated base64 image becomes local File for HUD while preserving attributed scene", async () => {
  const { requestAbacus } = await load("lib/abacus/client.ts");
  const original = globalThis.fetch,
    files = [];
  const id = "generated-fixture";
  globalThis.fetch = async () =>
    Response.json({
      text: "Imagem criada.",
      model: "flux2",
      usage: null,
      generatedImageId: id,
      inlineAsset: "data:image/png;base64,YWJj",
      visual: {
        version: 1,
        id: "scene-image",
        title: "Imagem",
        mode: "creative",
        createdAt: new Date().toISOString(),
        source: { kind: "assistant", label: "Imagem sintética · Abacus" },
        modules: [
          {
            id: "generated-image",
            kind: "media",
            title: "Imagem criada",
            items: [
              {
                id: "generated",
                localId: id,
                label: "Imagem gerada por IA",
                type: "image",
              },
            ],
          },
        ],
      },
    });
  try {
    const r = await requestAbacus("Crie uma imagem", {
      signal: new AbortController().signal,
      onGeneratedMedia: (items) => files.push(...items),
    });
    assert.equal(files.length, 1);
    assert.equal(files[0].file.type, "image/png");
    assert.equal(await files[0].file.text(), "abc");
    assert.equal(r.visual.modules[0].items[0].localId, id);
  } finally {
    globalThis.fetch = original;
  }
});
