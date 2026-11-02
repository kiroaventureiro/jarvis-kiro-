import "server-only";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { connectorStore } from "../connectors/server";
type Job={id:string;workflow:string;payload:Record<string,string>;state:"queued"|"leased"|"completed"|"failed";createdAt:string;leaseUntil?:number;result?:string;attempts:number};
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
export async function lease(){
 if(!bridgeEnabled())throw Error("BRIDGE_NOT_CONFIGURED");
 return connectorStore.update(s=>{const q=queue(s);const now=Date.now();const job=q.jobs.find(j=>j.state==="queued"||(j.state==="leased"&&(j.leaseUntil||0)<now&&j.attempts<3));if(!job)return {job:null};job.state="leased";job.attempts++;job.leaseUntil=now+120000;s.n8nBridge=q;return {job:{id:job.id,workflow:job.workflow,payload:job.payload},leaseSeconds:120};});
}
export async function finish(id:string,ok:boolean,result:string){
 if(!bridgeEnabled())throw Error("BRIDGE_NOT_CONFIGURED");
 if(!/^[0-9a-f-]{36}$/.test(id)||result.length>2000)throw Error("INVALID_RESULT");
 return connectorStore.update(s=>{const q=queue(s),job=q.jobs.find(j=>j.id===id);if(!job||job.state!=="leased")throw Error("JOB_NOT_LEASED");job.state=ok?"completed":"failed";job.result=result.replace(/[\r\n\t]/g," ").slice(0,2000);s.n8nBridge=q;return {id:job.id,state:job.state};});
}
export async function status(){if(!bridgeEnabled())return {enabled:false};const q=queue(await connectorStore.read());return {enabled:true,jobs:q.jobs.slice(-30).map(j=>({id:j.id,workflow:j.workflow,state:j.state,createdAt:j.createdAt,attempts:j.attempts,result:j.result||null}))};}
