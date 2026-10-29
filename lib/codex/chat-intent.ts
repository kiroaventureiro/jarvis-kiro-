/** Narrow, explicit Codex task requests. Never interpret a generic chat as permission to run code. */
export function codexDraftIntent(message:string):{kind:"review"|"test"|"implement";task:string}|null {
 const t=message.trim();
 if(t.length<15||t.length>1500||!/^((jarvis|codex)[,:]?\s*)?(peça (ao |para o )?codex|prepare (uma )?tarefa (para o )?codex|solicite ao codex)\b/i.test(t))return null;
 const lower=t.toLocaleLowerCase("pt-BR");
 const kind=/\b(test|teste|testar|testes)\b/.test(lower)?"test":/\b(revis|analis|verific|audit)\w*/.test(lower)?"review":"implement";
 return {kind,task:t};
}
