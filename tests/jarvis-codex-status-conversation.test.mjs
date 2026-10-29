import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const src=readFileSync(new URL("../lib/codex/status-intent.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test("Only explicit Codex status queries with full UUID can read task",()=>{
 const id="123e4567-e89b-12d3-a456-426614174000";
 assert.equal(exports.codexStatusIntent("Qual o status da tarefa Codex "+id+"?"),id);
 assert.equal(exports.codexStatusIntent("Execute a tarefa "+id),null);
 assert.equal(exports.codexStatusIntent("status do Codex"),null);
});
test("Chat and voice use authenticated read-only task endpoint",()=>{
 const ui=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
 assert.match(ui,/fetch\("\/api\/director\/codex\/tasks\/"/);
 assert.match(ui,/await conversationalCodexStatus\(spoken\)/);
 assert.match(ui,/await conversationalCodexStatus\(text\)/);
});
