import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('lib/n8n/discovery.ts','utf8').replace('import "server-only";','');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function runtime(env={},response=Response.json({found:false},{status:404}),admin={connected:false}) {
  const exports={},calls=[];
  new Function('exports','process','fetch','require',code)(exports,{env},async(...args)=>{calls.push(args);return response;},(name)=>name==='./workflow-details'?{requestedWorkflowDetails:()=>null}:{n8nStatus:async()=>admin,listN8nWorkflows:async()=>({workflows:[{name:'Fluxo real',active:true}]})});
  return {api:exports,calls};
}
const env={JARVIS_HML_INGRESS_KEY:'x'.repeat(40),JARVIS_HML_INGRESS_URL:'https://n8n.guardioesdaorigem.com.br/webhook/jk-hml/v1/commands'};
test('recognizes typed and spoken n8n without intercepting unrelated requests',()=>{
 const {api}=runtime();
 for(const q of ['Você está conectado ao n8n?','Consulte N 8 N','Conexão M8M'])assert.equal(api.n8nIntent(q),true);
 assert.equal(api.n8nIntent('Consulte meu GitHub'),false);
});
test('conversation distinguishes HML transport from actual administrative discovery',async()=>{
 const hml=await runtime(env).api.answerN8nRequest('n8n conectado?');
 assert.match(hml.text,/Confirmei agora/);assert.match(hml.text,/ainda não está conectado/);
 const connected=await runtime(env,Response.json({found:false},{status:404}),{connected:true}).api.answerN8nRequest('Liste n8n');
 assert.match(connected.text,/Fluxo real \(publicado\)/);assert.match(connected.text,/Listagem não confirma execução/);
 const invalid=await runtime({...env,JARVIS_HML_INGRESS_URL:'invalid'}).api.answerN8nRequest('n8n');
 assert.match(invalid.text,/configuração do ingresso está inválida/);
 assert.equal(await runtime().api.answerN8nRequest('olá'),null);
});
test('missing or invalid configuration never sends a request',async()=>{
 for(const e of [{},{...env,JARVIS_HML_INGRESS_URL:'https://evil.example'},{...env,JARVIS_HML_INGRESS_KEY:'bad\nkey'}]){
  const r=runtime(e);assert.equal((await r.api.hmlAvailability(true)).verified,false);assert.equal(r.calls.length,0);
 }
});
test('authenticates a read-only probe and requires exact not-found receipt',async()=>{
 const r=runtime(env);const status=await r.api.hmlAvailability(true);
 assert.equal(status.verified,true);assert.equal(r.calls.length,1);
 assert.equal(r.calls[0][0],'https://n8n.guardioesdaorigem.com.br/webhook/jk-hml/v1/status');
 assert.equal(r.calls[0][1].headers['X-Jarvis-Key'],env.JARVIS_HML_INGRESS_KEY);
 assert.equal(r.calls[0][1].redirect,'error');
 assert.doesNotMatch(JSON.stringify(status),/xxxxxxxx/);
 for(const response of [Response.json({found:false}),Response.json({error:'unauthorized'},{status:403}),new Response('<html/>',{status:404})]){
  assert.equal((await runtime(env,response).api.hmlAvailability(true)).verified,false);
 }
});
