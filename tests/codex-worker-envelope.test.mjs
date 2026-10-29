import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import crypto from "node:crypto";
const source=readFileSync(new URL("../lib/codex/worker-envelope.ts", import.meta.url),"utf8");
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,Buffer,require:(id)=>{assert.equal(id,"node:crypto");return crypto;}
});
const plan={status:"awaiting_worker_and_approval",kind:"review",repository:"kiroaventureiro/jarvis-kiro-",baseBranch:"feature/diretor-tecnico-agent",task:"Revisar testes",requiresApproval:true,productionAllowed:false,executionStarted:false};
test("Codex envelope signature validates only unexpired unchanged drafts",()=>{
  const now=Date.now();
  const envelope={version:1,issuedAt:now,expiresAt:now+60000,nonce:"randomUniqueNonce1234",plan};
  const secret="test-secret-value-at-least-32-characters";
  const signature=exports.signCodexEnvelope(envelope,secret);
  assert.equal(exports.verifyCodexEnvelope(envelope,signature,secret,now),true);
  assert.equal(exports.verifyCodexEnvelope({...envelope,plan:{...plan,task:"outro"}},signature,secret,now),false);
  assert.equal(exports.verifyCodexEnvelope(envelope,signature,secret,now+61000),false);
  assert.equal(exports.verifyCodexEnvelope(envelope,"0".repeat(64),secret,now),false);
  assert.equal(exports.verifyCodexEnvelope({...envelope,plan:{...plan,productionAllowed:true}},signature,secret,now),false);
});
