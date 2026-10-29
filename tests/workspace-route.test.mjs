import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function fixture({authenticated=true,originAllowed=true}={}){
 const calls=[],cookieWrites=[],exports={};
 const code=ts.transpileModule(fs.readFileSync('app/api/director/workspace-connectors/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,Response,URL,process:{env:{JARVIS_CONNECTOR_ORIGIN:'https://jarvis.test'}},require:id=>{
  if(id==='next/headers')return {cookies:async()=>({get:()=>({value:'9999999999999.signature'}),set:(...v)=>cookieWrites.push(v)})};
  if(id.endsWith('/auth'))return {authorized:async()=>authenticated,cookieName:'fixture'};
  if(id.endsWith('/server'))return {connectorStore:{}};
  if(id.endsWith('/security'))return {originAllowed:()=>originAllowed,jsonBody:r=>r.json()};
  if(id.endsWith('/workspace'))return {WorkspaceConnectors:class{
   async overview(){calls.push('overview');return {providers:[]}}
   async start(provider,services,expiry){calls.push({provider,services,expiry});return {authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth',binding:'private-cookie-binding'}}
   async read(service){calls.push({read:service});return {items:[]}}
  }};
  throw Error('Unexpected import '+id);
 }});
 return {calls,cookieWrites,exports,post:body=>exports.POST(new Request('https://jarvis.test/api/director/workspace-connectors',{method:'POST',body:JSON.stringify(body)}))};
}
test('workspace route authenticates and checks origin before starting any authorization',async()=>{
 for(const [options,status]of [[{authenticated:false},401],[{originAllowed:false},403]]){const f=fixture(options);assert.equal((await f.post({op:'authorize',provider:'google',services:['gmail']})).status,status);assert.deepEqual(f.calls,[]);}
 const f=fixture({authenticated:false});assert.equal((await f.exports.GET()).status,401);
});
test('authorization binds to an HttpOnly SameSite browser cookie and never returns the binding',async()=>{
 const f=fixture();const r=await f.post({op:'authorize',provider:'google',services:['gmail']});const body=await r.json();assert.equal(r.status,200);assert.equal(body.authorizationUrl.startsWith('https://accounts.google.com/'),true);assert.equal(JSON.stringify(body).includes('private-cookie-binding'),false);
 assert.equal(f.cookieWrites[0][2].httpOnly,true);assert.equal(f.cookieWrites[0][2].sameSite,'lax');assert.equal(f.cookieWrites[0][2].secure,true);assert.equal(f.cookieWrites[0][2].maxAge,600);
});
