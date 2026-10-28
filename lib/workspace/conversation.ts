import "server-only";
import { connectorStore } from "../connectors/server";
import { listPersistentProjects, savePersistentProject } from "./projects";
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export async function answerWorkspaceQuestion(message: string) {
  const n = normalize(message);
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
    const lines = selected.slice(0,5).map(p=>p.name+": "+(p.status==="paused"?"pausado":p.status==="completed"?"concluído":p.status==="active"?"em andamento":"planejado")+". Próxima etapa: "+p.nextStep+".");
    const text = named.length ? "Encontrei o registro salvo. "+lines.join(" ")+" Para continuar com segurança, preciso verificar o estado atual da plataforma antes de executar a próxima ação." : "Projetos registrados na memória contínua: "+lines.join(" ")+" Nenhuma tarefa externa foi executada.";
    return {text,model:"jk-workspace",provider:"local_operational" as const,usage:null,result:{kind:"persistent_projects",projects:selected.slice(0,5).map(p=>({id:p.id,name:p.name,status:p.status,provider:p.provider,updatedAt:p.updatedAt,nextStep:p.nextStep}))}};
  } catch {
    return {text:"Não consegui ler a memória contínua agora. Isso não significa que os projetos foram perdidos.",model:"jk-workspace",provider:"local_operational" as const,usage:null};
  }
}
