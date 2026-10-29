import "server-only";
export const WINDOWS_CAPABILITIES = {
 agent_health:{access:"read",enabled:false},
 obs_status:{access:"read",enabled:false},
 kiro_tv_playlist_status:{access:"read",enabled:false},
 local_disk_inventory:{access:"sensitive_read",enabled:false},
 obs_change_scene:{access:"write",enabled:false},
 obs_start_stream:{access:"execute",enabled:false},
 obs_stop_stream:{access:"execute",enabled:false},
 execute_shell:{access:"forbidden",enabled:false}
} as const;
export type WindowsCommand=keyof typeof WINDOWS_CAPABILITIES;
export function inspectWindowsCommand(command:string){
 if(!Object.prototype.hasOwnProperty.call(WINDOWS_CAPABILITIES,command))
  return {allowed:false,reason:"Comando desconhecido"};
 const entry=WINDOWS_CAPABILITIES[command as WindowsCommand];
 return {allowed:false,command,access:entry.access,enabled:false,
  reason:"Agente Windows não instalado nem autorizado; nenhuma ação é executada"};
}
