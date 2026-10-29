import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const code=readFileSync(new URL("../lib/downloads/conversation.ts",import.meta.url),"utf8");
const exp={};vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exp});
test("A yes or no only authorizes a download with pending file",()=>{
 assert.equal(exp.conversationalDownloadIntent("sim",false),"other");
 assert.equal(exp.conversationalDownloadIntent("sim",true),"accept");
 assert.equal(exp.conversationalDownloadIntent("não",true),"decline");
 assert.equal(exp.conversationalDownloadIntent("baixe a imagem",true),"request");
 assert.equal(exp.conversationalDownloadIntent("explique a imagem",true),"other");
});
