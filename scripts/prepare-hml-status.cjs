const fs=require('fs');
const all=JSON.parse(fs.readFileSync('/tmp/jarvis-audit-current.json','utf8'));
const source=all.find(w=>w.id==='Nl5yDkChDLKNIEEn');
if(!source)throw Error('HML ingress not found');
const webhookCredentials=source.nodes.find(n=>n.type.endsWith('.webhook')).credentials;
const dbCredentials=source.nodes.find(n=>n.type.endsWith('.postgres')).credentials;
if(!webhookCredentials?.httpHeaderAuth||!dbCredentials?.postgres)throw Error('Missing existing credential reference');
const query=`SELECT COALESCE((
 SELECT jsonb_build_object('found',true,'environment','homologation','jobId',c.job_id,'planId',c.plan_id,
 'digest',c.digest,'jobState',c.job_state,'externalActionPerformed',false,'result',
 CASE WHEN o.event_id IS NULL THEN NULL ELSE jsonb_build_object('resultRef',o.result_ref,'resultDigest',o.result_digest,'simulated',o.simulated) END)
 FROM jk_hml.commands c
 LEFT JOIN LATERAL (SELECT * FROM jk_hml.outbox x WHERE x.job_id=c.job_id ORDER BY x.created_at DESC LIMIT 1) o ON true
 WHERE c.job_id=$1::text AND c.plan_id=$2::text AND c.digest=$3::text
 AND c.environment='homologation' AND c.authenticated_origin='jarvis-kiro-hml'
),jsonb_build_object('found',false)) AS body;`;
const workflow={id:'JkHmlStatusRead01',name:'JK | HML | Consultar estado e resultado',active:false,
nodes:[
 {id:'status-webhook',name:'Receber consulta autenticada HML',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],parameters:{httpMethod:'POST',path:'jk-hml/v1/status',authentication:'headerAuth',responseMode:'responseNode',options:{}},credentials:webhookCredentials},
 {id:'status-reference',name:'Validar referencia sem reter cabecalhos',type:'n8n-nodes-base.code',typeVersion:2,position:[260,0],parameters:{jsCode:`const b=$input.first().json.body;const id=/^[A-Za-z0-9_-]{1,128}$/;const valid=b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).length===3&&Object.keys(b).every(k=>['jobId','planId','digest'].includes(k))&&typeof b.jobId==='string'&&id.test(b.jobId)&&typeof b.planId==='string'&&id.test(b.planId)&&typeof b.digest==='string'&&/^[a-f0-9]{64}$/.test(b.digest);return [{json:{jobId:valid?b.jobId:'',planId:valid?b.planId:'',digest:valid?b.digest:''}}];`}},
 {id:'status-query',name:'Consultar somente resultado vinculado',type:'n8n-nodes-base.postgres',typeVersion:2.6,position:[520,0],parameters:{operation:'executeQuery',query,options:{connectionTimeout:5,queryBatching:'single',queryReplacement:'={{ [$json.jobId,$json.planId,$json.digest] }}'}},credentials:dbCredentials},
 {id:'status-response',name:'Retornar estado confirmado ao Jarvis',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[780,0],parameters:{respondWith:'json',responseBody:'={{ $json.body }}',options:{responseCode:'={{ $json.body.found === true ? 200 : 404 }}'}}}
],connections:{
 'Receber consulta autenticada HML':{main:[[{node:'Validar referencia sem reter cabecalhos',type:'main',index:0}]]},
 'Validar referencia sem reter cabecalhos':{main:[[{node:'Consultar somente resultado vinculado',type:'main',index:0}]]},
 'Consultar somente resultado vinculado':{main:[[{node:'Retornar estado confirmado ao Jarvis',type:'main',index:0}]]}
},settings:{executionOrder:'v1',saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false}};
fs.writeFileSync('/tmp/jarvis-hml-status.json',JSON.stringify([workflow]));
console.log('Prepared authenticated read-only HML status workflow; existing credential references only.');
