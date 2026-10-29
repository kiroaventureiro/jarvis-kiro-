import "server-only";
export const TASK_STATES=["draft","awaiting_approval","queued","running","completed","failed","cancelled"] as const;
export type TaskState=typeof TASK_STATES[number];
export type TaskPriority="low"|"normal"|"high"|"critical";
export type TaskContext="personal"|"kiro";
export type TaskRecord={id:string;context:TaskContext;workflow:string;priority:TaskPriority;state:TaskState;createdAt:string;updatedAt:string;summary:string;fingerprint:string;};
const weights:Record<TaskPriority,number>={low:1,normal:2,high:3,critical:4};
const transitions:Record<TaskState,readonly TaskState[]>={
 draft:["awaiting_approval","queued","cancelled"],
 awaiting_approval:["queued","cancelled"],
 queued:["running","cancelled"],
 running:["completed","failed"],
 completed:[],failed:["queued","cancelled"],cancelled:[]
};
export function mayTransition(from:TaskState,to:TaskState){return transitions[from].includes(to);}
export function normalizeTaskKey(context:TaskContext,workflow:string,summary:string){
 return [context,workflow,summary.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g," ").slice(0,300)].join("|");
}
export function prioritizeTasks(records:readonly TaskRecord[]){
 return [...records].sort((a,b)=>weights[b.priority]-weights[a.priority]||a.createdAt.localeCompare(b.createdAt));
}
export function findDuplicate(records:readonly TaskRecord[],candidate:Pick<TaskRecord,"fingerprint"|"context">){
 return records.find(r=>r.context===candidate.context&&r.fingerprint===candidate.fingerprint&&
 !["completed","cancelled","failed"].includes(r.state))??null;
}
/** Describes planned storage policy; this module persists nothing. */
export const TASK_RETENTION={storePayloads:false,storeSecrets:false,storeConversationBodies:false,
 keepTaskMetadataDays:30,keepAuditEventsDays:90,databaseRequiredForCrossDeviceHistory:true} as const;
