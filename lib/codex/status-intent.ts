/** Explicit status checks only: task identifiers never authorize execution. */
export function codexStatusIntent(message:string):string|null {
 const text=message.trim();
 if(!/(codex|tarefa)/i.test(text)||!/(status|andamento|situa[cç][aã]o|estado)/i.test(text))return null;
 const id=text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
 return id? id[0]:null;
}
