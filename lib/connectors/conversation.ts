import "server-only";
import { connectors, connectorStore } from "./server";
import { type Provider } from "./types";

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
  const all = /\b(todos|todas|tudo|conexoes|integracoes|plataformas)\b/.test(n);
  const providers = mentioned.length ? (all ? (Object.keys(READ_PROVIDERS) as Provider[]) : mentioned) : all ? (Object.keys(READ_PROVIDERS) as Provider[]) : [];
  if (!providers.length) return null;
  if (!connectorStore.configured())
    return { text: "O cofre dos conectores não está configurado neste ambiente.", model: "jk-tools", provider: "local_operational" as const, usage: null };
  try {
    const state = await connectorStore.read();
    const results: string[] = [];
    for (const provider of providers) {
      const c = state.connections[provider];
      if (!c || c.status !== "connected") { results.push(provider + ": sem conexão ativa."); continue; }
      if (!c.grants.includes("read")) { results.push(provider + ": leitura não autorizada."); continue; }
      if (!c.resources.length) { results.push(provider + ": conectado, mas nenhum projeto foi autorizado no JK."); continue; }
      results.push(provider.toUpperCase() + ": " + c.resources.length + " projeto(s) autorizado(s).");
      const targets = c.resources.slice(0, 5);
      for (const resource of targets) {
        const op = provider === "github" ? "repo" : provider === "vercel" ? "deployments" : "schemas";
        try {
          const checked = await connectors.readAuthorized(provider, resource.id, op);
          const result = JSON.stringify(checked.data).slice(0, 1400);
          results.push("- " + resource.name + " | consulta real " + op + " em " + checked.checkedAt + " | " + result);
        } catch {
          results.push("- " + resource.name + " | não foi possível consultar agora; não afirmar que o projeto foi verificado.");
        }
      }
      if (c.resources.length > targets.length)
        results.push("Outros " + (c.resources.length - targets.length) + " projetos autorizados não foram consultados nesta resposta para limitar tempo e volume. Solicite uma consulta específica.");
    }
    return { text: "Diagnóstico operacional de leitura. Fontes: consultas realizadas aos conectores nativos autorizados.\n" + results.join("\n") + "\nNenhuma alteração foi executada. Resultados externos não comprovam ausência de erros; para auditoria profunda é necessário ler arquivos e testes específicos.", model: "jk-tools", provider: "local_operational" as const, usage: null };
  } catch {
    return { text: "Não consegui consultar o cofre dos conectores agora. Não posso garantir que as contas estejam desconectadas.", model: "jk-tools", provider: "local_operational" as const, usage: null };
  }
}
