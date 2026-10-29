import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../lib/orchestration/result-view.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test("Jarvis UI view labels task statuses accurately and preserves genuine text",()=>{
 const view=exports.jarvisResultView({requestId:"r1",source:"codex",status:"draft",messages:["Aguardando executor"],artifacts:[]});
 assert.equal(view.statusLabel,"Rascunho");
 assert.equal(view.title,"Codex");
 assert.equal(view.messages[0],"Aguardando executor");
});
test("Jarvis view rejects non-HTTPS media URLs",()=>{
 const view=exports.jarvisResultView({requestId:"r2",source:"image",status:"completed",messages:[],artifacts:[
 {type:"image",name:"Foto",mimeType:"image/png",storageKey:"safe",previewUrl:"javascript:alert(1)"}
 ]});
 assert.equal(view.artifacts[0].previewUrl,undefined);
});
