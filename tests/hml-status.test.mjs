import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('app/api/orchestration/hml/status/route.ts','utf8').replace(/^import .*;\r?\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const reference={jobId:'job_test',planId:'plan_test',digest:'a'.repeat(64)};
async function invoke({auth=true,origin='https://jarvis.example',body=reference,patch={},key='x'.repeat(40)}={}){
 const exports={},calls=[];
 const receipt={...reference,found:true,environment:'homologation',jobState:'succeeded',result:{resultRef:'simulated:success:v1:job_test:attempt_test',resultDigest:'b'.repeat(64),simulated:true},...patch};
 new Function('exports','NextResponse','authorized','fetch','process',code)(exports,{json:(v,o)=>Response.json(v,o)},async()=>auth,async(...a)=>{calls.push(a);return Response.json(receipt);},{env:{JARVIS_HML_INGRESS_KEY:key}});
 const response=await exports.POST(new Request('https://jarvis.example/api/orchestration/hml/status',{method:'POST',headers:{origin},body:JSON.stringify(body)}));
 return {response,data:await response.json(),calls};
}
test('status requires owner and same origin',async()=>{
 for(const args of [{auth:false},{origin:'https://other.example'}]){const r=await invoke(args);assert.ok([401,403].includes(r.response.status));assert.equal(r.calls.length,0);}
});
test('status rejects arbitrary references and missing transport key',async()=>{
 assert.equal((await invoke({body:{...reference,authenticatedOrigin:'other'}})).response.status,400);
 assert.equal((await invoke({key:''})).response.status,503);
});
test('status returns only bound simulation data with server-only credentials',async()=>{
 const r=await invoke();assert.equal(r.response.status,200);assert.equal(r.data.result.simulated,true);
 assert.equal(r.calls[0][1].headers['X-Jarvis-Key'],'x'.repeat(40));assert.ok(!JSON.stringify(r.data).includes('x'.repeat(40)));
});
test('status cannot substitute another task, environment or real result',async()=>{
 for(const patch of [{jobId:'other'},{environment:'production'},{jobState:'invented'},{result:{resultRef:'private',resultDigest:'b'.repeat(64),simulated:false}}])assert.equal((await invoke({patch})).response.status,502);
 assert.equal((await invoke({patch:{found:false}})).response.status,404);
});
