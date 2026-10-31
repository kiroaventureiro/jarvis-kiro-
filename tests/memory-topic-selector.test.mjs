import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../lib/memory/topic-selector.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);
const { selectMemoryTopics } = mod.exports;
const topics = [
  { id: "obs", title: "KIRO TV OBS", summary: "Transmissao automatica cenas e playlist", tags: ["OBS"] },
  { id: "serie", title: "Guardioes da Origem", summary: "Episodios personagens portal e fragmentos", tags: ["Kiro", "Luna"] },
  { id: "private", title: "KIRO TV", summary: "Segredo de producao", sensitive: true },
  { id: "irrelevant", title: "Financas", summary: "Planejamento mensal" },
];
test("finds relevant topic without returning unrelated context", () => {
  const result = selectMemoryTopics("Como estão as cenas do OBS?", topics);
  assert.equal(result[0].id, "obs");
  assert.equal(result.some(x => x.id === "irrelevant"), false);
});
test("never returns a topic flagged sensitive", () => {
  assert.equal(selectMemoryTopics("KIRO TV", topics).some(x => x.id === "private"), false);
});
test("limits both number of topics and summary length", () => {
  const result = selectMemoryTopics("KIRO", topics, { limit: 1, maxChars: 12 });
  assert.equal(result.length, 1);
  assert.ok(result[0].summary.length <= 12);
});
test("does not select anything on an empty or irrelevant query", () => {
  assert.deepEqual(selectMemoryTopics("", topics), []);
  assert.deepEqual(selectMemoryTopics("astronomia", topics), []);
});
test("handles duplicate IDs, invalid identifiers and deterministic ties", () => {
  const result = selectMemoryTopics("projeto", [
    { id: "b", title: "Projeto", summary: "B" },
    { id: "b", title: "Projeto", summary: "Duplicado" },
    { id: "../bad", title: "Projeto", summary: "Invalido" },
    { id: "a", title: "Projeto", summary: "A" },
  ]);
  assert.deepEqual(result.map(x => x.id), ["a", "b"]);
});
