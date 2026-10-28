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
/** Convert provider responses into bounded, non-sensitive observations. Never send raw rows to speech. */
function observation(provider: Provider, data: unknown): string {
  const items = Array.isArray(data) ? data : null;
  if (provider === "github") {
    if (data && typeof data === "object" && !items) {
      const r = data as Record<string, unknown>;
      const branch = typeof r.defaultBranch === "string" ? r.defaultBranch : null;
      const description = typeof r.description === "string" ? r.description.slice(0, 110) : null;
      return "Repositório acessível" + (branch ? "; branch principal: " + branch : "") + (description ? "; descrição: " + description : "") + ". Não foram examinados arquivos nem testes.";
    }
    return "Consulta ao GitHub concluída; conteúdo exige inspeção específica.";
  }
  if (provider === "vercel") {
    if (!items) return "Resposta da Vercel recebida; formato não reconhecido para análise.";
    const ready = items.filter(x => x && typeof x === "object" && (x as Record<string,unknown>).state === "READY").length;
    const errors = items.filter(x => x && typeof x === "object" && (x as Record<string,unknown>).state === "ERROR").length;
    return items.length + " deployments listados; " + ready + " prontos e " + errors + " com erro nesta amostra. Isto não mede o funcionamento do site em tempo real.";
  }
  if (!items) return "Consulta ao Supabase concluída; resposta não permite contabilizar tabelas com segurança.";
  const publicTables = items.filter(x => x && typeof x === "object" && (x as Record<string,unknown>).table_schema === "public");
  return publicTables.length + " tabelas públicas listadas na consulta limitada; dados e permissões de cada tabela não foram analisados.";
}
function displayName(name: string) {
  return name.split("/").at(-1)!.replace(/[-_]/g, " ");
}
const STOP = new Set(["kiro", "site", "projeto", "projetos", "sistema", "do", "da", "de", "no", "na", "e", "origem"]);
function projectWords(value: string) {
  return normalize(value).replace(/[-_/]/g, " ").split(/\s+/).filter(word => word.length > 3 && !STOP.has(word));
}
function requestedProject(message: string, names: string[]) {
  // Prefer an exact, distinctive name from the owner's authorized resource list.
  const hits = names.map(name => {
    const words = projectWords(name);
    const matches = words.filter(word => new RegExp("(^|[^a-z])" + word + "([^a-z]|$)").test(message));
    return {name, score: words.length && matches.length === words.length ? matches.length : 0};
  }).filter(hit => hit.score > 0).sort((a,b) => b.score-a.score);
  return hits[0]?.name || null;
}
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
    const verifiedNames: string[] = [];
    const failedNames: string[] = [];
    const findings: string[] = [];
    const panels: Array<{label: string; detail: string}> = [];
    const namedResources = providers.flatMap(p => state.connections[p]?.resources.map(r => r.name) || []);
    const namedTarget = requestedProject(n, namedResources);
    const explicitProject = /(?:projeto|sobre|do|da|no|na)\s+([\\p{L}0-9 -]{5,70})/u.test(n) && !all;
    for (const provider of providers) {
      const c = state.connections[provider];
      if (!c || c.status !== "connected") { results.push(provider + ": sem conexão ativa."); panels.push({label: provider.toUpperCase(), detail: "Sem conexão ativa"}); continue; }
      if (!c.grants.includes("read")) { results.push(provider + ": leitura não autorizada."); panels.push({label: provider.toUpperCase(), detail: "Leitura não autorizada"}); continue; }
      if (!c.resources.length) { results.push(provider + ": conectado, mas nenhum projeto foi autorizado no JK."); panels.push({label: provider.toUpperCase(), detail: "Nenhum projeto autorizado"}); continue; }
      results.push(provider.toUpperCase() + ": " + c.resources.length + " projeto(s) autorizado(s).");
      const selected = namedTarget ? c.resources.filter(r => r.name === namedTarget || projectWords(r.name).every(w => projectWords(namedTarget).includes(w))) : [];
      const targets = (namedTarget ? selected : explicitProject ? [] : c.resources).slice(0, 5);
      if (namedTarget && !targets.length) {
        results.push(provider + ": nenhum recurso correspondente a " + displayName(namedTarget) + " foi autorizado.");
        panels.push({label: provider.toUpperCase(), detail: "Projeto solicitado não está no escopo deste provedor"});
        continue;
      }
      if (explicitProject && !namedTarget) {
        results.push(provider + ": não encontrei o projeto solicitado entre os recursos autorizados.");
        panels.push({label: provider.toUpperCase(), detail: "Projeto não identificado; informe o nome exato do recurso"});
        continue;
      }
      for (const resource of targets) {
        const op = provider === "github" ? "repo" : provider === "vercel" ? "deployments" : "schemas";
        try {
          const checked = await connectors.readAuthorized(provider, resource.id, op);
          successful++;
          verifiedNames.push(resource.name);
          const finding = observation(provider, checked.data);
          findings.push(displayName(resource.name) + ": " + finding);
          results.push("- " + resource.name + ": consulta de " + (provider === "github" ? "repositório" : provider === "vercel" ? "publicações" : "estrutura do banco") + " concluída.");
          panels.push({label: provider.toUpperCase() + " · " + resource.name, detail: finding});
        } catch {
          failed++;
          failedNames.push(resource.name);
          results.push("- " + resource.name + " | não foi possível consultar agora; não afirmar que o projeto foi verificado.");
          panels.push({label: provider.toUpperCase() + " · " + resource.name, detail: "Consulta indisponível; nenhum resultado confirmado"});
        }
      }
      if (c.resources.length > targets.length)
        results.push("Outros " + (c.resources.length - targets.length) + " projetos autorizados não foram consultados nesta resposta para limitar tempo e volume. Solicite uma consulta específica.");
    }
    const sampleNames = verifiedNames.slice(0, 4).map(name => name.split("/").at(-1)!.replace(/[-_]/g, " "));
    const examples = sampleNames.length ? " Entre os projetos verificados estão " + sampleNames.join(", ") + "." : "";
    const failureNote = failed === 1 ? " Uma consulta não pôde ser concluída" : failed > 1 ? " " + failed + " consultas não puderam ser concluídas" : "";
    const failureDetail = failedNames.length ? ": " + failedNames.slice(0, 2).map(name => name.split("/").at(-1)!.replace(/[-_]/g, " ")).join(" e ") + "." : ".";
    const focused = /detalh|aprofund|resultado|encontr|problema|erro|situacao|diagnostic|analis/.test(n);
    const selectedFindings = focused ? findings.slice(0, 3) : [];
    const text = "Concluí " + successful + (successful === 1 ? " consulta de leitura." : " consultas de leitura.") + examples + (failed ? failureNote + failureDetail : "") + (selectedFindings.length ? " Resultados: " + selectedFindings.join(" ") : "") + " Nenhuma alteração foi feita. Uma consulta concluída não comprova ausência de falhas no projeto.";
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
