import "server-only";
import { connectorStore } from "../connectors/server";
import { listN8nWorkflows } from "../n8n/connection";
import { catalogReportConfigured } from "../n8n/catalog-run";
import { skillToolBindings, agentToolBindings, skillInventoryIntent } from "./skill-tools";

/** Explicitly projects only non-secret state. Saved authorization is not a live test. */
export async function discoverSkillTools(verify = false, signal?: AbortSignal) {
  const configured = connectorStore.configured();
  const state = configured ? await connectorStore.read() : null;
  const direct = (["github", "supabase", "vercel"] as const).map(provider => {
    const connection = state?.connections[provider];
    return { provider, authorized: connection?.status === "connected" && connection.grants.includes("read") && connection.resources.length > 0,
      resources: connection?.status === "connected" ? connection.resources.length : 0,
      verifiedAt: connection?.verifiedAt || null, checkedNow: false };
  });
  const n8n = { authorized: !!state?.n8n, verifiedNow: false, checkedAt: null as string | null,
    workflowCount: null as number | null, partial: false, error: null as string | null,
    reportConfigured: !!state?.n8n && catalogReportConfigured() };
  if (verify && state?.n8n) {
    n8n.checkedAt = new Date().toISOString();
    try {
      const result = await listN8nWorkflows(signal);
      n8n.verifiedNow = true; n8n.workflowCount = result.workflows.length; n8n.partial = result.partial;
    } catch { n8n.error = "N8N_READ_NOT_CONFIRMED"; }
  }
  const bindings = skillToolBindings().map(skill => ({ ...skill, tools: skill.tools.map(id => ({
    id, authorized: id.startsWith("n8n.") ? n8n.authorized : direct.find(d => d.provider === "github")!.authorized,
    verifiedNow: id.startsWith("n8n.") && n8n.verifiedNow,
  })) }));
  return { skills: bindings, agents: agentToolBindings(), direct, n8n,
    runnerAvailable: false, autonomousAgentsAvailable: false,
    note: "Orientação disponível para todos os skills. Conexões diretas e n8n mantêm seus próprios escopos. Leitura não comprova execução de testes, scanners, SQL ou alterações." };
}
export async function answerSkillRequest(message: string, signal?: AbortSignal) {
  if (!skillInventoryIntent(message)) return null;
  try {
    const data = await discoverSkillTools(true, signal);
    return { text: "Tenho " + data.skills.length + " skills de engenharia e " + data.agents.length +
      " perfis especialistas incorporados às respostas. Skills: " + data.skills.map(s => s.id).join(", ") +
      ". Perfis: " + data.agents.map(a => a.id).join(", ") + ". " +
      (data.n8n.verifiedNow ? "Consultei agora o n8n: " + data.n8n.workflowCount + " workflows" + (data.n8n.partial ? " nesta página parcial" : "") + ". A leitura de catálogo e estrutura está ligada aos skills aplicáveis. " :
        data.n8n.authorized ? "A autorização n8n está salva, mas não confirmei a leitura agora. " : "O n8n ainda precisa de conexão neste ambiente. ") +
      "Conexões diretas com autorização de leitura salva: " + (data.direct.filter(d => d.authorized).map(d => d.provider).join(", ") || "nenhuma") +
      "; não foram testadas nesta consulta. O relatório n8n usa o executor específico já implementado. " +
      "Git, SQL, Playwright, Jest, tsc, Nx, Turbo, Bazel e scanners precisam de seus próprios executores; não estão instalados por estes perfis. " +
      "Veja o vínculo e os requisitos de cada skill em /controle. Para executar o relatório real, peça: Jarvis, gere um relatório dos workflows no n8n.",
      model: "jk-skill-discovery", provider: "local_operational" as const, usage: null };
  } catch {
    return { text: "Não consegui verificar as ferramentas dos skills agora. Isso não comprova desconexão. Nenhuma execução ou instalação foi realizada.",
      model: "jk-skill-discovery", provider: "local_operational" as const, usage: null };
  }
}
