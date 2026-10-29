import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("../lib/codex/conversation.ts", import.meta.url), "utf8");
const plannerSource = readFileSync(new URL("../lib/codex/delegation-plan.ts", import.meta.url), "utf8");
const planner = {};
vm.runInNewContext(ts.transpileModule(plannerSource, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports:planner});
const mod = {};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:mod, require:(id)=>{assert.equal(id,"./delegation-plan");return planner;}
});
test("Conversational Codex planning is opt-in and honest",()=>{
  assert.equal(mod.answerCodexPlanning("Olá Jarvis"),null);
  assert.equal(mod.answerCodexPlanning("Codex funciona?"),null);
  const result=mod.answerCodexPlanning("Peça ao Codex revisar a segurança do Jarvis");
  assert.equal(result.codexPlan.kind,"review");
  assert.equal(result.codexPlan.executionStarted,false);
  assert.equal(result.codexPlan.requiresApproval,true);
  assert.match(result.text,/Ainda não o enviei/);
  assert.equal(result.codexPlan.baseBranch,"feature/diretor-tecnico-agent");
});
test("Conversational planning is wired to existing chat and research routes",()=>{
  const chat=readFileSync(new URL("../app/api/director/abacus/route.ts",import.meta.url),"utf8");
  const research=readFileSync(new URL("../app/api/director/research/route.ts",import.meta.url),"utf8");
  assert.match(chat,/answerCodexPlanning\(message\)/);
  assert.match(research,/answerCodexPlanning\(body\.query\)/);
});
