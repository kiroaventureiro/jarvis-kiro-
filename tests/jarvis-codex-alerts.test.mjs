import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source=readFileSync(new URL("../lib/alerts/contract.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const task={id:"123e4567-e89b-12d3-a456-426614174000",updatedAt:"2026-10-29T08:00:00Z"};
test("Codex alerts use verified state and never announce a draft as finished",()=>{
 assert.equal(exports.codexTaskAlert({...task,state:"draft"}),null);
 assert.equal(exports.codexTaskAlert({...task,state:"running"}).visual,"activity");
 assert.equal(exports.codexTaskAlert({...task,state:"completed"}).visual,"success");
 assert.equal(exports.codexTaskAlert({...task,state:"failed"}).visual,"error");
 assert.equal(exports.codexTaskAlert({...task,state:"invented"}),null);
});
test("Authenticated Codex task status includes its lifecycle notification",()=>{
 const route=readFileSync(new URL("../app/api/director/codex/tasks/[id]/route.ts",import.meta.url),"utf8");
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/alert:codexTaskAlert\(task\)/);
});
