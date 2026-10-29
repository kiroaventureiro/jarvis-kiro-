import "server-only";
export type JarvisIntent = "answer" | "consult" | "propose_action";
export type WorkflowKey = "project_report" | "content_pipeline" | "broadcast_health";
export const WORKFLOW_ALLOWLIST: Record<WorkflowKey,{operation:"read"|"proposal";requiresApproval:boolean}> = {
 project_report:{operation:"read",requiresApproval:false},
 content_pipeline:{operation:"proposal",requiresApproval:true},
 broadcast_health:{operation:"read",requiresApproval:false}
};
export type JarvisTask = {id:string;intent:JarvisIntent;workflow?:WorkflowKey;question:string};
export function planJarvisTask(task:JarvisTask){
 const workflow = task.workflow ? WORKFLOW_ALLOWLIST[task.workflow] : undefined;
 if(task.workflow && !workflow)return {allowed:false,reason:"Workflow não permitido"};
 return {allowed:true,executionEnabled:false,requiresApproval:workflow?.requiresApproval??false,
  stage:"proposal_only",taskId:task.id,
  reason:"Orquestração real ainda não autorizada; nenhum webhook será executado."};
}
