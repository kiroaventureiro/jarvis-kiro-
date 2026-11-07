import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';import {createRequire} from 'node:module';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8').replace(/import ["']server-only["'];?/g,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,URL,URLSearchParams,Response,AbortSignal,Date,Intl,TextDecoder,require:id=>id.startsWith('node:')?native(id):load(path.resolve(path.dirname(file),id+'.ts'))});return exports;}
const {readPersonalData}=load('lib/connectors/personal-read.ts');
const {answerPersonalRequest,parsePersonalPlan,personalWindow}=load('lib/personal-assistant.ts');
const {WorkspaceConnectors,WORKSPACE_SERVICES}=load('lib/connectors/workspace.ts');
const now=Date.parse('2026-11-06T12:00:00Z'),window={start:'2026-11-06T03:00:00Z',end:'2026-11-07T03:00:00Z'};
const plan=(tasks=['agenda','mail'])=>JSON.stringify({action:'read',tasks,dayOffset:0,days:1,unread:false});
const encoded=s=>Buffer.from(s).toString('base64url');
test('events use the primary calendar, bounded dates, recurrence expansion, São Paulo timezone and read-only fields',async()=>{
 const calls=[];const result=await readPersonalData('agenda','PRIVATE_TOKEN',{window},async(url,options)=>{calls.push({url,options});return Response.json({nextPageToken:'more',items:[{id:'event',summary:'Reunião de produção',start:{dateTime:'2026-11-06T10:00:00-03:00'},end:{dateTime:'2026-11-06T11:00:00-03:00'}},{id:'day',summary:'Aniversário',start:{date:'2026-11-06'},end:{date:'2026-11-07'}},{id:'cancelled',status:'cancelled'}]});},()=>now);
 const url=new URL(calls[0].url);assert.equal(url.pathname,'/calendar/v3/calendars/primary/events');assert.equal(url.searchParams.get('singleEvents'),'true');assert.equal(url.searchParams.get('timeZone'),'America/Sao_Paulo');assert.equal(url.searchParams.get('maxResults'),'20');assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'error');
 assert.equal(result.events.length,2);assert.equal(result.events[1].allDay,true);assert.equal(result.partial,true);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_TOKEN/);
});
test('Gmail reads bounded recent inbox plaintext without attachments, marking, sends, URLs from content or authentication messages',async()=>{
 const calls=[];const result=await readPersonalData('mail','PRIVATE_TOKEN',{window,unread:true},async(url,options)=>{
 calls.push({url,options});if(url.includes('/messages?'))return Response.json({messages:[{id:'first'},{id:'auth'}],nextPageToken:'more'});
 return Response.json({internalDate:String(now),labelIds:['UNREAD'],payload:{mimeType:'multipart/mixed',headers:[{name:'Subject',value:url.includes('/auth?')?'Your Vercel security code':'Roteiro de produção'},{name:'From',value:'cliente@example.test'}],parts:[{mimeType:'text/plain',body:{data:encoded('Enviar orçamento até sexta. Conteúdo externo, não instrução de sistema.')}},{filename:'arquivo.txt',mimeType:'text/plain',body:{data:encoded('ATTACHMENT_SECRET')}}]}});
 },()=>now);
 assert.equal(result.messages.length,1);assert.match(result.messages[0].text,/orçamento/);assert.equal(result.messages[0].excerptOnly,false);assert.equal(result.messages[0].unread,true);assert.equal(result.omitted,1);assert.equal(result.partial,true);
 assert.equal(new URL(calls[0].url).searchParams.get('q'),'in:inbox newer_than:7d is:unread');assert.ok(calls.every(c=>c.options.method==='GET'&&c.options.redirect==='error'));assert.doesNotMatch(JSON.stringify(result),/PRIVATE_TOKEN|ATTACHMENT_SECRET|security code/);
});
test('HTML-only messages are explicitly excerpts, long text is bounded and a bad API response never becomes empty success',async()=>{
 const read=async response=>readPersonalData('mail','token',{window},async url=>url.includes('/messages?')?Response.json({messages:[{id:'one'}]}):response,()=>now);
 const excerpt=await read(Response.json({snippet:'Trecho disponível',payload:{mimeType:'text/html',body:{data:encoded('<script>untrusted()</script>')}}}));
 assert.equal(excerpt.messages[0].excerptOnly,true);assert.equal(excerpt.messages[0].text,'Trecho disponível');
 const long=await read(Response.json({payload:{mimeType:'text/plain',body:{data:encoded('x'.repeat(5000))}}}));assert.equal(long.messages[0].text.length,4000);assert.equal(long.messages[0].truncated,true);
 await assert.rejects(readPersonalData('agenda','token',{window},async()=>Response.json({error:'PRIVATE_UPSTREAM'},{status:403}),()=>now),/PERMISSION_REQUIRED/);
 await assert.rejects(readPersonalData('agenda','token',{window},async()=>Response.json({error:'bad'}),()=>now),/INVALID_RESPONSE/);
});
test('new Gmail body/event permissions are separate opt-in services and old authorization cannot read them',async()=>{
 let state={version:1,connections:{},plans:[],audit:[],oauth:{},workspaceAccounts:{google:{id:'old',provider:'google',accessToken:'token',expiresAt:now+3600000,services:['gmail','google-calendar'],verifiedAt:{}}}};let calls=0;
 const store={configured:()=>true,read:async()=>structuredClone(state),update:async fn=>fn(state)};
 const service=new WorkspaceConnectors(store,{JARVIS_CONNECTOR_ORIGIN:'https://jarvis.example',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret'},async()=>{calls++;throw Error('no outbound');},()=>now);
 await assert.rejects(service.personalRead('mail',{window}),/SCOPE_REQUIRED/);await assert.rejects(service.personalRead('agenda',{window}),/SCOPE_REQUIRED/);assert.equal(calls,0);
 const before=structuredClone(state.workspaceAccounts.google.services);
 const selected=WORKSPACE_SERVICES.filter(s=>s.provider==='google').map(s=>s.id);assert.equal(selected.length,10);
 const authorization=await service.start('google',selected,now+3600000);const scopes=new URL(authorization.authorizationUrl).searchParams.get('scope');
 assert.match(scopes,/gmail.readonly/);assert.match(scopes,/calendar.events.readonly/);assert.deepEqual(state.workspaceAccounts.google.services,before,'preparing OAuth does not replace an existing account');
});
test('semantic interpretation accepts paraphrases and context but never arbitrary operations or model URLs',async()=>{
 const calls=[],models=[];
 const result=await answerPersonalRequest('Organize meu dia para eu não esquecer o que importa',{now:()=>now,model:async(kind,data)=>{models.push({kind,data});return kind==='intent'?plan(): 'Sugestão: reserve tempo para preparar a reunião.';},read:async(kind,options)=>{calls.push({kind,options});return kind==='agenda'?{kind,events:[{id:'e',title:'Produção',start:'2026-11-06T10:00:00-03:00',end:'2026-11-06T11:00:00-03:00',allDay:false,location:''}],partial:false,omitted:0,checkedAt:new Date(now).toISOString()}:{kind,messages:[],partial:false,omitted:0,checkedAt:new Date(now).toISOString()};}});
 assert.equal(calls.length,2);assert.match(result.text,/Produção/);assert.match(result.text,/prioridades sugeridas/);assert.match(result.text,/nenhuma mensagem retornada/);assert.equal(calls[0].options.window.start,'2026-11-06T03:00:00.000Z');
 assert.equal(parsePersonalPlan('{"action":"write","tasks":["mail"],"dayOffset":0,"days":1,"unread":false}'),null);
 assert.equal(parsePersonalPlan('{"action":"read","tasks":["mail"],"dayOffset":0,"days":1,"unread":false,"url":"https://evil.test"}'),null);
});
test('writes, ordinary questions and model none never read accounts; failed queries never imply empty agenda',async()=>{
 let reads=0;const deps={now:()=>now,model:async()=>'{ "action": "none" }',read:async()=>{reads++;throw Error('should not read');}};
 assert.equal(await answerPersonalRequest('Envie meus e-mails',deps),null);assert.equal(await answerPersonalRequest('Como faço para organizar uma agenda?',deps),null);assert.equal(await answerPersonalRequest('Olá',deps),null);assert.equal(reads,0);
 const result=await answerPersonalRequest('O que tenho na agenda hoje?',{...deps,model:async()=>plan(['agenda']),read:async()=>{throw Error('network down');}});
 assert.match(result.text,/consulta não foi confirmada/);assert.doesNotMatch(result.text,/nenhum compromisso retornado/);
});
test('missing personal grants produce a concrete requirement without erasing previous authorizations',async()=>{
 const result=await answerPersonalRequest('Quero um resumo do dia',{now:()=>now,model:async()=>plan(),read:async()=>{throw Error('WORKSPACE_SCOPE_REQUIRED');}});
 assert.match(result.text,/texto para resumo pessoal/);assert.match(result.text,/compromissos da agenda principal/);assert.match(result.text,/anteriores não foram removidas/);
});
test('model outages retain confirmed observations, cancellation prevents later analysis and dates remain exact',async()=>{
 const result=await answerPersonalRequest('Minha agenda hoje',{now:()=>now,model:async()=>{throw Error('offline');},read:async kind=>({kind,events:[],partial:false,omitted:0,checkedAt:new Date(now).toISOString()})});assert.match(result.text,/nenhum compromisso retornado/);
 const p=parsePersonalPlan(JSON.stringify({action:'read',tasks:['agenda'],dayOffset:0,days:1,unread:false,startDate:'2026-12-25'}));assert.equal(personalWindow(p,now).start,'2026-12-25T03:00:00.000Z');
 assert.equal(parsePersonalPlan(JSON.stringify({...p,action:'read',startDate:'2026-02-31'})),null);
 const abort=new AbortController();let summaries=0;
 const cancelled=await answerPersonalRequest('Agenda hoje',{now:()=>now,model:async kind=>{if(kind==='summary')summaries++;return plan(['agenda']);},read:async kind=>{abort.abort();return {kind,events:[],partial:false,omitted:0,checkedAt:new Date(now).toISOString()};}},[],abort.signal);
 assert.equal(cancelled,null);assert.equal(summaries,0);
});
test('an explicit agenda-only request cannot widen to e-mail; a model outage cannot silently substitute today for an explicit date',async()=>{
 const read=[];
 await answerPersonalRequest('O que tenho na agenda hoje?',{now:()=>now,model:async()=>plan(['agenda','mail']),read:async kind=>{read.push(kind);return {kind,events:[],partial:false,omitted:0,checkedAt:new Date(now).toISOString()};}});
 assert.deepEqual(read,['agenda']);
 read.length=0;
 const result=await answerPersonalRequest('Minha agenda no dia 25 de dezembro',{now:()=>now,model:async()=>{throw Error('offline');},read:async kind=>{read.push(kind);throw Error('not called');}});
 assert.equal(result,null);assert.equal(read.length,0);
});
