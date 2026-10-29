import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {renderToStaticMarkup}=require("react-dom/server");
const viewSource=readFileSync(new URL("../lib/orchestration/result-view.ts",import.meta.url),"utf8");
const viewExports={};
vm.runInNewContext(ts.transpileModule(viewSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:viewExports});
const panelSource=readFileSync(new URL("../components/jarvis-result-panel.tsx",import.meta.url),"utf8");
const panelExports={};
vm.runInNewContext(ts.transpileModule(panelSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
  exports:panelExports,require:(id)=>{
    if(id==="react/jsx-runtime")return require(id);
    if(id==="../lib/orchestration/result-view")return viewExports;
    throw Error("Unexpected import: "+id);
  }
});
test("Jarvis result panel renders actual accessible markup for a verified Codex draft",()=>{
 const result={requestId:"r-test",source:"codex",status:"draft",
  messages:["Codex não executou esta tarefa."],artifacts:[]};
 const html=renderToStaticMarkup(require("react").createElement(panelExports.JarvisResultPanel,{result}));
 assert.match(html,/Resultado Codex/);
 assert.match(html,/data-result-status="draft"/);
 assert.match(html,/Rascunho/);
 assert.match(html,/Codex não executou esta tarefa/);
});
test("Jarvis result panel escapes untrusted text and refuses dangerous file URLs",()=>{
 const result={requestId:"r-image",source:"image",status:"completed",
  messages:['<script>alert("x")</script>'],
  artifacts:[{type:"image",name:"arquivo",mimeType:"image/png",storageKey:"file-1",previewUrl:"javascript:alert(1)"}]};
 const html=renderToStaticMarkup(require("react").createElement(panelExports.JarvisResultPanel,{result}));
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/Prévia indisponível/);
 assert.doesNotMatch(html,/href=/);
});
