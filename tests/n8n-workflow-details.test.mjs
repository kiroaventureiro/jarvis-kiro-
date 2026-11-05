import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('lib/n8n/workflow-details.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const api={};new Function('exports',code)(api);
const workflow={id:'workflow_1',name:'JK | HML | Entrada de comandos',active:true,
 nodes:[{id:'node_1',name:'Receber',type:'n8n-nodes-base.webhook',parameters:{path:'private',secret:'do-not-expose'},credentials:{headerAuth:{id:'secret',name:'private-account'}},disabled:false}],
 settings:{executionOrder:'v1',timezone:'America/Sao_Paulo',saveManualExecutions:false,executionTimeout:30,errorWorkflow:'private-workflow',unknown:'do-not-expose'},
 pinData:{secret:'do-not-expose'},staticData:{token:'do-not-expose'}};
const connectionCode=ts.transpileModule(fs.readFileSync('lib/n8n/connection.ts','utf8').replace(/^import .*;\r?\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function connection(response=Response.json(workflow),connected=true){
 const exports={},calls=[];
 new Function('exports','lookup','isIP','connectorStore','summarizeWorkflow','fetch','process',connectionCode)(exports,
  async()=>[{address:'1.1.1.1'}],()=>0,{read:async()=>connected?{n8n:{baseUrl:'https://n8n.guardioesdaorigem.com.br',apiKey:'private-api-key'}}:{}},api.summarizeWorkflow,
  async(...args)=>{calls.push(args);return response;},{env:{JARVIS_N8N_ALLOWED_HOST:'n8n.guardioesdaorigem.com.br'}});
 return {api:exports,calls};
}
test('details reads only the fixed authenticated API path and never sends a mutation',async()=>{
 const r=connection();const result=await r.api.n8nWorkflowDetails('workflow_1');
 assert.equal(result.id,'workflow_1');assert.equal(r.calls.length,1);
 assert.equal(r.calls[0][0],'https://n8n.guardioesdaorigem.com.br/api/v1/workflows/workflow_1');
 assert.equal(r.calls[0][1].method,'GET');assert.equal(r.calls[0][1].redirect,'error');
 assert.equal(r.calls[0][1].headers['X-N8N-API-KEY'],'private-api-key');assert.doesNotMatch(JSON.stringify(result),/private-api-key/);
});
test('details rejects path injection, disconnected accounts, upstream errors and excessive bodies',async()=>{
 const r=connection();await assert.rejects(r.api.n8nWorkflowDetails('../credentials'),/N8N_WORKFLOW_ID_INVALID/);assert.equal(r.calls.length,0);
 await assert.rejects(connection(undefined,false).api.n8nWorkflowDetails('workflow_1'),/N8N_NOT_CONNECTED/);
 await assert.rejects(connection(Response.json({error:'missing'},{status:404})).api.n8nWorkflowDetails('workflow_1'),/N8N_WORKFLOW_NOT_FOUND/);
 await assert.rejects(connection(new Response('<html/>')).api.n8nWorkflowDetails('workflow_1'),/N8N_RESPONSE_INVALID/);
 await assert.rejects(connection(new Response('x'.repeat(1024*1024+1))).api.n8nWorkflowDetails('workflow_1'),/N8N_RESPONSE_TOO_LARGE/);
});
test('administrative verification rejects login pages and malformed 200 receipts',async()=>{
 for(const response of [new Response('<html>login</html>'),Response.json({error:'denied'}),Response.json({data:[{}]})])
  await assert.rejects(connection(response).api.verifyN8n('https://n8n.guardioesdaorigem.com.br','private-api-key'),/N8N_RESPONSE_INVALID/);
 const r=connection(Response.json({data:[{id:'workflow_1',name:'Workflow',parameters:{secret:'private'}}],nextCursor:'next'}));
 const result=await r.api.listN8nWorkflows();assert.equal(result.partial,true);assert.equal(result.executionEnabled,false);assert.doesNotMatch(JSON.stringify(result),/private/);
});
test('workflow structure returns an allowlist without raw node parameters, credentials or execution data',()=>{
 const detail=api.summarizeWorkflow(workflow,'workflow_1');
 assert.equal(detail.active,true);assert.equal(detail.executionEnabled,false);
 assert.deepEqual(detail.nodes,[{id:'node_1',name:'Receber',type:'n8n-nodes-base.webhook',disabled:false}]);
 assert.deepEqual(detail.settings,{executionOrder:'v1',timezone:'America/Sao_Paulo',executionTimeout:30,saveManualExecutions:false});
 assert.doesNotMatch(JSON.stringify(detail),/do-not-expose|private-account|private-workflow|headerAuth/);
});
test('mismatched identifiers, malformed responses and excessive node counts are rejected',()=>{
 for(const value of [null,[],{...workflow,id:'other'},{...workflow,nodes:[{}]},{...workflow,nodes:Array(1001).fill(workflow.nodes[0])}])
  assert.throws(()=>api.summarizeWorkflow(value,'workflow_1'),/N8N_WORKFLOW_INVALID/);
});
test('natural detail requests resolve only one workflow from the authenticated catalog',()=>{
 const list=[{id:'workflow_1',name:workflow.name}];
 assert.equal(api.requestedWorkflowDetails('Veja a configuração do fluxo Entrada de comandos no n8n',list),'workflow_1');
 assert.equal(api.requestedWorkflowDetails('Detalhes do workflow workflow_1 no n8n',list),'workflow_1');
 assert.equal(api.requestedWorkflowDetails('Configuração do fluxo desconhecido no n8n',list),'select_workflow');
 assert.equal(api.requestedWorkflowDetails('Configuração do fluxo Entrada de comandos no n8n',[...list,{id:'workflow_2',name:'Entrada de comandos'}]),'select_workflow');
 assert.equal(api.requestedWorkflowDetails('Execute o workflow workflow_1 no n8n',list),null);
});
