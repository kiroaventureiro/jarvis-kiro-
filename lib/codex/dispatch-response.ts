/** Truthful state mapping for future Codex dispatch responses. */
export type CodexDispatchSummary={started:boolean;queued:boolean;message:string};
export function describeCodexDispatchResponse(httpStatus:number,body:unknown):CodexDispatchSummary {
 if(!body||typeof body!=="object"||Array.isArray(body))
  return {started:false,queued:false,message:"Não foi possível confirmar a conexão com o executor Codex."};
 const data=body as Record<string,unknown>;
 if(httpStatus===503&&data.started===false&&data.queued===false)
  return {started:false,queued:false,message:"A tarefa foi aprovada, mas o executor Codex ainda não está conectado. Nada foi iniciado."};
 return {started:false,queued:false,message:"O estado da execução não foi confirmado. Não vou informar que o Codex iniciou trabalho."};
}
