import "server-only";
import { connectors, connectorStore } from "./server";
import { type Provider } from "./types";
import type { HoloScene } from "../holo/types";

/** Extend this registry when a real, authorized native adapter is added. */
const READ_PROVIDERS: Record<Provider, { aliases: string[]; summary: string }> = {
  github: { aliases: ["github", "repositorio", "repositorios", "codigo", "commits"], summary: "Repositórios, código e commits" },
  vercel: { aliases: ["vercel", "deploy", "deployments", "implantacoes"], summary: "Projetos e deployments" },
  supabase: { aliases: ["supabase", "banco de dados", "tabelas"], summary: "Schemas e diagnósticos" },
};
function normalize(input: string) {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
const readIntent = /\b(consult|verific|analis|diagnostic|listar|liste|mostr|acesse|abra|pesquis|status|situacao|meus projetos|minhas conexoes)\w*/;
export async function conversationalConnectorRead(message: string) {
  const n = normalize(message);
  if (!readIntent.test(n)) return null;
  const mentioned = (Object.keys(READ_PROVIDERS) as Provider[]).filter(p =>
    READ_PROVIDERS[p].aliases.some(alias => n.includes(alias))
  );
  const all = /\b(todos|todas|tudo|conexoes|integracoes|plataformas)\b/.test(n) || /meus projetos|minhas conexoes/.test(n);
  const providers = mentioned.length ? (all ? (Object.keys(READ_PROVIDERS) as Provider[]) : mentioned) : all ? (Object.keys(READ_PROVIDERS) as Provider[]) : [];
  if (!providers.length) return null;
  if (!connectorStore.configured())
    return { text: "O cofre dos conectores não está configurado neste ambiente.", model: "jk-tools", provider: "local_operational" as const, usage: null };
  try {
    const state = await connectorStore.read();
    const results: string[] = [];
    let successful = 0;
    let failed = 0;
    const panels: Array<{label: string; detail: string}> = [];
    for (const provider of providers) {
      const c = state.connections[provider];
      if (!c || c.status !== "connected") { results.push(provider + ": sem conexão ativa."); panels.push({label: provider.toUpperCase(), detail: "Sem conexão ativa"}); continue; }
      if (!c.grants.includes("read")) { results.push(provider + ": leitura não autorizada."); panels.push({label: provider.toUpperCase(), detail: "Leitura não autorizada"}); continue; }
      if (!c.resources.length) { results.push(provider + ": conectado, mas nenhum projeto foi autorizado no JK."); panels.push({label: provider.toUpperCase(), detail: "Nenhum projeto autorizado"}); continue; }
      results.push(provider.toUpperCase() + ": " + c.resources.length + " projeto(s) autorizado(s).");
      const targets = c.resources.slice(0, 5);
      for (const resource of targets) {
        const op = provider === "github" ? "repo" : provider === "vercel" ? "deployments" : "schemas";
        try {
          const checked = await connectors.readAuthorized(provider, resource.id, op);
          successful++;
          results.push("- " + resource.name + ": consulta de " + (provider === "github" ? "repositório" : provider === "vercel" ? "publicações" : "estrutura do banco") + " concluída.");
          panels.push({label: provider.toUpperCase() + " · " + resource.name, detail: "Consulta " + op + " concluída em " + checked.checkedAt});
        } catch {
          failed++;
          results.push("- " + resource.name + " | não foi possível consultar agora; não afirmar que o projeto foi verificado.");
          panels.push({label: provider.toUpperCase() + " · " + resource.name, detail: "Consulta indisponível; nenhum resultado confirmado"});
        }
      }
      if (c.resources.length > targets.length)
        results.push("Outros " + (c.resources.length - targets.length) + " projetos autorizados não foram consultados nesta resposta para limitar tempo e volume. Solicite uma consulta específica.");
    }
    const text = "Concluí " + successful + " consultas de leitura aos projetos autorizados." + (failed ? " Outras " + failed + " consultas não puderam ser concluídas." : "") + " Consultei informações de GitHub, Vercel ou Supabase conforme os acessos disponíveis. Não fiz nenhuma alteração. Os resultados mostram o estado das consultas, mas ainda não representam uma auditoria completa da qualidade dos projetos.";
    const visual: HoloScene = {
      version: 1, id: "jk-connected-projects-" + Date.now(),
      title: "Diagnóstico dos sistemas conectados", mode: "technical",
      createdAt: new Date().toISOString(),
      source: {kind: "connector", label: "Consultas reais aos provedores autorizados", checkedAt: new Date().toISOString()},
      modules: [{id: "verified-projects", kind: "report", title: "Projetos e consultas verificadas", summary: "Somente leitura. Resultados limitados às operações concluídas nesta solicitação.", items: panels.slice(0, 20)}],
      narration: text,
    };
    return { text, visual, result: { kind: "connector_read", entries: results }, model: "jk-tools", provider: "local_operational" as const, usage: null };
  } catch {
    return { text: "Não consegui consultar o cofre dos conectores agora. Não posso garantir que as contas estejam desconectadas.", model: "jk-tools", provider: "local_operational" as const, usage: null };
  }
}
