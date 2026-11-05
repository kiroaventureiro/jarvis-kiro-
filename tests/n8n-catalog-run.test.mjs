import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
const code=ts.transpileModule(fs.readFileSync('lib/n8n/catalog-run.ts','utf8').replace(/^import .*;\r?\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/hml-integration-audit',JARVIS_N8N_BRIDGE_SECRET:'b'.repeat(48),JARVIS_HML_INGRESS_KEY:'k'.repeat(48)};
function runtime({patch={},callback=true,connected=true}={}){
 const state=connected?{n8n:{apiKey:'server-only-api-key'}}:{};
 const exports={},requests=[];let reads=0;
 new Function('exports','createHmac','randomUUID','timingSafeEqual','connectorStore','listN8nWorkflows','fetch','process',code)(exports,
  createHmac,randomUUID,timingSafeEqual,{read:async()=>structuredClone(state),update:async fn=>fn(state)},
  async()=>{reads++;return {workflows:[{name:'Fluxo real',active:true},{name:'Outro fluxo',active:false}],partial:false};},
  async(url,options)=>{requests.push({url,options});if(callback){const body=JSON.parse(options.body);await exports.completeCatalogRun(body.runId,body.ticket);}return Response.json({state:'succeeded',report:{total:999}});},
  {env:{...env,...patch}});
 return {api:exports,state,requests,reads:()=>reads};
}
test('real report dispatch uses fixed webhook and trusts only the persisted callback result',async()=>{
 const r=runtime();const run=await r.api.startCatalogRun();
 assert.equal(run.state,'succeeded');assert.equal(run.report.total,2);assert.equal(run.report.active,1);assert.equal(r.reads(),1);
 assert.equal(r.requests[0].url,'https://n8n.guardioesdaorigem.com.br/webhook/jarvis-kiro/catalog-report-v1');
 assert.equal(r.requests[0].options.headers['X-Jarvis-Key'],env.JARVIS_HML_INGRESS_KEY);assert.equal(r.requests[0].options.redirect,'error');
 assert.doesNotMatch(JSON.stringify(run),/server-only-api-key|bbbbbbbb|kkkkkkkk|ticket/);
 const forged=runtime({callback:false});assert.equal((await forged.api.startCatalogRun()).state,'failed');assert.equal(forged.reads(),0);
});
test('tickets are run-bound, expiring and single-use; concurrent callbacks read at most once',async()=>{
 const r=runtime({callback:false});await r.api.startCatalogRun();const request=JSON.parse(r.requests[0].options.body);const stored=r.state.n8nCatalogRuns[0];
 stored.state='queued';
 await assert.rejects(r.api.completeCatalogRun(request.runId,'a'.repeat(64)),/TICKET_DENIED/);assert.equal(r.reads(),0);
 const results=await Promise.allSettled([r.api.completeCatalogRun(request.runId,request.ticket),r.api.completeCatalogRun(request.runId,request.ticket)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.reads(),1);
 await assert.rejects(r.api.completeCatalogRun(request.runId,request.ticket),/TICKET_DENIED/);
 stored.state='queued';stored.expiresAt=Date.now()-1;await assert.rejects(r.api.completeCatalogRun(request.runId,request.ticket),/TICKET_DENIED/);
 assert.equal(r.reads(),1);
});
test('execution is restricted to audit preview, connected owner vault and a bounded request rate',async()=>{
 for(const patch of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{JARVIS_N8N_BRIDGE_SECRET:'short'},{JARVIS_HML_INGRESS_KEY:'short'}]){
  const r=runtime({patch});await assert.rejects(r.api.startCatalogRun(),/NOT_CONFIGURED/);assert.equal(r.requests.length,0);
 }
 const disconnected=runtime({connected:false});await assert.rejects(disconnected.api.startCatalogRun(),/N8N_NOT_CONNECTED/);
 const r=runtime({callback:false});for(let i=0;i<5;i++)await r.api.startCatalogRun();await assert.rejects(r.api.startCatalogRun(),/RATE_LIMIT/);assert.equal(r.requests.length,5);
});
test('natural execution requires an explicit imperative and never treats a question as permission',()=>{
 const r=runtime();
 assert.equal(r.api.catalogRunIntent('Jarvis, gere um relatório dos workflows no n8n'),true);
 assert.equal(r.api.catalogRunIntent('Como executar um relatório dos workflows no n8n?'),false);
 assert.equal(r.api.catalogRunIntent('Execute o workflow de e-mail no n8n'),false);
 assert.doesNotMatch(r.api.catalogRunText({id:'id',state:'running'}),/foi executado/);
});
test('n8n configuration requests bypass device preferences without breaking local volume control',()=>{
 const source=fs.readFileSync('lib/settings/jarvis-control.ts','utf8').replace(/^import .*;\r?\n/gm,'');
 const settingsCode=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const local={};let writes=0,reads=0;
 new Function('exports','readVoicePreferences','saveVoicePreferences','readGraphicsPreference','setGraphicsPreference','historyConsent','setHistoryConsent','localStorage',settingsCode)(local,
  ()=>{reads++;return {volume:1,rate:0.95,pitch:1,continuous:true};},()=>{writes++;},()=> 'auto',()=>{},()=>false,()=>{}, {getItem:()=>null});
 assert.equal(local.jarvisSettingsCommand('Jarvis, veja a configuração do fluxo Consultar estado e resultado no n8n.'),null);
 assert.equal(local.jarvisSettingsCommand('Configure a voz Orus no workflow do N 8 N'),null);assert.equal(reads,0);assert.equal(writes,0);
 assert.match(local.jarvisSettingsCommand('Quais as configurações deste dispositivo?').text,/Configurações disponíveis neste dispositivo/);
 assert.match(local.jarvisSettingsCommand('Ajuste o volume para 60 por cento').text,/Volume ajustado para 60/);assert.equal(writes,1);
});
