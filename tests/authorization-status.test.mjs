import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8').replace(/import ["']server-only["'];?/g,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,URL,URLSearchParams,Response,AbortSignal,Date,TextDecoder,require:id=>id.startsWith('node:')?native(id):load(path.resolve(path.dirname(file),id+'.ts'))});return exports;}
const {authorizationStatusIntent:intent,answerAuthorizationStatus:answer,workspaceAuthorization}=load('lib/connectors/authorization-status.ts');
const {capabilityQuestion}=load('lib/orchestration/capability-intent.ts');
const {workspaceReadIntent}=load('lib/connectors/workspace.ts');
function fixture(){
 const state={connections:{github:{status:'connected',credentials:{accessToken:'PRIVATE_GITHUB'},resources:[{id:'repo'}],grants:['read'],verifiedAt:'2020-01-01'}},workspaceAccounts:{google:{id:'account',accessToken:'PRIVATE_GOOGLE',refreshToken:'PRIVATE_REFRESH',services:['gmail','google-drive'],verifiedAt:{gmail:'2020-01-01'}}}};
 let reads=0;const store={configured:()=>true,read:async()=>{reads++;return structuredClone(state);},update:()=>{throw Error('status cannot change permissions');}};
 return {state,store,reads:()=>reads};
}
test('natural access questions select saved grants, including speech names and mixed providers',()=>{
 for(const q of ['Você tem autorização no Google?','Você consegue acessar meu Gmail?','Minha autorização Google foi encerrada?'])assert.equal(intent(q)[0],'google');
 assert.equal(intent('Você tem acesso ao GitHub?')[0],'github');
 assert.equal(intent('A extensão está conectada?')[0],'browser');
 assert.equal(intent('Tem autorização no Google, navegador e GitHub?').join(','),'google,github,browser');
 assert.equal(intent('Quais são minhas conexões?').length,6);
});
test('status intent never consumes content reads, write commands, searches or ordinary conversation',()=>{
 for(const q of ['Liste os arquivos do Drive','Leia meu Gmail','Pesquise no Google sobre cinema','Publique no GitHub com minha autorização','Revogue a autorização Google','Olá Jarvis'])assert.equal(intent(q),null,q);
 assert.equal(workspaceReadIntent('Você pode ler meu Gmail?').service,'gmail');
 assert.equal(workspaceReadIntent('Veja os arquivos do Drive').service,'google-drive');
});
test('saved Google authorization survives stale evidence without disclosing tokens or claiming a live read',async()=>{
 const f=fixture(),reply=await answer('Você tem acesso ao Google?',f.store);
 assert.match(reply.text,/autorização salva/);assert.match(reply.text,/Gmail/);assert.match(reply.text,/Drive/);
 assert.match(reply.text,/sem testar os serviços agora/);assert.doesNotMatch(JSON.stringify(reply),/PRIVATE_|corpo.*lido/);
 assert.equal(f.reads(),1);assert.equal(f.state.workspaceAccounts.google.services.length,2);
 assert.doesNotMatch(JSON.stringify(workspaceAuthorization(f.state,'google')),/PRIVATE_/);
});
test('GitHub status preserves read-only grants and reports scoped access without promising writes',async()=>{
 const f=fixture(),reply=await answer('Tenho autorização no GitHub?',f.store);
 assert.match(reply.text,/leitura autorizada em 1 recursos/);assert.match(reply.text,/plano aprovado/);
 assert.deepEqual(f.state.connections.github.grants,['read']);assert.doesNotMatch(reply.text,/PRIVATE_|write/);
});
test('vault errors and missing authorization are different; no provider calls or revocation inference',async()=>{
 const f=fixture();delete f.state.workspaceAccounts.google;
 assert.match((await answer('Google está conectado?',f.store)).text,/não encontrei autorização salva/);
 f.store.read=async()=>{throw Error('PRIVATE_VAULT_ERROR');};
 const reply=await answer('Google está conectado?',f.store);
 assert.match(reply.text,/Não posso afirmar que a autorização foi encerrada/);assert.doesNotMatch(reply.text,/PRIVATE_/);
});
test('browser status is local, supervised and independent from the desktop companion',async()=>{
 const f=fixture(),reply=await answer('O navegador está conectado?',f.store);
 assert.equal(f.reads(),0);assert.match(reply.text,/não pelo servidor/);assert.match(reply.text,/por voz ainda não está ligado/);
 assert.equal(capabilityQuestion('A extensão está conectada?'),null);
 assert.equal(capabilityQuestion('O navegador Chrome está funcionando?'),null);
 assert.equal(capabilityQuestion('O companion Windows está conectado?'),'companion');
});
test('saved workspace grants enter operational answers without claiming a fresh provider verification',()=>{
 const {serviceStatus,operationalPrompt}=load('lib/operational/state.ts');
 const {operationalAnswer}=load('lib/operational/questions.ts');
 const row=serviceStatus({id:'google',name:'Google',configured:true,configurationValid:true,authorized:true,note:'Autorização salva para Gmail e Drive; somente metadados.'},undefined);
 const snapshot={schemaVersion:1,environment:'preview',generatedAt:new Date().toISOString(),integrations:[row],projects:[],catalog:{total:1,notConfigured:0,needsValidation:1,examples:[]}};
 assert.match(operationalPrompt(snapshot),/Autorização salva para Gmail e Drive/);
 assert.match(operationalAnswer('overview',snapshot),/autorização salva/);
 assert.equal(row.verified,false);
});
test('native operational enrichment reads the real workspace account projection, with no provider test',async()=>{
 const f=fixture();let tests=0;
 const exports={};
 const code=ts.transpileModule(fs.readFileSync('lib/connectors/native-status.ts','utf8').replace(/import ["']server-only["'];?/g,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,Date,structuredClone,require:id=>{
  if(id==='./server')return {connectorStore:f.store,connectors:{test:()=>{tests++;throw Error('must not probe');}}};
  if(id==='../n8n/discovery')return {hmlAvailability:async()=>({configured:false})};
  const file=path.resolve('lib/connectors',id+(id.endsWith('.json')?'':'.ts'));
  return id.endsWith('.json')?native(file):load(file);
 }});
 const {serviceStatus}=load('lib/operational/state.ts');
 const before=serviceStatus({id:'google',name:'Google',configured:true,configurationValid:true,authorized:false,note:'App config only'},undefined);
 const result=await exports.withNativeConnectors({schemaVersion:1,environment:'preview',generatedAt:new Date().toISOString(),integrations:[before],projects:[],catalog:{total:1,notConfigured:0,needsValidation:1,examples:[]}},false);
 const google=result.integrations.find(s=>s.id==='google');
 assert.equal(google.authorized,true);assert.equal(google.verified,false);assert.match(google.note,/Gmail/);
 assert.equal(tests,0);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_/);
});
test('status resolution precedes generic answers; browser opens a fresh document; verifying never expands GitHub grants',()=>{
 const server=fs.readFileSync('lib/connectors/server.ts','utf8');
 assert.ok(server.indexOf('await answerAuthorizationStatus')<server.indexOf('await answerSkillRequest'));
 const ui=fs.readFileSync('app/components/SimpleDevelopmentConnections.tsx','utf8');
 const verify=ui.slice(ui.indexOf('async function verify('),ui.indexOf('return <section'));
 assert.match(verify,/op:"test"/);assert.doesNotMatch(verify,/op:"scope"|grants:/);
 assert.match(fs.readFileSync('app/conexoes/page.tsx','utf8'),/<a href="\/integracoes\/navegador">/);
});
