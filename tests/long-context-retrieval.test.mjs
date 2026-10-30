import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("lib/cognitive/long-context-retrieval.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { rankContextFragments } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const fragments = [
  { id: "a", project: "Jarvis", source: "notes", content: "microfone audio assistente" },
  { id: "b", project: "Kiro TV", source: "notes", content: "video programacao" },
  { id: "a", project: "Jarvis", source: "duplicate", content: "microfone audio repetido" },
];

test("project isolation, deduplication and provenance", () => {
  const result = rankContextFragments("microfone", fragments, { project: "Jarvis" });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "a");
  assert.equal(result[0].source, "notes");
});
test("empty query does not leak context", () => {
  assert.deepEqual(rankContextFragments("a de", fragments), []);
});
test("strict character budget, including small budgets", () => {
  const result = rankContextFragments("microfone", fragments, { maxChars: 4 });
  assert.equal(result.length, 1);
  assert.equal(result[0].content.length, 4);
});
test("late keywords in long fragments remain retrievable", () => {
  const long = Array.from({ length: 90 }, (_, i) => "term" + i).join(" ") + " cristalizador";
  assert.equal(rankContextFragments("cristalizador", [{ id: "x", project: "Jarvis", source: "document", content: long }]).length, 1);
});
test("accent insensitive retrieval", () => {
  assert.equal(rankContextFragments("programação", fragments).length, 1);
});
