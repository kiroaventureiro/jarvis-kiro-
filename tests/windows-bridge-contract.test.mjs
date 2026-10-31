import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = fs.readFileSync("lib/voice/windows-bridge-contract.ts", "utf8");
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports = {};
vm.runInNewContext(js,{exports});
const {parseVoiceJob,voiceJobResult,OFFICIAL_PROFILE_ID} = exports;
const now=1793460000000;
const base={id:"voice_request_123456",kind:"synthesize",profileId:OFFICIAL_PROFILE_ID,text:"Olá, estou aqui.",expiresAt:now+60000};
test("accepts bounded official voice job",()=>{
  assert.equal(parseVoiceJob(base,now).profileId,"af5bbbba");
  assert.equal(voiceJobResult(parseVoiceJob(base,now),1000).status,"completed");
});
test("rejects expired, forged, malformed and oversize jobs",()=>{
  for(const bad of [
    {...base,expiresAt:now-1}, {...base,expiresAt:now+600001},
    {...base,profileId:"334728d0"}, {...base,text:"x".repeat(351)},
    {...base,id:"../request"}, {...base,kind:"delete"}, null,[],
  ]) assert.equal(parseVoiceJob(bad,now),null);
});
test("refuses invalid generated audio length",()=>{
  assert.throws(()=>voiceJobResult(parseVoiceJob(base,now),3),/INVALID_AUDIO/);
});
