import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as contract from '../extensions/jarvis-browser/contract.mjs';
const origin=contract.ORIGIN;
const sender={url:origin+'/integracoes/navegador',frameId:0,tab:{id:4,incognito:false}};
function worker(){
 let state={},external,internal;const actions=[];
 const chrome={
  runtime:{id:'a'.repeat(32),getURL:p=>'chrome-extension://'+'a'.repeat(32)+'/'+p,onMessageExternal:{addListener:fn=>external=fn},onMessage:{addListener:fn=>internal=fn}},
  storage:{session:{get:async()=>structuredClone(state),set:async value=>{state={...state,...structuredClone(value)};}}},
  action:{setBadgeText:async()=>{}},windows:{update:async()=>{}},
  tabs:{query:async query=>query.active?[{id:10}]:[{id:10,title:'Página',url:'https://example.org/path?token=PRIVATE#secret'},{id:11,incognito:true,url:'https://private.example'},{id:12,url:'chrome://settings'}],
   get:async id=>({id,url:'https://example.org/',windowId:1}),create:async args=>{actions.push(args);return {id:20};},update:async(...args)=>{actions.push(args);}},
  scripting:{executeScript:async args=>{actions.push(args);return [{result:{text:'Página consultada',untrusted:true}}];}},
 };
 new Function('chrome',...Object.keys(contract),fs.readFileSync('extensions/jarvis-browser/background.js','utf8').replace(/^import .*\n/,''))(chrome,...Object.values(contract));
 const call=(fn,message,source)=>new Promise(resolve=>fn(message,source,resolve));
 const popup={id:chrome.runtime.id,url:chrome.runtime.getURL('popup.html')};
 return {external:(m,s=sender)=>call(external,m,s),internal:(m,s=popup)=>call(internal,m,s),actions,state:()=>state};
}
test('origin, frame and private browsing are checked before every external message',async()=>{
 for(const source of [{...sender,url:'https://evil.example/integracoes/navegador'},{...sender,url:origin+'/outro'},{...sender,frameId:1},{...sender,tab:{id:4,incognito:true}}])assert.equal((await worker().external({type:'hello'},source)).error,'ORIGIN_DENIED');
 const w=worker();assert.equal((await w.external({type:'hello'})).supervised,true);assert.equal(w.actions.length,0);
});
test('strict action contract rejects unknown operations, arbitrary fields, unsafe URLs and sensitive fields',()=>{
 for(const action of [{op:'shell',command:'whoami'},{op:'open',url:'javascript:alert(1)'},{op:'open',url:'https://user:pass@example.org'},{op:'list',cookie:true},{op:'read',tabId:-1},{op:'fill',tabId:10,label:'Senha',text:'secret'}])assert.throws(()=>contract.validateAction(action));
 assert.deepEqual(contract.validateAction({op:'open',url:'https://example.org'}),{op:'open',url:'https://example.org'});
});
test('proposing and polling cannot execute; approval is local, single-use and bound to the initiating tab',async()=>{
 const w=worker();const pending=await w.external({type:'propose',action:{op:'open',url:'https://example.org'}});
 assert.equal(pending.state,'pending');assert.equal(w.actions.length,0);
 assert.equal((await w.external({type:'result',id:pending.id},{...sender,tab:{id:5}})).error,'REQUEST_NOT_FOUND');
 assert.equal((await w.internal({type:'approve',id:pending.id},{id:'other',url:'chrome-extension://other/popup.html'})).error,'REVIEW_DENIED');
 assert.equal((await w.internal({type:'approve',id:pending.id})).state,'completed');assert.equal(w.actions.length,1);
 assert.equal((await w.internal({type:'approve',id:pending.id})).ok,false);assert.equal(w.actions.length,1);
 assert.equal((await w.external({type:'result',id:pending.id})).result.opened,true);
});
test('denial, expiry and competing approvals cannot replay navigation',async()=>{
 const w=worker();let p=await w.external({type:'propose',action:{op:'open',url:'https://example.org'}});
 assert.equal((await w.internal({type:'deny',id:p.id})).state,'denied');assert.equal(w.actions.length,0);
 p=await w.external({type:'propose',action:{op:'open',url:'https://example.org'}});w.state().request.expiresAt=Date.now()-1;
 assert.equal((await w.internal({type:'approve',id:p.id})).ok,false);assert.equal(w.actions.length,0);
 p=await w.external({type:'propose',action:{op:'open',url:'https://example.org'}});
 await Promise.all([w.internal({type:'approve',id:p.id}),w.internal({type:'approve',id:p.id})]);assert.equal(w.actions.length,1);
});
test('tab list excludes private/internal pages and strips query/fragment before returning',async()=>{
 const w=worker();const p=await w.external({type:'propose',action:{op:'list'}});await w.internal({type:'approve',id:p.id});
 const result=(await w.external({type:'result',id:p.id})).result;
 assert.deepEqual(result.tabs,[{id:10,title:'Página',url:'https://example.org/path'}]);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|private.example|secret/);
});
test('read/fill require the target active tab; no generic execute operation is available',async()=>{
 const w=worker();let p=await w.external({type:'propose',action:{op:'read',tabId:11}});assert.equal((await w.internal({type:'approve',id:p.id})).state,'failed');assert.equal(w.actions.length,0);
 p=await w.external({type:'propose',action:{op:'read',tabId:10}});assert.equal((await w.internal({type:'approve',id:p.id})).state,'completed');assert.equal(w.actions.length,1);
 assert.equal(w.actions[0].func,contract.pageOperation);assert.equal(w.actions[0].target.tabId,10);
});
test('manifest grants no cookie/debugger/native host/blanket-site access',()=>{
 const manifest=JSON.parse(fs.readFileSync('extensions/jarvis-browser/manifest.json','utf8'));
 assert.deepEqual(manifest.permissions,['tabs','storage','activeTab','scripting']);assert.equal(manifest.host_permissions,undefined);assert.equal(manifest.incognito,'not_allowed');
 assert.deepEqual(manifest.externally_connectable.matches,[origin+'/*']);
});
test('private download checks owner first and includes source files only',async()=>{
 const source=ts.transpileModule(fs.readFileSync('app/api/director/browser-extension/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 let archives=0;
 function api(allowed){const exports={};new Function('exports','require',source)(exports,name=>name.endsWith('/auth')?{authorized:async()=>allowed}:{extensionArchive:async()=>{archives++;return Buffer.from('zip');}});return exports;}
 assert.equal((await api(false).GET()).status,401);assert.equal(archives,0);
 const response=await api(true).GET();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(archives,1);
});
test('page fill requires one visible exact label, rejects sensitive autocomplete and never submits',()=>{
 const saved={document:globalThis.document,HTMLInputElement:globalThis.HTMLInputElement};
 let submissions=0,events=[];
 class Input{constructor(){this.type='text';this.name='search';this.id='search';this.autocomplete='off';this.labels=[{textContent:'Pesquisar'}];this.disabled=false;this.readOnly=false;}get value(){return this.saved||'';}set value(v){this.saved=v;}getBoundingClientRect(){return {width:200,height:30};}getAttribute(){return null;}dispatchEvent(e){events.push(e.type);}submit(){submissions++;}}
 const input=new Input();globalThis.HTMLInputElement=Input;let fields=[input];
 globalThis.document={querySelectorAll:()=>fields,body:{innerText:'x'.repeat(9000)}};
 try{
  assert.deepEqual(contract.pageOperation('fill','Pesquisar','texto aprovado'),{filled:true,submitted:false});assert.equal(input.value,'texto aprovado');assert.deepEqual(events,['input','change']);assert.equal(submissions,0);
  fields=[input,new Input()];assert.throws(()=>contract.pageOperation('fill','Pesquisar','x'),/NOT_UNIQUE/);
  fields=[input];input.autocomplete='one-time-code';assert.throws(()=>contract.pageOperation('fill','Pesquisar','123456'),/SENSITIVE_FIELD/);
  const read=contract.pageOperation('read');assert.equal(read.text.length,8000);assert.equal(read.truncated,true);assert.equal(read.untrusted,true);
 }finally{Object.assign(globalThis,saved);}
});
test('download archive contains exactly the six reviewed files and valid directory offsets',async()=>{
 const source=ts.transpileModule(fs.readFileSync('lib/browser/extension-archive.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('exports','require',source)(exports,name=>name==='server-only'?{}:name==='node:path'?{join:(...parts)=>parts.join('/')}:{readFile:async p=>fs.readFileSync(p)});
 const zip=await exports.extensionArchive();const end=zip.length-22;assert.equal(zip.readUInt32LE(end),0x06054b50);assert.equal(zip.readUInt16LE(end+10),6);
 let offset=0;const names=[];
 while(zip.readUInt32LE(offset)===0x04034b50){const size=zip.readUInt32LE(offset+18),len=zip.readUInt16LE(offset+26),name=zip.subarray(offset+30,offset+30+len).toString();names.push(name);assert.deepEqual(zip.subarray(offset+30+len,offset+30+len+size),fs.readFileSync('extensions/jarvis-browser/'+name));offset+=30+len+size;}
 assert.deepEqual(names,exports.EXTENSION_FILES);assert.equal(zip.readUInt32LE(offset),0x02014b50);assert.equal(zip.readUInt32LE(end+16),offset);
});
