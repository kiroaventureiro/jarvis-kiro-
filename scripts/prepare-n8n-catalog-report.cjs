const fs = require('node:fs');
const crypto = require('node:crypto');
const source = JSON.parse(fs.readFileSync('/tmp/jarvis-current-ingress-check.json','utf8'))[0];
const credentials = source.nodes.find(n=>n.type.endsWith('.webhook')).credentials;
if(!credentials?.httpHeaderAuth)throw Error('Existing ingress credential reference required');
const workflow = {
 id:'JkCatalogReadRun01',name:'Jarvis Kiro | Relatório real do catálogo (Preview)',active:false,
 nodes:[
  {id:'catalog-webhook',webhookId:crypto.randomUUID(),name:'Receber relatório autorizado pelo Jarvis',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],credentials,parameters:{httpMethod:'POST',path:'jarvis-kiro/catalog-report-v1',authentication:'headerAuth',responseMode:'responseNode',options:{}}},
  {id:'catalog-binding',name:'Reter somente ticket e referência',type:'n8n-nodes-base.code',typeVersion:2,position:[260,0],parameters:{jsCode:`const b=$input.first().json.body;if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).length!==2||typeof b.runId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(b.runId)||typeof b.ticket!=='string'||!/^[a-f0-9]{64}$/.test(b.ticket))throw Error('INVALID_CATALOG_REPORT_TICKET');return [{json:{runId:b.runId,ticket:b.ticket}}];`}},
  {id:'catalog-callback',name:'Concluir leitura com ticket de uso único',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[520,0],parameters:{method:'POST',url:'https://jarvis-kiro-git-fix-hml-integration-audit-umiversokiro.vercel.app/api/director/n8n/catalog-complete',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify({runId:$json.runId,ticket:$json.ticket}) }}',options:{timeout:20000}}},
  {id:'catalog-response',name:'Devolver resultado confirmado ao Jarvis',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[780,0],parameters:{respondWith:'json',responseBody:'={{ $json }}',options:{}}},
 ],connections:{
  'Receber relatório autorizado pelo Jarvis':{main:[[{node:'Reter somente ticket e referência',type:'main',index:0}]]},
  'Reter somente ticket e referência':{main:[[{node:'Concluir leitura com ticket de uso único',type:'main',index:0}]]},
  'Concluir leitura com ticket de uso único':{main:[[{node:'Devolver resultado confirmado ao Jarvis',type:'main',index:0}]]},
 },settings:{executionOrder:'v1',saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false}
};
fs.writeFileSync('/tmp/jarvis-catalog-report.json',JSON.stringify([workflow]));
console.log('Prepared read-only catalog workflow; existing credential reference and fixed callback only.');
