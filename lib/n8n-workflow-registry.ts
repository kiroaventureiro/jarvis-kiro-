import "server-only";
export const N8N_WORKFLOWS = {
 project_report: {mode:"read", approval:false, enabled:false, description:"Relatório de projetos e repositórios"},
 content_pipeline: {mode:"proposal", approval:true, enabled:false, description:"Planejamento de conteúdo KIRO"},
 broadcast_health: {mode:"read", approval:false, enabled:false, description:"Diagnóstico de OBS e KIRO TV"},
 social_performance: {mode:"read", approval:false, enabled:false, description:"Relatório das redes sociais"},
 daily_briefing: {mode:"read", approval:false, enabled:false, description:"Resumo de agenda e tarefas"},
} as const;
export type RegisteredWorkflow=keyof typeof N8N_WORKFLOWS;
export function workflowPlan(key:string){
 if(!Object.prototype.hasOwnProperty.call(N8N_WORKFLOWS,key))return null;
 const item=N8N_WORKFLOWS[key as RegisteredWorkflow];
 return {key,...item,connected:false,executionsEnabled:false};
}
