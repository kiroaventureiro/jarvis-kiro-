import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
const code=ts.transpileModule(fs.readFileSync('lib/n8n/catalog-run.ts','utf8').replace(/^import .*;\r?\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/hml-integration-audit',JARVIS_N8N_BRIDGE_SECRET:'b'.repeat(48),JARVIS_HML_INGRESS_KEY:'k'.repeat(48)};
let definition;
new Function('require','console',fs.readFileSync('scripts/prepare-n8n-catalog-report.cjs','utf8'))(name=>name==='node:fs'?{
 readFileSync:()=>JSON.stringify([{nodes:[{type:'n8n-nodes-base.webhook',credentials:{httpHeaderAuth:{id:'existing',name:'Existing ingress'}}}]}]),
 writeFileSync:(_,value)=>{definition=JSON.parse(value)[0];}
}:{randomUUID},{log:()=>{}});
const reportNode=definition.nodes.find(n=>n.type==='n8n-nodes-base.code');
function workflowReceipt(body){return new Function('$input',reportNode.parameters.jsCode)({first:()=>({json:{body}})})[0].json;}
function runtime({patch={},tamper=value=>value,connected=true}={}){
 const state=connected?{n8n:{apiKey:'server-only-api-key'}}:{};
 const exports={},requests=[];let reads=0,receipt;
 new Function('exports','createHash','createHmac','randomUUID','timingSafeEqual','connectorStore','listN8nWorkflows','fetch','process',code)(exports,
  createHash,createHmac,randomUUID,timingSafeEqual,{read:async()=>structuredClone(state),update:async fn=>fn(state)},
  async()=>{reads++;return {workflows:[{id:'one',name:'Fluxo real',active:true},{id:'two',name:'Outro fluxo',active:false}],partial:false};},
  async(url,options)=>{requests.push({url,options});receipt=workflowReceipt(JSON.parse(options.body));return Response.json(tamper(structuredClone(receipt)));},
  {env:{...env,...patch}});
 return {api:exports,state,requests,reads:()=>reads,receipt:()=>receipt};
}
test('real report executes the generated n8n transform and accepts only a bound response on the outbound connection',async()=>{
 const r=runtime();const run=await r.api.startCatalogRun();
 assert.equal(run.state,'succeeded');assert.equal(run.report.total,2);assert.equal(run.report.active,1);assert.equal(r.reads(),1);
 assert.equal(r.requests[0].url,'https://n8n.guardioesdaorigem.com.br/webhook/jarvis-kiro/catalog-report-v1');
 assert.equal(r.requests[0].options.headers['X-Jarvis-Key'],env.JARVIS_HML_INGRESS_KEY);assert.equal(r.requests[0].options.redirect,'error');
 assert.doesNotMatch(JSON.stringify(run),/server-only-api-key|bbbbbbbb|kkkkkkkk|ticket/);
 assert.doesNotMatch(r.requests[0].options.body,/server-only-api-key/);
 assert.equal(definition.nodes.some(n=>n.type==='n8n-nodes-base.httpRequest'),false);
 for(const tamper of [r=>({...r,runId:randomUUID()}),r=>({...r,inputDigest:'0'.repeat(64)}),r=>({...r,ticket:'a'.repeat(64)}),r=>({...r,report:{...r.report,total:999}})]){
  const forged=runtime({tamper});assert.equal((await forged.api.startCatalogRun()).state,'failed');
 }
});
test('receipt acceptance is expiring and single-use, including concurrent replays',async()=>{
 const r=runtime();const run=await r.api.startCatalogRun();const receipt=r.receipt();const stored=r.state.n8nCatalogRuns[0];
 await assert.rejects(r.api.acceptCatalogReceipt(run.id,receipt,run.report),/RECEIPT_DENIED/);
 stored.state='running';
 const results=await Promise.allSettled([r.api.acceptCatalogReceipt(run.id,receipt,run.report),r.api.acceptCatalogReceipt(run.id,receipt,run.report)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 stored.state='running';stored.expiresAt=Date.now()-1;await assert.rejects(r.api.acceptCatalogReceipt(run.id,receipt,run.report),/RECEIPT_DENIED/);
 assert.equal(r.reads(),1);
});
test('execution is restricted to audit preview, connected owner vault and a bounded request rate',async()=>{
 for(const patch of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{JARVIS_N8N_BRIDGE_SECRET:'short'},{JARVIS_HML_INGRESS_KEY:'short'}]){
  const r=runtime({patch});await assert.rejects(r.api.startCatalogRun(),/NOT_CONFIGURED/);assert.equal(r.requests.length,0);
 }
 const disconnected=runtime({connected:false});await assert.rejects(disconnected.api.startCatalogRun(),/N8N_NOT_CONNECTED/);
 const r=runtime();for(let i=0;i<5;i++)await r.api.startCatalogRun();await assert.rejects(r.api.startCatalogRun(),/RATE_LIMIT/);assert.equal(r.requests.length,5);
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
