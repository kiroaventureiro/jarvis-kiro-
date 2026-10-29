import "server-only";

/** Contracts only: no OAuth, token storage, calls, or device commands are implemented here. */
export type Provider = "google"|"microsoft"|"n8n"|"windows_agent"|"youtube"|"instagram"|"tiktok";
export type IntegrationOperation = "read"|"write"|"publish"|"execute";
export type ConnectorResult<T> =
 | {ok:true; provider:Provider; source:"live"; fetchedAt:string; data:T}
 | {ok:false; provider:Provider; code:"NOT_CONFIGURED"|"NOT_AUTHORIZED"|"UNAVAILABLE"|"PERMISSION_DENIED"|"RATE_LIMITED"|"NEEDS_APPROVAL"; message:string};

export const connectorContracts: Record<Provider,{
  resources:readonly string[];
  plannedReadScopes:readonly string[];
  requiredApprovals:readonly IntegrationOperation[];
  availability:"not_implemented";
}> = {
 google: {
  resources:["drive_files","gmail_messages","calendar_events"],
  plannedReadScopes:["drive.metadata.readonly","gmail.readonly","calendar.readonly"],
  requiredApprovals:["write","publish"],availability:"not_implemented"
 },
 microsoft: {
  resources:["onedrive_files","outlook_messages","calendar_events"],
  plannedReadScopes:["Files.Read","Mail.Read","Calendars.Read"],
  requiredApprovals:["write","publish"],availability:"not_implemented"
 },
 n8n: {
  resources:["workflow_catalog","execution_status"],
  plannedReadScopes:["workflow-specific read permissions"],requiredApprovals:["execute","write"],availability:"not_implemented"
 },
 windows_agent: {
  resources:["obs_status","kiro_tv_status","agent_health"],
  plannedReadScopes:["local agent read-only status"],requiredApprovals:["execute","write"],availability:"not_implemented"
 },
 youtube: {
  resources:["channel_metrics","video_metrics"],
  plannedReadScopes:["analytics.readonly"],requiredApprovals:["publish","write"],availability:"not_implemented"
 },
 instagram: {
  resources:["professional_account_insights"],
  plannedReadScopes:["provider-approved insights permission"],requiredApprovals:["publish","write"],availability:"not_implemented"
 },
 tiktok: {
  resources:["account_metrics"],
  plannedReadScopes:["provider-approved read permission"],requiredApprovals:["publish","write"],availability:"not_implemented"
 }
};
export function plannedConnectorReadiness(){
 return Object.entries(connectorContracts).map(([name,definition])=>({
  name,resources:definition.resources,plannedReadScopes:definition.plannedReadScopes,
  approvalRequiredFor:definition.requiredApprovals,
  implemented:false,connected:false,verified:false
 }));
}
