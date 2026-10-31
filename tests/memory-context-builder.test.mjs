import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const load = (path) => {
  const src = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", js)(module, module.exports, (name) =>
    name === "./topic-selector" ? selector : require(name));
  return module.exports;
};
const selector = load("../lib/memory/topic-selector.ts");
const { buildMemoryContext } = load("../lib/memory/context-builder.ts");

const topics = [
  { id: "obs", title: "OBS TV", summary: "Cenas e transmissao da Kiro TV", tags: ["obs"] },
  { id: "personagens", title: "Guardiões da Origem", summary: "Kiro Luna Zeca e o portal" },
  { id: "segredo", title: "OBS", summary: "Chave confidencial", sensitive: true },
];
test("returns topic-specific context and excludes sensitive entries", () => {
  const out = buildMemoryContext("Quais cenas do OBS?", topics);
  assert.deepEqual(out.topicIds, ["obs"]);
  assert.match(out.context, /transmissao/);
  assert.doesNotMatch(out.context, /confidencial/);
});
test("honors total context budget", () => {
  const out = buildMemoryContext("OBS", topics, 40);
  assert.ok(out.usedCharacters <= 40);
  assert.equal(out.context.length, out.usedCharacters);
});
test("empty or invalid budgets produce no context", () => {
  assert.deepEqual(buildMemoryContext("OBS", topics, Number.NaN).topicIds, []);
  assert.equal(buildMemoryContext("OBS", topics, 0).context, "");
  assert.equal(buildMemoryContext("assunto ausente", topics).context, "");
});
