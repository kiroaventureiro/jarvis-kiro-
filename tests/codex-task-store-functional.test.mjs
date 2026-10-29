import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import crypto from "node:crypto";

const transpile = (path, requireFn) => {
  const src=readFileSync(new URL(path,import.meta.url),"utf8").replace(/^import "server-only";\s*/,"");
  const out={};
  vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports:out,require:requireFn,Date,Object,Number});
  return out;
};
const lifecycle=transpile("../lib/codex/task-lifecycle.ts",()=>{throw Error("unexpected import");});
const state={audit:[],plans:[],oauth:{},connections:{}};
const vault={
  update:async fn=>structuredClone(fn(state)),
  read:async()=>structuredClone(state),
};
const taskStore=transpile("../lib/codex/task-store.ts",id=>{
  if(id==="node:crypto") return crypto;
  if(id==="../connectors/server")return {connectorStore:vault};
  if(id==="./task-lifecycle")return lifecycle;
  throw Error("Unexpected module "+id);
});
test("Codex draft persists its actual instruction and survives a separate read",async()=>{
  const record=await taskStore.createCodexTask({
    repository:"kiroaventureiro/jarvis-kiro-",
    branch:"feature/diretor-tecnico-agent",
    kind:"review",
    instruction:"  Revisar testes de integração  ",
  });
  assert.equal(record.state,"draft");
  assert.equal(record.kind,"review");
  assert.equal(record.instruction,"Revisar testes de integração");
  const loaded=await taskStore.getCodexTask(record.id);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded)),JSON.parse(JSON.stringify(record)));
  await assert.rejects(taskStore.updateCodexTask(record.id,"running",{}),/INVALID_TRANSITION/);
  const approved=await taskStore.updateCodexTask(record.id,"approved",{approvalVerified:true});
  assert.equal(approved.state,"approved");
  assert.equal((await taskStore.getCodexTask(record.id)).state,"approved");
});
test("Codex drafts refuse unsafe scope or invalid instructions",async()=>{
  await assert.rejects(taskStore.createCodexTask({repository:"kiroaventureiro/jarvis-kiro-",branch:"main",kind:"review",instruction:"check"}),/INVALID_SCOPE/);
  await assert.rejects(taskStore.createCodexTask({repository:"kiroaventureiro/jarvis-kiro-",branch:"feature/test",kind:"review",instruction:" "}),/INVALID_TASK/);
});
