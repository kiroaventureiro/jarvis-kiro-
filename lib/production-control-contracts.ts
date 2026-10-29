import "server-only";
export const CONTROL_ACTIONS = {
 obs_status: {kind:"read", approval:false},
 kiro_tv_status: {kind:"read", approval:false},
 n8n_workflows: {kind:"read", approval:false},
 n8n_executions: {kind:"read", approval:false},
 obs_start_stream: {kind:"execute", approval:true},
 obs_stop_stream: {kind:"execute", approval:true},
 kiro_tv_change_playlist: {kind:"write", approval:true},
 n8n_run_workflow: {kind:"execute", approval:true},
} as const;
export function plannedProductionCapabilities() {
 return Object.entries(CONTROL_ACTIONS).map(([name,rule])=>({
  name, ...rule, connected:false, enabled:false,
  reason:"Agente local e credenciais ainda não autorizados."
 }));
}
