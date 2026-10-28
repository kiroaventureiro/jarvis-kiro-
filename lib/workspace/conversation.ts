import "server-only";
import { connectorStore } from "../connectors/server";
import { listPersistentProjects, savePersistentProject } from "./projects";
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export async function answerWorkspaceQuestion(message: string) {
  const n = normalize(message);
  const checkpoint = /^(?:jarvis[, ]*)?(?:atualize|atualizar|salve|registre) (?:a )?(?:proxima etapa|proximo passo) (?:do |no |o )?projeto\s+(.+?)\s*:\s*(.+)$/i.exec(message.trim());
  if (checkpoint) {
    if (!connectorStore.configured())
      return {text:"O cofre da memória contínua está indisponível.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
    try {
      const name = checkpoint[1].trim(), nextStep = checkpoint[2].trim();
      const matches = (await listPersistentProjects()).filter(p => normalize(p.name) === normalize(name));
      if (matches.length !== 1 || nextStep.length > 500)
        return {text:"Não consegui identificar exatamente o projeto ou a próxima etapa. Nenhum registro foi alterado.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
      const p = matches[0];
      const updated = await savePersistentProject({id:p.id,name:p.name,objective:p.objective,provider:p.provider,
        status:"paused",nextStep,notes:p.notes});
      return {text:"Atualizei a próxima etapa de "+updated.name+" na memória contínua: "+updated.nextStep+". O projeto ficou registrado como pausado, pronto para consulta futura. Nenhuma operação externa foi executada.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
    } catch {
      return {text:"Não consegui confirmar a atualização da memória. Nenhuma gravação foi confirmada.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
    }
  }
  const attach = /^(?:jarvis[, ]*)?(?:associe|vincule) (?:a )?tarefa (?:da )?abacus\s+([a-zA-Z0-9_-]{1,160})\s+(?:ao|a|no) projeto\s+(.{1,100})$/i.exec(message.trim());
  if (attach) {
    if (!connectorStore.configured())
      return {text:"A memória persistente não está configurada neste ambiente.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
    try {
      const [identifier, name] = [attach[1],attach[2].trim()];
      const matches = (await listPersistentProjects()).filter(p=>normalize(p.name)===normalize(name));
      if (matches.length !== 1)
        return {text:"Não encontrei um projeto salvo com esse nome exato. Não associei a tarefa.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
      const current = matches[0];
      await savePersistentProject({id:current.id,name:current.name,objective:current.objective,
        provider:current.provider,nextStep:current.nextStep,status:current.status,
        externalTask:{provider:"abacus",kind:"task",id:identifier,verification:"unverified"},
        notes:current.notes});
      return {text:"Associei a referência da tarefa ao projeto "+current.name+" na memória criptografada. O identificador ainda não foi validado na Abacus e nenhuma tarefa externa foi executada.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
    } catch {
      return {text:"Não consegui confirmar a gravação da referência. O vínculo não foi concluído.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
    }
  }
  const save = /^(?:jarvis[, ]*)?(?:salve|salvar|registre|registrar) (?:na memoria )?(?:o )?projeto\s+(.+?)\s*;\s*objetivo\s*:\s*(.+?)\s*;\s*(?:proxima etapa|proximo passo)\s*:\s*(.+)$/i.exec(message.trim());
  if (save) {
    if (!connectorStore.configured())
      return {text:"O cofre de memória não está configurado.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
    try {
      const name = save[1].trim(), objective = save[2].trim(), nextStep = save[3].trim();
      if (name.length > 100 || objective.length > 1000 || nextStep.length > 500) throw Error("INVALID_PROJECT");
      const existing = (await listPersistentProjects()).find(p => normalize(p.name) === normalize(name));
      const project = await savePersistentProject({...(existing ? {id:existing.id} : {}),name, objective,nextStep,provider:existing?.provider || "abacus",status: "paused"});
      return {text:"Registrei "+project.name+" na memória contínua. Objetivo: "+project.objective+". Próxima etapa: "+project.nextStep+". Posso recuperar esse ponto depois, mas ainda não executei nenhuma ação na Abacus.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
    } catch {
      return {text:"Não consegui salvar o projeto no cofre. Nenhuma gravação foi confirmada.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
    }
  }
  if (!/(projetos? (?:salvos?|em andamento|pausados?)|retom|continuar (?:meu |o )?projeto|onde paramos|onde parei|memoria (?:dos |de )?projetos)/.test(n)) return null;
  if (!connectorStore.configured())
    return {text:"O armazenamento de projetos não está configurado neste ambiente.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
  try {
    const projects = await listPersistentProjects();
    if (!projects.length)
      return {text:"Ainda não há projetos salvos na memória contínua. O espaço de trabalho está preparado, mas nenhum projeto foi registrado.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
    const named = projects.filter(p=>normalize(p.name).split(/\s+/).filter(x=>x.length>3).every(x=>n.includes(x)));
    const selected = named.length ? named : projects;
    const lines = selected.slice(0,5).map(p=>p.name+": "+(p.status==="paused"?"pausado":p.status==="completed"?"concluído":p.status==="active"?"em andamento":"planejado")+". Próxima etapa: "+p.nextStep+"."+(p.externalTask ? " Tarefa externa associada na Abacus, ainda sem verificação em tempo real." : ""));
    const text = named.length ? "Encontrei o registro salvo. "+lines.join(" ")+" Para continuar com segurança, preciso verificar o estado atual da plataforma antes de executar a próxima ação." : "Projetos registrados na memória contínua: "+lines.join(" ")+" Nenhuma tarefa externa foi executada.";
    return {text,model:"jk-workspace",provider:"local_operational" as const,usage:null,result:{kind:"persistent_projects",projects:selected.slice(0,5).map(p=>({id:p.id,name:p.name,status:p.status,provider:p.provider,updatedAt:p.updatedAt,nextStep:p.nextStep}))}};
  } catch {
    return {text:"Não consegui ler a memória contínua agora. Isso não significa que os projetos foram perdidos.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
  }
}
