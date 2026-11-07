import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';import {createRequire} from 'node:module';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8').replace(/import ["']server-only["'];?/g,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,URL,URLSearchParams,Response,AbortSignal,Date,Intl,TextDecoder,require:id=>id.startsWith('node:')?native(id):load(path.resolve(path.dirname(file),id+'.ts'))});return exports;}
const {personalContext,personalContextFacts}=load('lib/personal-context.ts');
const {daySummaryIntent,answerPersonalRequest}=load('lib/personal-assistant.ts');
const now=Date.parse('2026-11-06T22:00:00Z');
const project={id:'one',name:'Produção',provider:'github',objective:'Vídeo',status:'active',nextStep:'Revisar roteiro',notes:['PRIVATE_NOTE'],createdAt:new Date(now).toISOString(),updatedAt:'2026-11-05T12:00:00Z'};
function state(){return {version:1,oauth:{secret:'PRIVATE_OAUTH'},audit:[{operation:'PRIVATE_AUDIT'}],connections:{github:{status:'connected',grants:['read'],credentials:{accessToken:'PRIVATE_TOKEN'},resources:[{id:'private-id',name:'owner/projeto'}]}},persistentProjects:{one:project,done:{...project,id:'done',status:'completed'}},plans:[{id:'p',title:'Revisão proposta',status:'draft',createdAt:now-1000,expiresAt:now+10000,conversationSession:'PRIVATE_SESSION',steps:[{action:{args:{secret:'PRIVATE_ARGS'}}}]},{id:'old',title:'Plano expirado',status:'draft',createdAt:now-1000,expiresAt:now-10,steps:[]}]};}
const empty=kind=>({kind,events:[],messages:[],partial:false,omitted:0,checkedAt:new Date(now).toISOString()});
test('broad summaries accept ordinary variants and remain useful without the semantic model',async()=>{
 for(const phrase of ['Resuma meu dia','Como tá meu dia?','Como está o meu dia?','Resuma tudo','Quero um resumo de tudo','Me deixe a par','Me dê um panorama de hoje']){
  assert.equal(daySummaryIntent(phrase),true,phrase);const reads=[];let contexts=0;
  const result=await answerPersonalRequest(phrase,{now:()=>now,read:async kind=>{reads.push(kind);return empty(kind);},model:async()=>{throw Error('not available');},context:async()=>{contexts++;return personalContext(state(),now);}});
  assert.equal(reads.join(','),'agenda,mail',phrase);assert.equal(contexts,1);assert.match(result.text,/Revisar roteiro/);assert.match(result.text,/sob demanda/);assert.match(result.text,/sem horário fixo/);assert.match(result.text,/Não consultei commits/);
 }
});
test('only explicitly projected saved context is exposed; stale records never become live project updates',()=>{
 const context=personalContext(state(),now),raw=JSON.stringify(context);
 assert.doesNotMatch(raw,/PRIVATE_|private-id|Plano expirado/);assert.equal(context.projects.length,1);assert.equal(context.pending.length,1);
 assert.match(personalContextFacts(context),/2026-11-05/);assert.match(personalContextFacts(context),/não comprovam atualização ao vivo/);
});
test('semantic paraphrases can ask for the combined context; a single-source request cannot',async()=>{
 let contexts=0;const deps={now:()=>now,read:async kind=>empty(kind),model:async kind=>kind==='intent'?JSON.stringify({action:'read',tasks:['agenda','mail'],dayOffset:0,days:1,unread:false,includeContext:true}):'Sugestão de revisão do roteiro.',context:async()=>{contexts++;return personalContext(state(),now);}};
 const broad=await answerPersonalRequest('Me dê uma visão das minhas coisas',deps);assert.match(broad.text,/Revisar roteiro/);assert.equal(contexts,1);
 contexts=0;await answerPersonalRequest('Consulte apenas meu Gmail',deps);assert.equal(contexts,0);
});
test('failed saved-context reads do not suppress live sources or falsely claim that projects were deleted',async()=>{
 const result=await answerPersonalRequest('Resuma meu dia',{now:()=>now,read:async kind=>empty(kind),model:async()=>{throw Error('unavailable');},context:async()=>{throw Error('PRIVATE_VAULT_ERROR');}});
 assert.match(result.text,/Não consegui ler os registros/);assert.match(result.text,/não significa que eles foram apagados/);assert.match(result.text,/Leitura confirmada/);assert.doesNotMatch(result.text,/PRIVATE_/);
});
test('large daily summaries stay within the conversation response contract and acknowledge excerpts',async()=>{
 const context=personalContext(state(),now);context.projects[0].nextStep='x'.repeat(10000);
 const result=await answerPersonalRequest('Resuma tudo',{now:()=>now,read:async kind=>kind==='agenda'?{...empty(kind),events:Array.from({length:20},(_,i)=>({id:String(i),title:'Evento '.repeat(100),start:'2026-11-06T22:00:00Z',end:'2026-11-06T23:00:00Z',location:'Local '.repeat(100),allDay:false}))}:{...empty(kind),messages:Array.from({length:5},(_,i)=>({id:String(i),subject:'Assunto '.repeat(100),from:'remetente '.repeat(100),date:'',text:'Texto',truncated:false,excerptOnly:false,unread:false}))},model:async()=> 'Análise '.repeat(2000),context:async()=>context});
 assert.ok(result.text.length<12000);assert.match(result.text,/trecho do resumo/);
});
test('instructions to send, schedule or modify do not become a daily summary',()=>{
 for(const text of ['Envie um resumo do meu dia','Agende o resumo de tudo','Crie um resumo do meu dia às 8h','Como criar um resumo do dia?'])assert.equal(daySummaryIntent(text),false,text);
});
test('a broad summary about an external subject never becomes permission to read personal accounts',async()=>{
 let reads=0,contexts=0;
 for(const message of ['Resuma tudo sobre astronomia','Quero um resumo de tudo do GitHub','Me dê um panorama de tudo do YouTube','Faça um resumo desse texto sobre o dia de ontem']){
  assert.equal(daySummaryIntent(message),false,message);
  const result=await answerPersonalRequest(message,{now:()=>now,read:async()=>{reads++;throw Error('not authorized by this request');},context:async()=>{contexts++;return personalContext(state(),now);},model:async()=>'{"action":"none"}'});
  assert.equal(result,null);
 }
 assert.equal(reads,0);assert.equal(contexts,0);
});
test('a summary of only Gmail never adds agenda or saved projects',async()=>{
 const read=[];let contexts=0;
 assert.equal(daySummaryIntent('Resuma tudo do meu Gmail'),false);
 await answerPersonalRequest('Resuma tudo do meu Gmail',{now:()=>now,read:async kind=>{read.push(kind);return empty(kind);},context:async()=>{contexts++;return personalContext(state(),now);},model:async()=>JSON.stringify({action:'read',tasks:['mail'],dayOffset:0,days:1,unread:false})});
 assert.deepEqual(read,['mail']);assert.equal(contexts,0);
});
