const fs = require('node:fs');
const crypto = require('node:crypto');
const source = JSON.parse(fs.readFileSync('/tmp/jarvis-current-ingress-check.json','utf8'))[0];
const credentials = source.nodes.find(n=>n.type.endsWith('.webhook')).credentials;
if(!credentials?.httpHeaderAuth)throw Error('Existing ingress credential reference required');
const workflow = {
 id:'JkCatalogReadRun01',name:'Jarvis Kiro | Relatório real do catálogo (Preview)',active:false,
 nodes:[
  {id:'catalog-webhook',webhookId:crypto.randomUUID(),name:'Receber relatório autorizado pelo Jarvis',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],credentials,parameters:{httpMethod:'POST',path:'jarvis-kiro/catalog-report-v1',authentication:'headerAuth',responseMode:'responseNode',options:{}}},
  {id:'catalog-binding',name:'Reter somente ticket e referência',type:'n8n-nodes-base.code',typeVersion:2,position:[260,0],parameters:{jsCode:`const b=$input.first().json.body;if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).length!==5||typeof b.runId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(b.runId)||typeof b.ticket!=='string'||!/^[a-f0-9]{64}$/.test(b.ticket)||typeof b.inputDigest!=='string'||!/^[a-f0-9]{64}$/.test(b.inputDigest)||typeof b.partial!=='boolean'||!Array.isArray(b.items)||b.items.length>100||b.items.some(w=>!w||typeof w.id!=='string'||w.id.length>100||typeof w.name!=='string'||w.name.length>150||typeof w.active!=='boolean'))throw Error('INVALID_CATALOG_REPORT_CONTRACT');return [{json:{runId:b.runId,inputDigest:b.inputDigest,ticket:b.ticket,report:{total:b.items.length,active:b.items.filter(w=>w.active).length,partial:b.partial,names:b.items.slice(0,20).map(w=>w.name)}}}];`}},
  {id:'catalog-response',name:'Devolver resultado confirmado ao Jarvis',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[780,0],parameters:{respondWith:'json',responseBody:'={{ $json }}',options:{}}},
 ],connections:{
  'Receber relatório autorizado pelo Jarvis':{main:[[{node:'Reter somente ticket e referência',type:'main',index:0}]]},
  'Reter somente ticket e referência':{main:[[{node:'Devolver resultado confirmado ao Jarvis',type:'main',index:0}]]},
 },settings:{executionOrder:'v1',saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false}
};
fs.writeFileSync('/tmp/jarvis-catalog-report.json',JSON.stringify([workflow]));
console.log('Prepared read-only catalog workflow; filtered metadata and bound response only, no reverse callback.');
