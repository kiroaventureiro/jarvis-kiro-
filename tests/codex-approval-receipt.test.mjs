import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import crypto from "node:crypto";
const src=readFileSync(new URL("../lib/codex/approval-receipt.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports,Buffer,Date,Number,require:(id)=>{assert.equal(id,"node:crypto");return crypto;}
});
test("Codex approvals must be signed, scoped, and unexpired",()=>{
 const now=Date.now(),secret="secret-that-is-at-least-32-characters-long";
 const receipt={version:1,taskId:"123e4567-e89b-12d3-a456-426614174000",repository:"kiroaventureiro/jarvis-kiro-",branch:"feature/diretor-tecnico-agent",approvedAt:now,expiresAt:now+60000};
 const sig=exports.signCodexApproval(receipt,secret,now);
 assert.equal(exports.verifyCodexApproval(receipt,sig,secret,now),true);
 assert.equal(exports.verifyCodexApproval({...receipt,branch:"main"},sig,secret,now),false);
 assert.equal(exports.verifyCodexApproval(receipt,sig,secret,now+60001),false);
 assert.equal(exports.verifyCodexApproval({...receipt,taskId:"123e4567-e89b-12d3-a456-426614174001"},sig,secret,now),false);
 assert.equal(exports.verifyCodexApproval(receipt,"0".repeat(64),secret,now),false);
});
