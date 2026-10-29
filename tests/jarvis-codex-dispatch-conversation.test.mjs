import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../lib/codex/dispatch-response.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test("Dispatch preflight never invents successful execution",()=>{
 const result=exports.describeCodexDispatchResponse(503,{started:false,queued:false});
 assert.equal(result.started,false);
 assert.equal(result.queued,false);
 assert.match(result.message,/não está conectado/);
 assert.equal(exports.describeCodexDispatchResponse(200,{started:true,queued:true}).started,false);
});
test("Jarvis checks dispatch only after a confirmed approval",()=>{
 const ui=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
 assert.match(ui,/data\.task\?\.state!=="approved"/);
 assert.match(ui,/fetch\("\/api\/director\/codex\/dispatch"/);
 assert.match(ui,/describeCodexDispatchResponse\(dispatch\.status,dispatchData\)/);
});
