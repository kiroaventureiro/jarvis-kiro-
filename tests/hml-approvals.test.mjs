import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('app/api/orchestration/hml/approvals/route.ts','utf8');
const compiled=ts.transpileModule(source.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const decision=()=>({approvalId:'test_approval',jobId:'test_job',planId:'test_plan',digest:'a'.repeat(64),capability:'simulation.success',decision:'approve',expiresAt:new Date(Date.now()+300000).toISOString()});
async function invoke({auth=true,origin='https://jarvis.example',body=decision(),key='b'.repeat(40),receiptPatch={},rawReceipt}={}){
 const exports={},calls=[];
 const receipt={...body,environment:'homologation',persisted:true,decisionRecorded:true,decisionCurrent:true,executorMode:'mock_only',realExecutorAuthorized:false,externalActionPerformed:false,jobState:'pending',decisionStatus:'recorded',...receiptPatch};
 const fetch=async(...args)=>{calls.push(args);return new Response(rawReceipt??JSON.stringify(receipt),{status:201});};
 new Function('exports','NextResponse','authorized','fetch','process',compiled)(exports,{json:(data,options)=>Response.json(data,options)},async()=>auth,fetch,{env:{JARVIS_HML_APPROVAL_KEY:key,JARVIS_HML_INGRESS_KEY:'c'.repeat(40)}});
 const response=await exports.POST(new Request('https://jarvis.example/api/orchestration/hml/approvals',{method:'POST',headers:{origin},body:JSON.stringify(body)}));
 return {response,data:await response.json(),calls};
}
test('approval requires owner session and same origin',async()=>{
 for(const options of [{auth:false},{origin:'https://elsewhere.example'}]){const r=await invoke(options);assert.ok([401,403].includes(r.response.status));assert.equal(r.calls.length,0);}
});
test('approval rejects real capabilities, injected identities, expired decisions and shared keys',async()=>{
 for(const body of [{...decision(),capability:'github.write'},{...decision(),authenticatedAuthority:'attacker'},{...decision(),expiresAt:'2000-01-01T00:00:00Z'}]){const r=await invoke({body});assert.equal(r.response.status,400);assert.equal(r.calls.length,0);}
 assert.equal((await invoke({key:'c'.repeat(40)})).response.status,503);
});
test('approval uses fixed n8n endpoint and server-only distinct key',async()=>{
 const r=await invoke();assert.equal(r.response.status,200);assert.equal(r.data.decisionRecorded,true);
 assert.equal(r.calls[0][0],'https://n8n.guardioesdaorigem.com.br/webhook/jk-hml/v1/approvals');
 assert.equal(r.calls[0][1].headers['X-Jarvis-Approval-Key'],'b'.repeat(40));
 assert.equal(JSON.parse(r.calls[0][1].body).environment,'homologation');
 assert.ok(!JSON.stringify(r.data).includes('b'.repeat(40)));
});
test('approval rejects mismatched, superseded and malformed receipts',async()=>{
 for(const receiptPatch of [{jobId:'different'},{realExecutorAuthorized:true},{decisionCurrent:false},{persisted:false}]){const r=await invoke({receiptPatch});assert.equal(r.response.status,502);assert.equal(r.data.decisionRecorded,false);}
 assert.equal((await invoke({rawReceipt:'<html>login</html>'})).response.status,502);
});
