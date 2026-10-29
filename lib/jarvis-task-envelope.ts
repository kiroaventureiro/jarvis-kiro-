import "server-only";
import { N8N_WORKFLOWS, type RegisteredWorkflow } from "./n8n-workflow-registry";
export type TaskEnvelope={version:1;taskId:string;workflow:RegisteredWorkflow;requestedAt:string;context:"personal"|"kiro";input:{summary:string}};
export type TaskReceipt={taskId:string;workflow:RegisteredWorkflow;stage:"planned";executed:false;connected:false;approvalRequired:boolean;result:"NO_EXTERNAL_EXECUTION"};
const idPattern=/^[a-zA-Z0-9_-]{8,80}$/;
export function validateTaskEnvelope(input:unknown):input is TaskEnvelope {
 if(!input||typeof input!=="object"||Array.isArray(input))return false;
 const x=input as Record<string,unknown>;
 if(x.version!==1||typeof x.taskId!=="string"||!idPattern.test(x.taskId))return false;
 if(typeof x.workflow!=="string"||!Object.hasOwn(N8N_WORKFLOWS,x.workflow))return false;
 if(x.context!=="kiro"&&x.context!=="personal")return false;
 if(typeof x.requestedAt!=="string"||!/^\d{4}-\d{2}-\d{2}T/.test(x.requestedAt)||Number.isNaN(Date.parse(x.requestedAt)))return false;
 if(!x.input||typeof x.input!=="object"||Array.isArray(x.input))return false;
 const data=x.input as Record<string,unknown>;
 return Object.keys(data).length===1&&typeof data.summary==="string"&&data.summary.trim().length>=3&&data.summary.length<=500;
}
export function createTaskReceipt(task:TaskEnvelope):TaskReceipt {
 const flow=N8N_WORKFLOWS[task.workflow];
 return {taskId:task.taskId,workflow:task.workflow,stage:"planned",executed:false,
 connected:false,approvalRequired:flow.approval,result:"NO_EXTERNAL_EXECUTION"};
}
