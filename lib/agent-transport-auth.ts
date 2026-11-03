import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { connectorStore } from "./connectors/server";
import { validateAgentMessage, type AgentMessage, type AgentSource } from "./agent-transport-contract";

export type TransportEvent = Pick<AgentMessage,"messageId"|"taskId"|"source"|"type"|"status"|"summary"|"createdAt"> & { receivedAt: string };
type AgentState = { agentTransport?: { seen: Record<string,number>; events: TransportEvent[] } };
const MAX_BYTES = 4096;
const MAX_SKEW_MS = 5 * 60 * 1000;
const KEEP_MS = 15 * 60 * 1000;

export function sourceSecret(source:AgentSource, env:NodeJS.ProcessEnv=process.env):string | null {
 const key=source==="n8n" ? env.JARVIS_AGENT_N8N_SECRET : env.JARVIS_AGENT_WINDOWS_SECRET;
 return key && key.length>=32 ? key : null;
}

/** Signature: lowercase hex HMAC-SHA256(secret, timestamp + "." + raw UTF-8 body). */
export function verifyAgentEnvelope(raw:string, timestamp:string | null, signature:string | null,
 source:AgentSource, now=Date.now(), env:NodeJS.ProcessEnv=process.env): AgentMessage | null {
 if (Buffer.byteLength(raw,"utf8")>MAX_BYTES || !timestamp || !signature ||
     !/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature) ||
     Math.abs(now-Number(timestamp))>MAX_SKEW_MS) return null;
 const secret=sourceSecret(source,env);
 if (!secret) return null;
 const expected=createHmac("sha256",secret).update(timestamp+"."+raw).digest("hex");
 if (!timingSafeEqual(Buffer.from(signature,"hex"),Buffer.from(expected,"hex")))return null;
 let parsed:unknown;
 try {parsed=JSON.parse(raw)} catch{return null}
 if (!validateAgentMessage(parsed) || parsed.source!==source ||
     Math.abs(now-Date.parse(parsed.createdAt))>MAX_SKEW_MS) return null;
 return parsed;
}

/** Atomic encrypted-vault update is the replay boundary across serverless instances. */
export async function acceptAgentEvent(message:AgentMessage,now=Date.now()) {
 const key=message.source+":"+message.messageId;
 const receivedAt=new Date(now).toISOString();
 return connectorStore.update(state=>{
  const data=state as typeof state & AgentState;
  const transport=data.agentTransport || (data.agentTransport={seen:{},events:[]});
  transport.seen=Object.fromEntries(Object.entries(transport.seen).filter(([,at])=>at>now-KEEP_MS));
  if (transport.seen[key])return {accepted:false,reason:"REPLAY"};
  transport.seen[key]=now;
  transport.events.push({...message,receivedAt});
  if(transport.events.length>100) transport.events.splice(0,transport.events.length-100);
  return {accepted:true,source:message.source,messageId:message.messageId,receivedAt};
 });
}
