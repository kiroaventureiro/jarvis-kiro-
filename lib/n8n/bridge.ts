import "server-only";
import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { connectorStore } from "../connectors/server";
type Job={id:string;workflow:string;payload:Record<string,string>;state:"queued"|"leased"|"executing"|"completed"|"failed";createdAt:string;leaseUntil?:number;result?:string;attempts:number};
type Queue={jobs:Job[]};
function authorizedSecret(value:string|null){const secret=process.env.JARVIS_N8N_BRIDGE_SECRET||"";if(secret.length<40||!value?.startsWith("Bearer "))return false;const token=value.slice(7);const a=createHash("sha256").update(token).digest(),b=createHash("sha256").update(secret).digest();return timingSafeEqual(a,b);}
export function bridgeAuth(header:string|null){return authorizedSecret(header);}
export function bridgeEnabled(){return connectorStore.configured()&&!!process.env.JARVIS_N8N_BRIDGE_SECRET&&process.env.JARVIS_N8N_BRIDGE_SECRET.length>=40;}
function queue(state: {n8nBridge?:Queue}):Queue {return state.n8nBridge??{jobs:[]};}
export async function enqueue(workflow:string,payload:Record<string,string>){
 if(!bridgeEnabled())throw Error("BRIDGE_NOT_CONFIGURED");
 if(!["project_report","broadcast_health","social_performance","daily_briefing"].includes(workflow))throw Error("WORKFLOW_NOT_ALLOWED");
 if(Object.keys(payload).length>8||JSON.stringify(payload).length>2000||Object.values(payload).some(v=>typeof v!=="string"))throw Error("INVALID_PAYLOAD");
 const job:Job={id:randomUUID(),workflow,payload,state:"queued",createdAt:new Date().toISOString(),attempts:0};
 await connectorStore.update(s=>{const q=queue(s);if(q.jobs.filter(j=>j.state==="queued"||j.state==="leased").length>=30)throw Error("QUEUE_FULL");q.jobs=[...q.jobs.filter(j=>Date.now()-Date.parse(j.createdAt)<86400000).slice(-99),job];s.n8nBridge=q;});
 return {id:job.id,state:job.state};
}
/** Queue only an owner-approved, GitHub-only change. Never pass provider credentials to n8n. */
export async function enqueueApprovedGithubPlan(planId:string,session:string){
 if(!bridgeEnabled())throw Error("BRIDGE_NOT_CONFIGURED");
 const state=await connectorStore.read();
 const plan=state.plans.find(p=>p.id===planId);
 if(!plan||plan.status!=="approved"||plan.approval?.session!==session||
    plan.conversationSession!==session||plan.expiresAt<Date.now()||
    !plan.steps.length||plan.steps.some(step=>step.action.provider!=="github"||
      !["branch","commit","pull"].includes(step.action.operation)))
    throw Error("GITHUB_PLAN_NOT_APPROVED");
 return connectorStore.update(s=>{
  const q=queue(s);
  const current=s.plans.find(p=>p.id===planId);
  if(!current||current.status!=="approved"||current.approval?.session!==session)throw Error("PLAN_CHANGED");
  const existing=[...q.jobs].reverse().find(j=>j.workflow==="github_plan_execute"&&j.payload.planId===planId);
  if(existing&&existing.state!=="failed")return {id:existing.id,state:existing.state};
  const job:Job={id:randomUUID(),workflow:"github_plan_execute",payload:{planId,digest:current.digest},state:"queued",createdAt:new Date().toISOString(),attempts:0};
  if(q.jobs.filter(j=>["queued","leased","executing"].includes(j.state)).length>=30)throw Error("QUEUE_FULL");
  q.jobs=[...q.jobs.filter(j=>Date.now()-Date.parse(j.createdAt)<86400000).slice(-99),job];
  s.n8nBridge=q;
  return {id:job.id,state:"queued" as const};
 });
}
function executionTicket(id:string,planId:string,digest:string){
 return createHmac("sha256",process.env.JARVIS_N8N_BRIDGE_SECRET||"").update(id+"."+planId+"."+digest).digest("hex");
}
export async function claimGithubExecution(jobId:string,planId:string,digest:string,ticket:string){
 if(!bridgeEnabled()||!/^[0-9a-f-]{36}$/.test(jobId)||!/^[a-f0-9]{64}$/.test(ticket))throw Error("BRIDGE_DENIED");
 const expected=executionTicket(jobId,planId,digest);
 if(!timingSafeEqual(Buffer.from(ticket),Buffer.from(expected)))throw Error("BRIDGE_DENIED");
 return connectorStore.update(s=>{
  const job=queue(s).jobs.find(j=>j.id===jobId);
  const plan=s.plans.find(p=>p.id===planId);
  if(!job||job.workflow!=="github_plan_execute"||job.state!=="leased"||
    (job.leaseUntil||0)<Date.now()||job.payload.planId!==planId||
    job.payload.digest!==digest||!plan||plan.digest!==digest||
    plan.status!=="approved"||!plan.approval||
    plan.conversationSession!==plan.approval.session||plan.expiresAt<Date.now()||
    !plan.steps.every(step=>step.action.provider==="github"&&["branch","commit","pull"].includes(step.action.operation)))
    throw Error("GITHUB_EXECUTION_DENIED");
  job.state="executing";
  job.leaseUntil=Date.now()+120000;
  s.n8nBridge=queue(s);
  return {session:plan.approval.session};
 });
}
export async function finishGithubExecution(jobId:string,ok:boolean,result:string){
 if(!bridgeEnabled())throw Error("BRIDGE_NOT_CONFIGURED");
 return connectorStore.update(s=>{
  const q=queue(s),job=q.jobs.find(j=>j.id===jobId);
  if(!job||job.workflow!=="github_plan_execute"||job.state!=="executing")throw Error("JOB_STATE_INVALID");
  job.state=ok?"completed":"failed";
  job.result=result.replace(/[\r\n\t]/g," ").slice(0,1800);
  s.n8nBridge=q;
  return {id:jobId,state:job.state,result:job.result};
 });
}
export async function lease(){
 if(!bridgeEnabled())throw Error("BRIDGE_NOT_CONFIGURED");
 return connectorStore.update(s=>{const q=queue(s);const now=Date.now();const job=q.jobs.find(j=>j.state==="queued"||(j.workflow!=="github_plan_execute"&&j.state==="leased"&&(j.leaseUntil||0)<now&&j.attempts<3));if(!job)return {protocolVersion:2,build:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,8)||"local",job:null};job.state="leased";job.attempts++;job.leaseUntil=now+120000;s.n8nBridge=q;return {protocolVersion:2,build:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,8)||"local",job:{id:job.id,workflow:job.workflow,payload:job.payload,...(job.workflow==="github_plan_execute"?{ticket:executionTicket(job.id,job.payload.planId,job.payload.digest)}:{})},leaseSeconds:120};});
}
export async function finish(id:string,ok:boolean,result:string){
 if(!bridgeEnabled())throw Error("BRIDGE_NOT_CONFIGURED");
 if(!/^[0-9a-f-]{36}$/.test(id)||result.length>2000)throw Error("INVALID_RESULT");
 return connectorStore.update(s=>{const q=queue(s),job=q.jobs.find(j=>j.id===id);if(!job||job.state!=="leased"||(job.workflow==="github_plan_execute"&&ok))throw Error("JOB_NOT_LEASED");job.state=ok?"completed":"failed";job.result=result.replace(/[\r\n\t]/g," ").slice(0,2000);s.n8nBridge=q;return {id:job.id,state:job.state};});
}
export async function status(){if(!bridgeEnabled())return {enabled:false};const q=queue(await connectorStore.read());return {enabled:true,jobs:q.jobs.slice(-30).map(j=>({id:j.id,workflow:j.workflow,state:j.state,createdAt:j.createdAt,attempts:j.attempts,result:j.result||null}))};}
