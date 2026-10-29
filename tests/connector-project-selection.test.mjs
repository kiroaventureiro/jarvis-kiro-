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

const { conversationalConnectorRead } = await load(
  "lib/connectors/conversation-core.ts",
);
const { requestedProject, selectProjectResources } = await load(
  "lib/connectors/project-selection.ts",
);
const { normalizeScene } = await load("lib/holo/validation.ts");
const r = (id, name, kiroProject) => ({ id, name, kiroProject });
const unrelated = [
  r("jk", "Jarvis Kiro", "jarvis-kiro"),
  r("origem", "Sistema Origem", "universo-kiro"),
];
function fixture(connections) {
  const calls = [];
  return {
    calls,
    dependencies: {
      connectorStore: {
        configured: () => true,
        read: async () => ({ connections }),
      },
      connectors: {
        readAuthorized: async (provider, resource, op) => {
          calls.push({ provider, resource, op });
          return {
            data:
              provider === "vercel"
                ? [{ state: "READY" }, { state: "ERROR" }]
                : {
                    defaultBranch: "main",
                    description: "Descrição verificada",
                  },
          };
        },
      },
    },
  };
}
const connection = (resources) => ({
  status: "connected",
  grants: ["read"],
  resources,
});
test("Kiro Gestão outside scope never falls back to Jarvis or Origem in any provider", async () => {
  const f = fixture({
    github: connection(unrelated),
    vercel: connection(unrelated),
  });
  const reply = await conversationalConnectorRead(
    "Consulte especificamente Kiro Gestão no GitHub e na Vercel",
    f.dependencies,
  );
  assert.equal(f.calls.length, 0);
  assert.match(reply.text, /não está autorizado/);
  assert.ok(!reply.text.includes("Entre os projetos verificados"));
  assert.ok(normalizeScene(reply.visual));
});
test("spoken Quirogestão alias also fails closed without a matching binding", async () => {
  const f = fixture({ vercel: connection(unrelated) });
  await conversationalConnectorRead(
    "Verifique Quirogestão na Vercel",
    f.dependencies,
  );
  assert.equal(f.calls.length, 0);
});
test("same canonical project uses provider-specific resource names only within its binding", async () => {
  const f = fixture({
    github: connection([
      ...unrelated,
      r("repo-gestao", "owner/painel-administrativo", "kiro-gestao"),
    ]),
    vercel: connection([
      ...unrelated,
      r("prj-gestao", "gestao-preview", "kiro-gestao"),
    ]),
  });
  const reply = await conversationalConnectorRead(
    "Analise o Kiro Gestão no GitHub e na Vercel",
    f.dependencies,
  );
  assert.deepEqual(
    f.calls.map((x) => x.resource),
    ["repo-gestao", "prj-gestao"],
  );
  assert.match(reply.text, /1 prontos e 1 com erro/);
  assert.match(reply.text, /Não foram examinados arquivos nem testes/);
});
test("a provider without the requested resource is skipped while the matching provider is read", async () => {
  const f = fixture({
    github: connection(unrelated),
    vercel: connection([r("gestao", "Gestão", "kiro-gestao"), ...unrelated]),
  });
  await conversationalConnectorRead(
    "Verifique KiroGestão no GitHub e Vercel",
    f.dependencies,
  );
  assert.deepEqual(
    f.calls.map((x) => x.resource),
    ["gestao"],
  );
});
test("generic resource names cannot accidentally match a requested project", () => {
  const s = requestedProject("Consulte Guardiões da Origem", unrelated);
  assert.deepEqual(
    selectProjectResources(s, [
      r("other", "Site Sistema Origem"),
      r("jk", "Jarvis Kiro"),
    ]),
    [],
  );
});
test("explicit target wins over a broad qualifier without broadening scope", async () => {
  const f = fixture({
    github: connection([...unrelated, r("g", "Kiro Gestão", "kiro-gestao")]),
  });
  await conversationalConnectorRead(
    "Consulte todos os dados do Kiro Gestão no GitHub",
    f.dependencies,
  );
  assert.deepEqual(
    f.calls.map((x) => x.resource),
    ["g"],
  );
});
test("all projects in GitHub does not silently add Vercel or Supabase", async () => {
  const f = fixture({
    github: connection(unrelated),
    vercel: connection(unrelated),
  });
  await conversationalConnectorRead(
    "Liste todos os meus projetos no GitHub",
    f.dependencies,
  );
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls.every((x) => x.provider === "github"));
});
test("unknown and multiple named projects require clarification without external reads", async () => {
  const f = fixture({ github: connection(unrelated) });
  await conversationalConnectorRead(
    "Consulte especificamente Projeto Inexistente no GitHub",
    f.dependencies,
  );
  assert.equal(f.calls.length, 0);
  await conversationalConnectorRead(
    "Analise Kiro Gestão e Código Zero no GitHub",
    f.dependencies,
  );
  assert.equal(f.calls.length, 0);
});
test("missing read permission and disconnected accounts cannot produce verified results", async () => {
  const f = fixture({
    github: {
      ...connection([r("g", "Kiro Gestão", "kiro-gestao")]),
      grants: [],
    },
    vercel: {
      ...connection([r("g", "Kiro Gestão", "kiro-gestao")]),
      status: "disconnected",
    },
  });
  const reply = await conversationalConnectorRead(
    "Consulte Kiro Gestão no GitHub e Vercel",
    f.dependencies,
  );
  assert.equal(f.calls.length, 0);
  assert.match(reply.visual.modules[0].body, /não autorizada|sem conexão/);
});

test("provider-only GitHub navigation discovers authorized projects without guessing name",async()=>{
  const mock=fixture({github:connection([r("kiroaventureiro/jarvis-kiro-","kiroaventureiro/jarvis-kiro-")])});
  const result=await conversationalConnectorRead("Jarvis, entre no GitHub",mock.dependencies);
  assert.ok(result?.text.includes("consulta de leitura"),result?.text);
  assert.equal(mock.calls[0]?.provider,"github");
  assert.equal(mock.calls[0]?.op,"repo");
});
test("provider-only Vercel query runs connected deployment read",async()=>{
  const mock=fixture({vercel:connection([r("vercel-project-id","jarvis-kiro")])});
  const result=await conversationalConnectorRead("Abra a Vercel e verifique",mock.dependencies);
  assert.ok(result?.text.includes("consulta de leitura"),result?.text);
  assert.equal(mock.calls[0]?.op,"deployments");
});

test("shared project resolver understands service mention without fixed phrasing",()=>{
  for(const phrase of ["Entra no GitHub e dá uma olhada","Quero olhar a Vercel","O que tem no Supabase?"]) {
    assert.equal(requestedProject(phrase,unrelated).kind,"all",phrase);
  }
  assert.equal(requestedProject("Verifique o projeto Jarvis Kiro no GitHub",unrelated).kind,"target");
});
