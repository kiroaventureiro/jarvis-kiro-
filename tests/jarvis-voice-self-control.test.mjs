import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source=readFileSync(new URL("../lib/voice/local-intents.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test("Jarvis understands spoken control instructions",()=>{
 assert.equal(exports.voiceAction("Jarvis, aumenta o volume"),"volume_up");
 assert.equal(exports.voiceAction("Jarvis, diminua o volume"),"volume_down");
 assert.equal(exports.voiceAction("coloque o teclado"),"keyboard");
 assert.equal(exports.voiceAction("vou inserir uma imagem"),"files");
 assert.equal(exports.voiceAction("pause a fala"),"pause");
 assert.equal(exports.voiceAction("bom dia"),"none");
});
test("Jarvis local commands update voice preference without changing system audio",()=>{
 const ui=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
 assert.match(ui,/saveVoicePreferences\(/);
 assert.match(ui,/audio\.current\.volume=next/);
 assert.match(ui,/const selfControl=selfControlReply\(text\)/);
});
