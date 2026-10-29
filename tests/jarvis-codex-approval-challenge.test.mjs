import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../lib/codex/approval-challenge.ts",import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test("Codex approval must be scoped, fresh and non-executing",()=>{
 const now=100000;
 const record={id:"123e4567-e89b-12d3-a456-426614174000",repository:"kiroaventureiro/jarvis-kiro-",branch:"feature/diretor-tecnico-agent",kind:"review",state:"draft"};
 const challenge={taskId:record.id,repository:record.repository,branch:record.branch,action:"review",nonce:"a".repeat(32),expiresAt:now+60000};
 assert.equal(exports.validateCodexApprovalChallenge(challenge,record,now),true);
 assert.equal(exports.validateCodexApprovalChallenge({...challenge,branch:"main"},record,now),false);
 assert.equal(exports.validateCodexApprovalChallenge({...challenge,expiresAt:now-1},record,now),false);
 assert.equal(exports.validateCodexApprovalChallenge(challenge,{...record,state:"running"},now),false);
 assert.equal(exports.CODEX_APPROVAL_RULES.allowsImmediateExecution,false);
});
