import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../lib/codex/chat-intent.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test("Codex drafts require explicit task staging request",()=>{
 assert.equal(exports.codexDraftIntent("olá Codex"),null);
 assert.equal(exports.codexDraftIntent("Codex, já executou?"),null);
 assert.equal(exports.codexDraftIntent("peça ao codex para revisar este repositório")?.kind,"review");
 assert.equal(exports.codexDraftIntent("prepare uma tarefa para o codex testar a interface")?.kind,"test");
});
test("Draft interaction never claims remote executor started",()=>{
 const ui=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
 assert.match(ui,/fetch\("\/api\/director\/codex"/);
 assert.match(ui,/data\.started!==false/);
 assert.match(ui,/data\.queued!==false/);
 assert.match(ui,/await conversationalCodexDraft\(spoken\)/);
});
