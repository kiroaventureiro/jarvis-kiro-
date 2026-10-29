import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const code=readFileSync(new URL("../lib/codex/sdk-preflight.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test("SDK preflight reports blockers without claiming execution",()=>{
 const unavailable={authenticationVerified:false,isolatedCheckoutVerified:false,durableQueueVerified:false,resultChannelVerified:false,vaultVerified:false,paidExecutionApproved:false};
 const result=exports.codexSdkPreflight(unavailable);
 assert.equal(result.ready,false);
 assert.equal(result.blockers.length,6);
 assert.equal(exports.codexSdkPreflight(Object.fromEntries(Object.keys(unavailable).map(key=>[key,true]))).ready,false);
 assert.deepEqual(Array.from(exports.codexSdkPreflight(Object.fromEntries(Object.keys(unavailable).map(key=>[key,true]))).blockers),["sdk_adapter_not_implemented"]);
});
