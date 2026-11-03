import { setTimeout as sleep } from "node:timers/promises";
import crypto from "node:crypto";

const read = (name, fallback = "") => process.env[name] || fallback;
const env = read("JARVIS_WORKER_ENVIRONMENT", "preproduction");
if (!["preproduction", "production"].includes(env)) throw Error("INVALID_ENV");
const pre = env === "preproduction";
const jarvis = read("JARVIS_URL", pre
  ? "https://jarvis-kiro-preproducao.vercel.app"
  : "https://jarvis-kiro.vercel.app").replace(/\/$/, "");
const secret = read("JARVIS_N8N_BRIDGE_SECRET");
const n8nBase = read("N8N_BASE_URL").replace(/\/$/, "");
const n8nKey = read("N8N_API_KEY");
const bypass = read("JARVIS_VERCEL_PROTECTION_BYPASS");
const interval = Math.max(10, Math.min(120, Number(read("JARVIS_POLL_SECONDS", "15"))));
if (!jarvis.startsWith("https://") || secret.length < 40 || !n8nBase.startsWith("http") || !n8nKey) {
  throw Error("CLOUD_WORKER_MISSING_CONFIGURATION");
}
if (env === "production" && read("JARVIS_ENABLE_PRODUCTION") !== "true") {
  throw Error("PRODUCTION_NOT_EXPLICITLY_ENABLED");
}
const timeoutFetch = async (url, opts = {}, ms = 25000) => {
  const resp = await fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
  if (!resp.ok) throw Error("HTTP_" + resp.status + "_AT_" + new URL(url).pathname);
  return resp.json();
};
const n8nHeaders = { "X-N8N-API-KEY": n8nKey, "Content-Type": "application/json" };
const bridgeHeaders = { Authorization: "Bearer " + secret, "Cache-Control": "no-store" };
if (bypass) bridgeHeaders["x-vercel-protection-bypass"] = bypass;
const workflowPath = "jarvis-kiro-approved-github-" + env + "-v2";
const workflowName = "Jarvis Kiro - GitHub aprovado (" + env + ")";
const workflow = {
  name: workflowName,
  nodes: [
    { id: crypto.randomUUID(), name: "Receber tarefa Jarvis", type: "n8n-nodes-base.webhook",
      typeVersion: 2, position: [240, 300], webhookId: crypto.randomUUID(),
      parameters: { httpMethod: "POST", path: workflowPath, responseMode: "lastNode", options: {} } },
    { id: crypto.randomUUID(), name: "Executar plano GitHub aprovado", type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2, position: [510, 300], parameters: {
        method: "POST", url: jarvis + "/api/director/n8n-bridge/execute",
        sendHeaders: true, headerParameters: { parameters: [
          { name: "Content-Type", value: "application/json" },
          { name: "x-vercel-protection-bypass", value: "={{ $json.body.vercelBypass }}" }
        ] }, sendBody: true, specifyBody: "json",
        jsonBody: "={{ JSON.stringify({jobId:$json.body.jobId,planId:$json.body.planId,digest:$json.body.digest,ticket:$json.body.ticket}) }}",
        options: { timeout: 100000 }
      } }
  ],
  connections: { "Receber tarefa Jarvis": { main: [[{node:"Executar plano GitHub aprovado",type:"main",index:0}]] } },
  settings: {executionOrder:"v1",saveDataSuccessExecution:"none",saveDataErrorExecution:"none",saveManualExecutions:false}
};
const n8nApi = n8nBase + "/api/v1";
async function activateWorkflow() {
  const collection = await timeoutFetch(n8nApi + "/workflows?limit=100", {headers:n8nHeaders});
  const matches = (collection.data || []).filter(x => x.name === workflowName);
  if (matches.length > 1) throw Error("DUPLICATE_WORKFLOWS");
  const previous = matches[0];
  let id = previous?.id;
  if (previous) {
    const current = await timeoutFetch(n8nApi + "/workflows/" + id, {headers:n8nHeaders});
    const node = current.nodes?.find(x => x.name === "Executar plano GitHub aprovado");
    if (!node || current.nodes.length !== 2 || node.type !== "n8n-nodes-base.httpRequest") throw Error("WORKFLOW_UNEXPECTED_CHANGE");
    if (node.parameters?.url !== workflow.nodes[1].parameters.url) {
      if (previous.active) await timeoutFetch(n8nApi + "/workflows/" + id + "/deactivate", {
        method:"POST",headers:n8nHeaders,body:"{}"
      });
      const updated = {...workflow,nodes:current.nodes.map(n => n.name===node.name
        ? {...n,parameters:{...n.parameters,url:jarvis+"/api/director/n8n-bridge/execute"}}
        : n)};
      await timeoutFetch(n8nApi + "/workflows/" + id, {
        method:"PUT",headers:n8nHeaders,body:JSON.stringify(updated)
      });
    } else if (previous.active) {
      return id;
    }
  } else {
    const created = await timeoutFetch(n8nApi+"/workflows", {
      method:"POST",headers:n8nHeaders,body:JSON.stringify(workflow)
    });
    id = created.id;
  }
  try { await timeoutFetch(n8nApi+"/workflows/"+id+"/publish",{method:"POST",headers:n8nHeaders,body:"{}"}); }
  catch { /* n8n versions differ; activation is checked below. */ }
  await timeoutFetch(n8nApi+"/workflows/"+id+"/activate",{method:"POST",headers:n8nHeaders,body:"{}"});
  return id;
}
const n8nWebhook = n8nBase+"/webhook/"+workflowPath;
async function work(job) {
  if (job.workflow !== "github_plan_execute") {
    await timeoutFetch(jarvis+"/api/director/n8n-bridge",{
      method:"POST",headers:{...bridgeHeaders,"Content-Type":"application/json"},
      body:JSON.stringify({id:job.id,ok:false,result:"Workflow não suportado pelo worker cloud."})
    });
    return;
  }
  if (!/^[a-f0-9]{64}$/.test(job.ticket || "")) throw Error("INVALID_EXECUTION_TICKET");
  const receipt = await timeoutFetch(n8nWebhook, {
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      jobId:job.id,planId:job.payload.planId,digest:job.payload.digest,
      ticket:job.ticket,vercelBypass:bypass
    })
  },120000);
  if (receipt.ok === true && /^https:\/\/github\.com\//.test(receipt.prUrl||"")) {
    console.log("PR confirmado:", receipt.prUrl);
  } else {
    console.log("Tarefa encaminhada; confirmação pendente no cofre Jarvis.");
  }
}
console.log("Jarvis cloud worker iniciado:", env, jarvis);
let backoff = interval;
while (true) {
  try {
    const response = await timeoutFetch(jarvis+"/api/director/n8n-bridge",{headers:bridgeHeaders});
    if (response.protocolVersion!==2 || response.deploymentEnvironment!==(pre?"preview":"production")) {
      throw Error("INCOMPATIBLE_JARVIS_ENVIRONMENT");
    }
    backoff=interval;
    if (response.job) {
      try { await work(response.job); }
      catch(e) {console.error("Execução incerta, não repetir:",e.message); }
    }
  } catch(e) {
    console.error("Worker:", e.message);
    if (e.message==="INCOMPATIBLE_JARVIS_ENVIRONMENT") process.exit(1);
    backoff=Math.min(120,backoff*2);
  }
  await sleep(backoff*1000);
}
