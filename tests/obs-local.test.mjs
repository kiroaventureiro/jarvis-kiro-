import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {createHash,webcrypto} from 'node:crypto';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/obs/local-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto:webcrypto,TextEncoder,btoa,Date,setTimeout,clearTimeout,Uint8Array});
const {inspectLocalObs,obsAuthentication}=exports;
const password='OBS-fixture-secret',salt='fixture-salt',challenge='fixture-challenge';
const sha=s=>createHash('sha256').update(s).digest('base64');
const expected=sha(sha(password+salt)+challenge);
function factory({rejectAuth=false,noAuth=false,invalid=false,silent=false,neverIdentify=false}={}){
 const sent=[];let closed=false;const listeners=new Map();
 const emit=(type,event)=>{for(const fn of listeners.get(type)||[])fn(event)};
 const socket={addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn)},removeEventListener:(type,fn)=>listeners.get(type)?.delete(fn),close:()=>{closed=true},send:raw=>{
  const packet=JSON.parse(raw);sent.push(packet);
  if(packet.op===1){assert.equal(packet.d.authentication,expected);assert.equal(packet.d.eventSubscriptions,0);if(rejectAuth)return queueMicrotask(()=>emit('close',{code:4009}));if(!neverIdentify)queueMicrotask(()=>emit('message',{data:JSON.stringify({op:2,d:{negotiatedRpcVersion:1}})}));}
  if(packet.op===6){
   const responses={GetVersion:{obsVersion:'31.1.0',obsWebSocketVersion:'5.6.0'},GetSceneList:{currentProgramSceneName:'KIRO TV',scenes:[{sceneName:'KIRO TV'},{sceneName:'Intervalo'}]},GetStreamStatus:{outputActive:false},GetRecordStatus:{outputActive:true}};
   queueMicrotask(()=>emit('message',{data:JSON.stringify({op:7,d:{requestId:packet.d.requestId,requestType:packet.d.requestType,requestStatus:{result:!invalid},responseData:responses[packet.d.requestType]}})}));
  }
 }};
 const create=url=>{assert.match(url,/^ws:\/\/127\.0\.0\.1:\d+$/);if(!silent)queueMicrotask(()=>emit('message',{data:JSON.stringify({op:0,d:{rpcVersion:1,...(noAuth?{}:{authentication:{salt,challenge}})}})}));return socket;};
 return {create,sent,isClosed:()=>closed};
}
test('OBS challenge matches the documented two-step SHA256/base64 algorithm',async()=>{assert.equal(await obsAuthentication(password,salt,challenge),expected);await assert.rejects(obsAuthentication('',salt,challenge),/AUTH_REQUIRED/)});
test('authenticated loopback inspection sends only fixed read requests and closes after evidence',async()=>{
 const f=factory();const result=await inspectLocalObs({port:4455,password},f.create);assert.equal(result.currentScene,'KIRO TV');assert.equal(result.scenes.length,2);assert.equal(result.streaming,false);assert.equal(result.recording,true);assert.ok(f.isClosed());
 assert.deepEqual(f.sent.filter(x=>x.op===6).map(x=>x.d.requestType),['GetVersion','GetSceneList','GetStreamStatus','GetRecordStatus']);assert.equal(JSON.stringify(f.sent).includes(password),false);
});
test('authentication failure, unauthenticated server and invalid results cannot claim connection',async()=>{
 for(const [options,code] of [[{rejectAuth:true},'OBS_AUTH_FAILED'],[{noAuth:true},'OBS_AUTH_REQUIRED'],[{invalid:true},'OBS_INVALID_RESPONSE']]){const f=factory(options);await assert.rejects(inspectLocalObs({port:4455,password},f.create),e=>e.code===code);assert.ok(f.isClosed());if(options.rejectAuth||options.noAuth)assert.equal(f.sent.some(x=>x.op===6),false);}
});
test('cancellation, invalid port and timeout stop without remote writes or reconnection',async()=>{
 const f=factory({silent:true}),ac=new AbortController();const pending=inspectLocalObs({port:4455,password,signal:ac.signal},f.create);ac.abort();await assert.rejects(pending,e=>e.code==='OBS_CANCELLED');assert.ok(f.isClosed());assert.deepEqual(f.sent,[]);
 await assert.rejects(inspectLocalObs({port:80,password},()=>{throw Error('must not create socket')}),e=>e.code==='OBS_INVALID_PORT');
 const g=factory({silent:true});await assert.rejects(inspectLocalObs({port:4455,password,timeoutMs:500},g.create),e=>e.code==='OBS_TIMEOUT');assert.ok(g.isClosed());
});
