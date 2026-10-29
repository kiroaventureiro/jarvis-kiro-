import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../lib/orchestration/capability-intent.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test("Capability questions stay separate from requests to execute actions",()=>{
 assert.equal(exports.capabilityQuestion("Jarvis, o Codex está conectado?"),"codex");
 assert.equal(exports.capabilityQuestion("Navi está funcionando?"),"navi");
 assert.equal(exports.capabilityQuestion("O aplicativo do computador está disponível?"),"companion");
 assert.equal(exports.capabilityQuestion("Codex, programe meu site"),null);
});
test("Both chat and voice check authenticated capabilities without inventing execution",()=>{
 const ui=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
 assert.match(ui,/fetch\("\/api\/director\/capabilities"/);
 assert.match(ui,/await conversationalCapabilityReply\(spoken\)/);
 assert.match(ui,/await conversationalCapabilityReply\(text\)/);
 assert.match(ui,/Não iniciei nenhuma execução/);
});
