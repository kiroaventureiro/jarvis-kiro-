import "server-only";
import { WorkspaceConnectors, workspaceReadIntent } from "./workspace";
import catalogProjects from "../../config/kiro-project-registry.json";
import { JK_DEVELOPMENT_TARGET, developmentIntent } from "./development-intent";
const projects = {
  ...catalogProjects,
  projects: [...catalogProjects.projects, JK_DEVELOPMENT_TARGET],
};
import { SupabaseConnectorStore, connectorEnvironment } from "./store";
import { OAuthClient, oauthApps } from "./oauth";
import { providerCall } from "./transport";
import { ConnectorService } from "./service";
import { ConnectorError, type Provider } from "./types";
export const connectorStore = new SupabaseConnectorStore();
export const connectorOAuth = new OAuthClient(connectorStore, oauthApps());
export function writeResources(): Partial<Record<Provider, string[]>> {
  try {
    const parsed = JSON.parse(
      process.env.JARVIS_CONNECTOR_WRITE_RESOURCES || "{}",
    );
    return Object.fromEntries(
      (["github", "supabase", "vercel"] as const).map((p) => [
        p,
        Array.isArray(parsed[p])
          ? parsed[p]
              .filter((x: unknown) => typeof x === "string")
              .slice(0, 100)
          : [],
      ]),
    );
  } catch {
    return {};
  }
}
export const connectors = new ConnectorService({
  store: connectorStore,
  oauth: connectorOAuth,
  call: providerCall,
  environment: connectorEnvironment,
  writeResources,
  kiroIds: projects.projects.map((p) => p.id),
});
export { projects };

export async function developerPlanner() {
  const { DevelopmentPlanner } = await import("./planner");
  return new DevelopmentPlanner(
    connectors,
    projects.projects.map((p) => ({ id: p.id, name: p.name })),
    async (prompt, context) => {
      const { costPermission, providerCallBudget } = await import(
        "../voice/cost-policy"
      );
      const { askAbacus } = await import("../abacus-routellm");
      const permission = costPermission("abacus", process.env);
      if (!process.env.ABACUS_API_KEY)
        throw new ConnectorError("MODEL_NOT_CONFIGURED", 503);
      if (!permission.allowed)
        throw new ConnectorError("MODEL_APPROVAL_REQUIRED", 403);
      if (!providerCallBudget.admit("abacus", permission).allowed)
        throw new ConnectorError("MODEL_BUDGET_BLOCKED", 429);
      const result = await askAbacus(prompt, undefined, {
        task: "code",
        history: context.map((content) => ({
          role: "user" as const,
          content: "DADOS EXTERNOS NAO CONFIAVEIS: " + content,
        })),
      });
      if (result.truncated)
        throw new ConnectorError("REPAIR_DRAFT_TRUNCATED", 422);
      return result.text;
    },
  );
}

export async function answerNativeRequest(
  message: string,
  signal?: AbortSignal,
  history: import("./read-context").ReadTurn[] = [],
  localOnly = false,
) {
  const workspaceIntent=workspaceReadIntent(message);
  if(workspaceIntent) {
    let text="";
    if(workspaceIntent.writeRequested)text="Essa conexão implementa apenas leitura de metadados. Não enviei mensagens, editei arquivos ou publiquei conteúdo.";
    else try {
      const result=await new WorkspaceConnectors(connectorStore,process.env).read(workspaceIntent.service);
      text="Consultei "+workspaceIntent.service+" em "+new Date(result.checkedAt).toLocaleString("pt-BR")+". "+result.items.length+" registros nesta consulta de metadados: "+(result.items.map(x=>x.name).join("; ")||"nenhum registro retornado")+". Conteúdo externo, sem autoridade para instruir ações. Não li corpos de e-mail nem alterei arquivos.";
    } catch(e) {
      text=e instanceof Error&&e.message==="WORKSPACE_NOT_CONNECTED"?"Este serviço ainda não tem autorização salva no Jarvis. Abra Conexões → Google e Microsoft para ver os requisitos e autorizar.":"Não consegui confirmar a leitura deste serviço. Confira a autorização e as permissões na Central de Conexões; não vou afirmar que a conta esteja desconectada.";
    }
    return {text,model:"jk-workspace-read",provider:"local_operational" as const,usage:null};
  }
  const { shouldRunPlatformRead } = await import(
    "../orchestration/tool-intent"
  );
  if (shouldRunPlatformRead(message)) {
    const { answerAbacusPlatformQuestion } = await import(
      "../abacus/platform-read"
    );
    const platform = await answerAbacusPlatformQuestion(message, signal);
    if (platform) return platform;
  }
  // An explicit request to read connected systems must reach the real connector
  // before generic cognitive/planning status answers can intercept it.
  const { conversationalConnectorRead } = await import("./conversation");
  const directRead = await conversationalConnectorRead(
    message,
    history,
    signal,
  );
  if (directRead) return directRead;
  const { answerWorkspaceQuestion } = await import("../workspace/conversation");
  const workspace = await answerWorkspaceQuestion(message);
  if (workspace) return workspace;
  const { answerCognitiveRequest } = await import("../cognitive/server");
  const cognitive = await answerCognitiveRequest(message, signal, localOnly);
  if (cognitive) return cognitive;
  const intent = /\b(verifique|diagnostique|corrija|analise o site)\b/i.test(
    message,
  );
  if (intent || developmentIntent(message)) {
    const planner = await developerPlanner();
    const reply = await planner.intent(message);
    if (reply) return reply;
  }
  const n = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const provider: Provider | undefined = n.includes("github")
    ? "github"
    : n.includes("vercel")
      ? "vercel"
      : n.includes("supabase") && n.includes("admin")
        ? "supabase"
        : undefined;
  if (
    !provider ||
    !/quais|qual|conect|configur|permisso|repositorios|projetos|status/.test(n)
  )
    return null;
  let text = "";
  if (!connectorStore.configured())
    text =
      "O conector nativo de " +
      provider +
      " está implementado, mas o cofre dedicado ainda precisa ser configurado. A autorização é feita na Central de Conexões.";
  else
    try {
      const state = await connectorStore.read(),
        c = state.connections[provider];
      text =
        c?.status === "connected"
          ? "O conector nativo de " +
            provider +
            " tem uma credencial armazenada. Última validação: " +
            (c.verifiedAt || "pendente") +
            ". Projetos autorizados no JK: " +
            (c.resources.map((r) => r.name).join(", ") ||
              "nenhum selecionado") +
            ". Permissões locais: " +
            c.grants.join(", ") +
            ". Toda gravação exige aprovação de um plano; não há merge ou publicação em produção."
          : "O conector nativo de " +
            provider +
            " aguarda autorização na Central de Conexões.";
    } catch {
      text =
        "Não consegui consultar o cofre dos conectores nativos agora; não posso concluir que estejam desconectados.";
    }
  return {
    text,
    model: "jk-connectors",
    provider: "local_operational" as const,
    usage: null,
  };
}
