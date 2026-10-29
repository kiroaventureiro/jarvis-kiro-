import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';import {createRequire} from 'node:module';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8').replace(/import ["']server-only["'];?/g,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,URL,URLSearchParams,Response,AbortSignal,Date,TextDecoder,require:id=>id.startsWith('node:')?native(id):load(path.resolve(path.dirname(file),id+'.ts'))});return exports;}
const {WorkspaceConnectors}=load('lib/connectors/workspace.ts');
function fixture({configured=true,now=100000}={}){
 let state={version:1,oauth:{},connections:{},plans:[],audit:[]};let clock=now;const requests=[];
 const store={configured:()=>configured,read:async()=>structuredClone(state),update:async fn=>{const next=structuredClone(state);const out=fn(next);state=next;return structuredClone(out);}};
 const env={JARVIS_CONNECTOR_ORIGIN:'https://jarvis.example',GOOGLE_CLIENT_ID:'google-client',GOOGLE_CLIENT_SECRET:'private-google-secret',MICROSOFT_CLIENT_ID:'ms-client',MICROSOFT_CLIENT_SECRET:'private-ms-secret'};
 let rejectRead=false;let onToken=null;
 const fetcher=async(url,options)=>{requests.push({url,options});if(url.endsWith('/token')){if(onToken)await onToken();return Response.json({access_token:'private-access-token',refresh_token:'private-refresh-token',expires_in:3600});}if(rejectRead)return Response.json({error:'private-upstream-error'},{status:403});if(url.includes('gmail/v1/users/me/messages?'))return Response.json({messages:[{id:'message-1'}]});if(url.includes('gmail/v1/users/me/messages/'))return Response.json({payload:{headers:[{name:'Subject',value:'Agenda Kiro TV'}]}});return Response.json(url.includes('/drive/v3/')?{files:[{id:'file-1',name:'Kiro roteiro'}]}:{value:[{id:'record-1',subject:'Kiro'}]});};
 return {service:new WorkspaceConnectors(store,env,fetcher,()=>clock),store,env,requests,setClock:v=>clock=v,setRejectRead:v=>rejectRead=v,setOnToken:fn=>onToken=fn};
}
async function connect(f,provider='google',services=['google-drive']){const start=await f.service.start(provider,services,99999999);const url=new URL(start.authorizationUrl);await f.service.finish(provider,url.searchParams.get('state'),start.binding,'official-code');return start;}
test('missing registration or vault fails before outbound calls; no fake authorization link',async()=>{
 const f=fixture({configured:false});await assert.rejects(f.service.start('google',['gmail'],999999),/NOT_CONFIGURED/);assert.equal(f.requests.length,0);
 const g=fixture();delete g.env.GOOGLE_CLIENT_SECRET;const view=await g.service.overview();assert.equal(view.providers[0].authorizationReady,false);await assert.rejects(g.service.start('google',['gmail'],999999),/NOT_CONFIGURED/);
});
test('Google flow uses selected read scopes, PKCE and exact registered callback; secrets stay server side',async()=>{
 const f=fixture();const start=await f.service.start('google',['gmail','google-drive'],99999999);const u=new URL(start.authorizationUrl);
 assert.equal(u.origin,'https://accounts.google.com');assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('redirect_uri'),'https://jarvis.example/api/director/workspace-connectors/google/callback');
 assert.equal(u.searchParams.get('scope').includes('gmail.metadata'),true);assert.equal(u.searchParams.get('scope').includes('youtube'),false);assert.equal(u.href.includes('private-google-secret'),false);
 await assert.rejects(f.service.finish('google',u.searchParams.get('state'),'wrong-browser','code'),/INVALID_CALLBACK/);
 await f.service.finish('google',u.searchParams.get('state'),start.binding,'code');
 await assert.rejects(f.service.finish('google',u.searchParams.get('state'),start.binding,'code'),/INVALID_CALLBACK/);
 const view=await f.service.overview();assert.equal(view.providers[0].connected,true);assert.equal(JSON.stringify(view).includes('private-'),false);
 assert.equal(f.requests[0].options.body.get('code_verifier').length,64);assert.equal(f.requests[0].options.redirect,'error');
});
test('expired, cross-provider and mixed services cannot receive authorization',async()=>{
 const f=fixture();await assert.rejects(f.service.start('google',['outlook'],9999999),/INVALID_SERVICES/);
 const start=await f.service.start('google',['gmail'],99999999),state=new URL(start.authorizationUrl).searchParams.get('state');
 await assert.rejects(f.service.finish('microsoft',state,start.binding,'code'),/INVALID_CALLBACK/);
 f.setClock(1000000);await assert.rejects(f.service.finish('google',state,start.binding,'code'),/INVALID_CALLBACK/);assert.equal(f.requests.length,0);
});
test('Microsoft official flow supports read metadata, renewal and local disconnect without resurrecting access',async()=>{
 const f=fixture();const start=await connect(f,'microsoft',['outlook']);const url=new URL(start.authorizationUrl);assert.equal(url.hostname,'login.microsoftonline.com');assert.equal(url.searchParams.get('scope'),'Mail.ReadBasic offline_access');
 const read=await f.service.read('outlook');assert.equal(read.items[0].name,'Kiro');assert.equal(read.source,'live');assert.equal(read.writesEnabled,false);
 f.setClock(3700000);await f.service.read('outlook');assert.equal(f.requests.filter(r=>r.options.body?.get('grant_type')==='refresh_token').length,1);
 await f.service.disconnect('microsoft');await assert.rejects(f.service.read('outlook'),/NOT_CONNECTED/);
 assert.equal(JSON.stringify(await f.service.overview()).includes('private-'),false);
});
test('real adapter accepts only fixed read destinations and authorized services; rejected read clears evidence',async()=>{
 const f=fixture();await connect(f);const result=await f.service.read('google-drive');assert.equal(result.items[0].name,'Kiro roteiro');assert.equal(result.items.length,1);
 await assert.rejects(f.service.read('gmail'),/SCOPE_REQUIRED/);await assert.rejects(f.service.read('https://evil.example'),/INVALID_SERVICE/);
 f.setRejectRead(true);await assert.rejects(f.service.read('google-drive'),/READ_FAILED/);assert.equal((await f.service.overview()).providers[0].verifiedAt['google-drive'],undefined);
 assert.ok(f.requests.filter(r=>!r.url.endsWith('/token')).every(r=>r.options.method==='GET'&&r.options.redirect==='error'));
});
test('disconnect during refresh cannot restore a deleted account',async()=>{
 const f=fixture();await connect(f);f.setClock(3700000);f.setOnToken(()=>f.service.disconnect('google'));await assert.rejects(f.service.read('google-drive'),/REAUTHORIZE/);assert.equal((await f.service.overview()).providers[0].connected,false);
});
test('catalog has unique entries and honest blockers for OBS, Grok, banks and unsupported apps',()=>{
 const rows=JSON.parse(fs.readFileSync('config/connection-catalog.json','utf8')).items;assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 const {connectionOption}=load('lib/connection-options.ts');assert.equal(connectionOption('obs-studio','').href,null);assert.equal(connectionOption('nubank-pj','').href,null);assert.match(connectionOption('xai-grok','').requirement,/não equivale/);assert.equal(connectionOption('gmail','').href,'#workspace-connectors');
});

test('disconnect during authorization code exchange cannot restore account access',async()=>{
 const f=fixture();const start=await f.service.start('google',['google-drive'],99999999);
 f.setOnToken(()=>f.service.disconnect('google'));
 await assert.rejects(f.service.finish('google',new URL(start.authorizationUrl).searchParams.get('state'),start.binding,'code'),/NOT_CONNECTED/);
 assert.equal((await f.service.overview()).providers[0].connected,false);
});

test('conversational metadata requests select the authorized adapter and never treat writes as reads',()=>{
 const {workspaceReadIntent}=load('lib/connectors/workspace.ts');
 assert.equal(workspaceReadIntent('Jarvis, liste meus arquivos no Drive').service,'google-drive');
 assert.equal(workspaceReadIntent('quais mensagens no Gmail').service,'gmail');
 assert.equal(workspaceReadIntent('mostre as agendas da Microsoft').service,'microsoft-calendar');
 assert.equal(workspaceReadIntent('envie um email pelo Gmail').writeRequested,true);
 assert.equal(workspaceReadIntent('boa tarde'),null);
});

test('Gmail reads only five bounded subject metadata records, never message bodies',async()=>{
 const f=fixture();await connect(f,'google',['gmail']);const result=await f.service.read('gmail');assert.equal(result.items[0].name,'Agenda Kiro TV');
 const detail=f.requests.find(r=>r.url.includes('/messages/'));assert.equal(new URL(detail.url).searchParams.get('format'),'metadata');assert.equal(new URL(detail.url).searchParams.get('metadataHeaders'),'Subject');assert.equal(detail.options.method,'GET');
});
