import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture({authenticated=true,origin=true,vaultFails=false}={}) {
 const calls=[];const exports={};
 const stubs={
  'next/headers':{cookies:async()=>({get:()=>({value:'test-session'})})},
  'next/server':{NextResponse:Response},
 };
 const require=id=>{
  if(stubs[id])return stubs[id];
  if(id.endsWith('/auth'))return {authorized:async()=>authenticated,cookieName:'fixture'};
  if(id.endsWith('/connectors/server'))return {connectorStore:{configured:()=>true},connectorOAuth:{configured:()=>false},connectors:{verifySavedConnections:async()=>{calls.push('native');if(vaultFails)throw Error('private vault error');return {results:[{provider:'github',state:'verified'}]}}}};
  if(id.endsWith('/security'))return {originAllowed:()=>origin,requestOriginStatus:()=>({allowed:origin,reason:origin?"ALLOWED":"ORIGIN_NOT_ALLOWED"}),jsonBody:r=>r.json(),hash:()=>'',publicError:()=>({status:503,error:'Unavailable'})};
  if(id.endsWith('/types'))return {ConnectorError:Error};
  if(id.endsWith('/oauth'))return {oauthApps:()=>({origin:'https://jarvis.test'})};
  if(id.endsWith('/hub-server'))return {abacusHub:async verify=>{assert.equal(verify,true);calls.push('abacus');return {state:'verified',observation:{privateAccount:'must-not-escape'},discovery:{models:[{id:'route-llm'}],tools:[{name:'private-tool'}],toolsState:'verified',checkedAt:'2026-10-29T00:00:00Z'}}}};
  if(id.endsWith('/voicestudio'))return {inspectVoiceStudio:async()=>{calls.push('studio');return {state:'not_configured'}}};
  throw Error('Unexpected import '+id);
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/director/connectors/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,Response,URL,process:{env:{}}});
 return {calls,get:()=>exports.GET(new Request("https://jarvis.test/api/director/connectors?diagnostics=1")),post:()=>exports.POST(new Request('https://jarvis.test/api/director/connectors',{method:'POST',body:JSON.stringify({op:'verify_saved'})}))};
}
test('actual verification route checks independent services and returns counts, never private catalogs',async()=>{
 const f=fixture();const response=await f.post();const result=await response.json();
 assert.equal(response.status,200);assert.equal(result.abacus.models,1);assert.equal(result.abacus.tools,1);
 assert.equal(result.abacus.generationTested,false);assert.equal(result.voiceStudio.speechVerified,false);
 assert.equal(JSON.stringify(result).includes('private-tool'),false);assert.equal(JSON.stringify(result).includes('must-not-escape'),false);
 assert.deepEqual(f.calls.sort(),['abacus','native','studio']);
 assert.match(response.headers.get('cache-control'),/no-store/);
});
test('vault failure does not hide an independently verified Abacus catalog',async()=>{
 const f=fixture({vaultFails:true});const body=await (await f.post()).json();
 assert.equal(body.abacus.state,'verified');assert.equal(body.results.length,3);
 assert.ok(body.results.every(x=>x.state==='failed'));assert.equal(JSON.stringify(body).includes('private vault error'),false);
});
test('login and origin checks run before any probe',async()=>{
 for(const [options,status] of [[{authenticated:false},401],[{origin:false},403]]){
  const f=fixture(options);assert.equal((await f.post()).status,status);assert.deepEqual(f.calls,[]);
 }
});

test('setup diagnostics require owner session, avoid vault reads and reveal no credentials',async()=>{
 const denied=fixture({authenticated:false});assert.equal((await denied.get()).status,401);assert.deepEqual(denied.calls,[]);
 const f=fixture();const response=await f.get();assert.equal(response.status,200);const body=await response.json();assert.equal(body.noProviderCalls,true);assert.equal(body.vaultConfigured,true);assert.equal(body.missingVaultSettings.length,3);assert.equal(body.writePolicyPresent,false);assert.deepEqual(f.calls,[]);assert.equal(JSON.stringify(body).includes('private'),false);
});
