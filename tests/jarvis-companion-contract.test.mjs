import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const code=readFileSync(new URL("../lib/companion/contract.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test("Windows companion actions require explicit approval and freshness",()=>{
 const now=1000000;
 const req={requestId:"validDesktopRequest01",capability:"save_download",userApproved:true,issuedAt:now,expiresAt:now+30000,payload:{}};
 assert.equal(exports.validateCompanionRequest(req,now),true);
 assert.equal(exports.validateCompanionRequest({...req,userApproved:false},now),false);
 assert.equal(exports.validateCompanionRequest({...req,expiresAt:now-1},now),false);
 assert.equal(exports.validateCompanionRequest({...req,capability:"shell"},now),false);
 assert.equal(exports.companionStatus.desktopConnected,false);
});
