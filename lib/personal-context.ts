import type { VaultState } from "./connectors/types";
const text = (value: unknown, max = 220) => typeof value === "string" ? value.replace(/[\x00-\x1f<>]/g, " ").slice(0, max) : "";
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
export type PersonalContext = {
  checkedAt: string;
  projects: Array<{ name: string; status: string; nextStep: string; updatedAt: string | null }>;
  pending: Array<{ title: string; status: string; createdAt: string }>;
  repositories: string[];
  partial: boolean;
};
/** Explicit projection: never pass credentials, OAuth state, notes, plan arguments or raw audit rows to a model. */
export function personalContext(state: VaultState, now = Date.now()): PersonalContext {
  const projects = Object.values(state.persistentProjects || {}).filter(p => p.status !== "completed")
    .sort((a,b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  const pending = state.plans.filter(p => ["draft", "approved", "running", "waiting", "uncertain"].includes(p.status) &&
    (p.expiresAt > now || ["running", "waiting", "uncertain"].includes(p.status))).sort((a,b) => b.createdAt-a.createdAt);
  const github = state.connections.github;
  const repositories = github?.status === "connected" && github.grants.includes("read") ? github.resources : [];
  return { checkedAt: new Date(now).toISOString(),
    projects: projects.slice(0,5).map(p => ({name:text(p.name,100),status:text(p.status,30),nextStep:text(p.nextStep),updatedAt:date(p.updatedAt)})),
    pending: pending.slice(0,5).map(p => ({title:text(p.title,150),status:text(p.status,30),createdAt:new Date(p.createdAt).toISOString()})),
    repositories: repositories.slice(0,6).map(r => text(r.name,140)),
    partial: projects.length>5 || pending.length>5 || repositories.length>6,
  };
}
export function personalContextFacts(context: PersonalContext) {
  const statuses:Record<string,string> = {planned:"planejado",active:"em andamento",paused:"pausado",draft:"rascunho aguardando decisão",approved:"plano aprovado, execução não confirmada",running:"execução registrada em andamento",waiting:"aguardando retorno",uncertain:"resultado incerto, precisa de conferência"};
  return ["Projetos e pendências salvos no Jarvis, consultados em " + new Date(context.checkedAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}) + ":",
    context.projects.length ? context.projects.map(p => p.name+": "+(statuses[p.status]||"estado não reconhecido")+(p.nextStep?"; próximo passo registrado: "+p.nextStep:"")+(p.updatedAt?"; registro atualizado em "+p.updatedAt.slice(0,10):"")).join("\n") : "Não há projetos em andamento registrados nesta memória.",
    context.pending.length ? "Etapas pendentes registradas: "+context.pending.map(p => p.title+" ("+(statuses[p.status]||"estado não reconhecido")+")").join("; ") : "Não há planos pendentes nos registros consultados.",
    context.repositories.length ? "Repositórios com leitura autorizada no inventário salvo: "+context.repositories.join(", ")+". Não consultei commits nem alterações desses repositórios neste resumo." : "Não há repositórios com leitura autorizada neste inventário.",
    "Esses registros não comprovam atualização ao vivo das plataformas."+(context.partial?" Há mais registros além desta seleção.":"")].join("\n");
}
