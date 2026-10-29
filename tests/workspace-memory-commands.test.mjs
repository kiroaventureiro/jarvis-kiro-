import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/workspace/conversation.ts", import.meta.url), "utf8");
function regexAfter(name) {
  const pattern = source.match(new RegExp("const " + name + " = (/\\^.+?/i)\\.exec\\(message\\.trim\\(\\)\\)"));
  assert.ok(pattern, name + " regex exists");
  return Function("return " + pattern[1])();
}
test("checkpoint command accepts spoken PT-BR structure", () => {
  const r = regexAfter("checkpoint");
  assert.ok(r.test("Jarvis, atualize a proxima etapa do projeto Guardiões da Origem: testar Abacus"));
  assert.ok(r.test("atualize o proximo passo no projeto Jarvis Kiro: verificar agente"));
});
test("Abacus task reference recognizes spacing and exact project name", () => {
  const r = regexAfter("attach");
  assert.ok(r.test("Jarvis, vincule a tarefa Abacus AB123 ao projeto Guardiões da Origem"));
});
