/** Shared notification contract; Codex first, other connected services later. */
export type JarvisAlertKind="approval_required"|"queued"|"running"|"completed"|"failed";
export type JarvisAlert={
 id:string;
 source:"codex"|"navi"|"connector";
 subjectId:string;
 kind:JarvisAlertKind;
 title:string;
 speech:string;
 visual:"attention"|"activity"|"success"|"error";
 createdAt:string;
};
export function codexTaskAlert(task:{id:string;state:string;updatedAt:string}):JarvisAlert|null {
 const descriptors:Record<string,{kind:JarvisAlertKind;title:string;speech:string;visual:JarvisAlert["visual"]}>={
  approved:{kind:"approval_required",title:"Codex: aprovação registrada",speech:"A tarefa foi aprovada, mas ainda não foi iniciada.",visual:"attention"},
  queued:{kind:"queued",title:"Codex: aguardando executor",speech:"A tarefa está na fila.",visual:"activity"},
  running:{kind:"running",title:"Codex: trabalhando",speech:"A tarefa está em execução.",visual:"activity"},
  completed:{kind:"completed",title:"Codex: tarefa concluída",speech:"A tarefa Codex foi concluída. O resultado está disponível para consulta.",visual:"success"},
  failed:{kind:"failed",title:"Codex: falha na tarefa",speech:"A tarefa Codex falhou. Posso mostrar os detalhes.",visual:"error"},
 };
 const value=descriptors[task.state];
 if(!value||!/^[0-9a-f-]{36}$/i.test(task.id)||!Number.isFinite(Date.parse(task.updatedAt)))return null;
 return {id:"codex:"+task.id+":"+task.state+":"+task.updatedAt,source:"codex",subjectId:task.id,...value,createdAt:task.updatedAt};
}
