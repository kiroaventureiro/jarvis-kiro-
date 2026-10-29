import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import crypto from "node:crypto";
const load=(path,requireFn)=>{
  const source=readFileSync(new URL(path,import.meta.url),"utf8");
  const exports={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,Buffer,Date,require:requireFn});
  return exports;
};
const envelopeMod=load("../lib/codex/worker-envelope.ts", id=>{assert.equal(id,"node:crypto");return crypto;});
const accept=load("../lib/codex/worker-acceptance.ts", id=>{assert.equal(id,"./worker-envelope");return envelopeMod;}).acceptCodexWorkerEnvelope;
const secret="test-worker-secret-stronger-than-32-characters";
const plan={status:"awaiting_worker_and_approval",kind:"review",repository:"kiroaventureiro/jarvis-kiro-",baseBranch:"feature/diretor-tecnico-agent",task:"Revisar testes",requiresApproval:true,productionAllowed:false,executionStarted:false};
test("Codex worker gate requires approval, checks signatures and rejects replay",async()=>{
  const now=Date.now(), envelope={version:1,issuedAt:now,expiresAt:now+60_000,nonce:"uniqueNonceTest999999",plan};
  const signature=envelopeMod.signCodexEnvelope(envelope,secret),used=new Set();
  const claimNonce=async(nonce)=>{if(used.has(nonce))return false;used.add(nonce);return true;};
  const args={envelope,signature,secret,now,claimNonce,approvalVerified:false};
  assert.equal((await accept(args)).reason,"approval_required");
  assert.equal(used.size,0);
  assert.equal((await accept({...args,approvalVerified:true})).accepted,true);
  assert.equal((await accept({...args,approvalVerified:true})).reason,"replayed_or_store_unavailable");
  assert.equal((await accept({...args,signature:"0".repeat(64),approvalVerified:true})).accepted,false);
});
test("Codex worker gate fails closed on store outage",async()=>{
  const now=Date.now(),envelope={version:1,issuedAt:now,expiresAt:now+60_000,nonce:"uniqueNonceTest888888",plan};
  const signature=envelopeMod.signCodexEnvelope(envelope,secret);
  const result=await accept({envelope,signature,secret,now,approvalVerified:true,claimNonce:async()=>{throw Error("db unavailable");}});
  assert.equal(result.accepted,false);
  assert.equal(result.reason,"replayed_or_store_unavailable");
});
