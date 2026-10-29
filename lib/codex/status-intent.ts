/** Explicit status checks only: task identifiers never authorize execution. */
export function codexStatusIntent(message:string):string|null {
 const text=message.trim();
 if(!/(codex|tarefa)/i.test(text)||!/(status|andamento|situa[cç][aã]o|estado)/i.test(text))return null;
 const id=text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
 return id? id[0]:null;
}

/** Resolve elliptical follow-ups only against a known task created in this session. */
export function codexRecentStatusIntent(message:string,recentTaskId:string|null):string|null {
 if(!recentTaskId||!/^[0-9a-f-]{36}$/i.test(recentTaskId))return null;
 const text=message.trim().toLocaleLowerCase("pt-BR");
 if(!/(codex|tarefa)/.test(text))return null;
 if(!/(status|andamento|situação|situacao|estado|como está|como esta|já terminou|ja terminou)/.test(text))return null;
 if(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text))return null;
 return recentTaskId;
}
