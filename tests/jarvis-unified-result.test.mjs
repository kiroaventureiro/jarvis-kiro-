import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const src=readFileSync(new URL("../lib/orchestration/unified-result.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test("Unified Jarvis result does not claim execution or create fake files",()=>{
 const r=exports.codexDraftResult({id:"draft-1",state:"draft",repository:"kiroaventureiro/jarvis-kiro-",branch:"feature/diretor-tecnico-agent",kind:"review"});
 assert.equal(r.source,"codex");
 assert.equal(r.status,"draft");
 assert.equal(r.artifacts.length,0);
 assert.match(r.messages.join(" "),/nenhuma execução começou/);
 assert.equal(r.provenance.taskReference,"draft-1");
});
test("Codex API returns unified data without disguising drafts as completed",()=>{
 const api=readFileSync(new URL("../app/api/director/codex/route.ts",import.meta.url),"utf8");
 assert.match(api,/result: codexDraftResult\(saved\)/);
 assert.match(api,/queued:false, started:false/);
});
