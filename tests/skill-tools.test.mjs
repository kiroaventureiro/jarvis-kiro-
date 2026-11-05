import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(path, dependencies={}) {
  const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};new Function('exports','require',code)(exports,name=>{
    if(name==='server-only')return {};
    if(!(name in dependencies))throw Error('Unexpected dependency '+name);
    return dependencies[name];
  });return exports;
}
const skills=load('lib/cognitive/codex-skill-catalog.ts');
const agents=load('lib/cognitive/codex-agent-roles.ts');
const bindings=load('lib/cognitive/skill-tools.ts',{'./codex-skill-catalog':skills,'./codex-agent-roles':agents});
function runtime({connected=true,readError=false}={}) {
 let reads=0,checks=0;
 const state={connections:{github:{status:'connected',grants:['read'],resources:[{id:'repo'}],verifiedAt:'2026-11-05',credentials:{accessToken:'PRIVATE_TOKEN'}}},n8n:connected?{apiKey:'PRIVATE_API_KEY'}:undefined};
 const discovery=load('lib/cognitive/skill-discovery.ts',{
  '../connectors/server':{connectorStore:{configured:()=>true,read:async()=>{reads++;return state;}}},
  '../n8n/connection':{listN8nWorkflows:async()=>{checks++;if(readError)throw Error('PRIVATE_ERROR');return {workflows:[{id:'one'}],partial:false};}},
  '../n8n/catalog-run':{catalogReportConfigured:()=>true},'./skill-tools':bindings,
 });return {api:discovery,reads:()=>reads,checks:()=>checks};
}
test('all 20 skills and four roles have explicit tool bindings without claiming executable agents',()=>{
 assert.equal(bindings.skillToolBindings().length,20);assert.equal(bindings.agentToolBindings().length,4);
 for(const skill of bindings.skillToolBindings()) {assert.ok(skill.tools.length);assert.ok(skill.requirement.length>30);assert.equal(skill.independentExecution,false);}
 assert.deepEqual(bindings.skillToolBindings().find(s=>s.id==='sql-optimization-patterns').tools,['github.file','github.tree']);
 for(const skill of skills.CODEX_SKILLS)assert.equal(skills.selectCodexSkills('Use o skill '+skill.id)[0].id,skill.id);
 for(const role of agents.CODEX_AGENT_ROLES)assert.equal(agents.selectCodexAgents('Use o perfil '+role.id)[0].id,role.id);
 assert.deepEqual(skills.selectCodexSkills('Use not-sast-configuration-extra'),[]);
});
test('discovery checks n8n only on request and never exports credentials, arbitrary errors or resource names',async()=>{
 const r=runtime();let result=await r.api.discoverSkillTools();assert.equal(r.checks(),0);assert.equal(result.n8n.verifiedNow,false);
 result=await r.api.discoverSkillTools(true);assert.equal(r.checks(),1);assert.equal(result.n8n.workflowCount,1);
 assert.equal(result.skills.find(s=>s.id==='code-review-excellence').tools[0].verifiedNow,true);
 assert.equal(result.skills.find(s=>s.id==='git-advanced-workflows').tools[0].authorized,true);
 assert.equal(result.skills.find(s=>s.id==='git-advanced-workflows').tools[0].verifiedNow,false);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|accessToken|apiKey/);
 assert.equal(result.runnerAvailable,false);assert.equal(result.autonomousAgentsAvailable,false);
});
test('failed and disconnected n8n states never become successful reads',async()=>{
 const failed=runtime({readError:true});const result=await failed.api.discoverSkillTools(true);
 assert.equal(result.n8n.authorized,true);assert.equal(result.n8n.verifiedNow,false);assert.equal(result.n8n.workflowCount,null);
 assert.equal(result.n8n.error,'N8N_READ_NOT_CONFIRMED');assert.doesNotMatch(JSON.stringify(result),/PRIVATE_/);
 const disconnected=runtime({connected:false});const offline=await disconnected.api.discoverSkillTools(true);
 assert.equal(disconnected.checks(),0);assert.equal(offline.n8n.reportConfigured,false);
});
test('skill inventory intent works with n8n without intercepting report execution or unrelated engineering',async()=>{
 const r=runtime();assert.equal(await r.api.answerSkillRequest('Jarvis, gere um relatório dos workflows no n8n'),null);
 assert.equal(r.reads(),0);assert.equal(bindings.skillInventoryIntent('Revise o código TypeScript'),false);
 assert.equal(bindings.skillInventoryIntent('Quais agentes estão disponíveis na Abacus?'),false);
 assert.equal(bindings.skillInventoryIntent('Quais skills e agentes estão disponíveis no n8n?'),true);
 const reply=await r.api.answerSkillRequest('Quais skills e agentes estão disponíveis no n8n?');
 assert.match(reply.text,/20 skills/);assert.match(reply.text,/4 perfis/);assert.match(reply.text,/Consultei agora o n8n/);
 assert.match(reply.text,/próprios executores/);assert.equal(r.checks(),1);
});
test('inventory endpoint authenticates before discovery and returns private no-store responses',async()=>{
 let calls=0;
 const route=(allowed)=>load('app/api/director/local-skills/route.ts',{
  'next/server':{NextResponse:{json:(data,options)=>Response.json(data,options)}},
  '../../../../lib/auth':{authorized:async()=>allowed},
  '../../../../lib/jarvis-local-skills':{runLocalSkill:()=>{throw Error('No execution allowed');}},
  '../../../../lib/cognitive/codex-skill-catalog':skills,
  '../../../../lib/cognitive/codex-agent-roles':agents,
  '../../../../config/jarvis-local-skills.json':{default:{skills:[]}},
  '../../../../lib/cognitive/skill-discovery':{discoverSkillTools:async(verify)=>{calls++;return {verified:verify};}},
 });
 const url='https://jarvis.example/api/director/local-skills';
 assert.equal((await route(false).GET(new Request(url+'?verify=1'))).status,401);assert.equal(calls,0);
 const response=await route(true).GET(new Request(url+'?verify=1'));
 assert.equal(response.headers.get('cache-control'),'no-store');
 const data=await response.json();assert.equal(data.engineering.length,20);assert.equal(data.specialistAgents.length,4);assert.equal(data.tooling.verified,true);
 const cached=await route(true).GET(new Request(url));assert.equal((await cached.json()).tooling.verified,false);
});
