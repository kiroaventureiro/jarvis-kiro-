import "server-only";
export type AgentSource="n8n"|"windows_agent";
export type AgentMessage={version:1;source:AgentSource;messageId:string;taskId:string;createdAt:string;type:"health"|"task_result";status:"ok"|"error";summary:string};
export const AGENT_TRANSPORT={enabled:false,networkTransport:"not_configured",requiresMutualAuthentication:true,
 requiresFreshTimestamp:true,requiresReplayProtection:true,requiresSignatureVerification:true,
 allowedSources:["n8n","windows_agent"] as const,allowRemoteExecution:false} as const;
export function validateAgentMessage(input:unknown):input is AgentMessage {
 if(!input||typeof input!=="object"||Array.isArray(input))return false;
 const x=input as Record<string,unknown>;
 return x.version===1&&AGENT_TRANSPORT.allowedSources.some(s=>s===x.source)
 &&typeof x.messageId==="string"&&/^[\w-]{8,80}$/.test(x.messageId)
 &&typeof x.taskId==="string"&&/^[\w-]{8,80}$/.test(x.taskId)
 &&typeof x.createdAt==="string"&&!Number.isNaN(Date.parse(x.createdAt))
 &&(x.type==="health"||x.type==="task_result")
 &&(x.status==="ok"||x.status==="error")
 &&typeof x.summary==="string"&&x.summary.length<=500;
}
