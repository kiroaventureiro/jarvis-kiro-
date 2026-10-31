import "server-only";
import { readJsonBounded } from "./hub";
import { abacusAgentCapabilities } from "./agent-capabilities";
import { buildAbacusCapabilityReport, canUseAbacusCapability } from "./capability-status";
/** Probe the documented read API; a UI conversation identifier is only a candidate until the API confirms it. */
export async function probeAgentConversation(
  id: string,
  key: string | undefined,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw Error("INVALID_CONVERSATION_ID");
  if (!key)
    return {
      state: "unauthorized",
      metadataVerified: false,
      canContinue: false,
    };
  try {
    const url = new URL(
      "https://api.abacus.ai/api/v0/getDeploymentConversation",
    );
    url.searchParams.set("deploymentConversationId", id);
    url.searchParams.set("limit", "1");
    const response = await fetcher(url, {
      headers: { apiKey: key },
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
        : AbortSignal.timeout(8000),
    });
    if ([401, 403].includes(response.status))
      return {
        state: "unauthorized",
        metadataVerified: false,
        canContinue: false,
      };
    if (!response.ok)
      return {
        state: "unavailable",
        metadataVerified: false,
        canContinue: false,
      };
    const body = (await readJsonBounded(response, 150000)) as Record<
      string,
      unknown
    >;
    const r = body?.result as Record<string, unknown>;
    if (
      body.success !== true ||
      !r ||
      typeof r !== "object" ||
      Array.isArray(r) ||
      r.deploymentConversationId !== id
    )
      return {
        state: "not_verified",
        metadataVerified: false,
        canContinue: false,
      };
    return {
      state: "verified",
      metadataVerified: true,
      canContinue: false,
      conversationType:
        typeof r.conversationType === "string"
          ? r.conversationType.replace(/[^\w -]/g, "").slice(0, 60)
          : "not_reported",
      note: "Somente metadados de leitura confirmados. Inferência, criação e continuação não foram testadas nem autorizadas por este probe.",
    };
  } catch {
    return {
      state: "unavailable",
      metadataVerified: false,
      canContinue: false,
    };
  }
}
export async function answerAbacusAgentQuestion(
  message: string,
  signal?: AbortSignal,
) {
  const n = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    !/\b(abacus|avacus|abagus|chatllm)\b/.test(n) ||
    !/\b(agent|agente|conversa|conversas|brain|studio)\b/.test(n) ||
    !/\b(acesse|acesso|consulte|consigo|consegue|continue|continuar|abra|abrir|integre|integrar|quais|pode|verifique|verifica)\b/.test(
      n,
    )
  )
    return null;
  const id = /[?&]convoId=([a-zA-Z0-9_-]{1,128})\b/.exec(message)?.[1];
  const probe = id
    ? await probeAgentConversation(
        id,
        process.env.ABACUS_PLATFORM_API_KEY || process.env.ABACUS_API_KEY,
        signal,
      )
    : undefined;
  return {
    text:
      (probe
        ? "Verifiquei o identificador fornecido no endpoint documentado de conversas: " +
          probe.state +
          ". "
        : "") +
      "A leitura de projetos e deployments da Developer Platform está implementada. Para conversar com um chatbot deployado, o contrato documentado exige deployment compatível e deploymentToken. Ainda não comprovei que a conversa da aba AI Agent aceita esse contrato, nem tenho uma ponte de navegador instalada no JK. Não iniciei tarefa, conversa nova, vídeo ou gasto. Os adaptadores de imagem, áudio e análise visual têm autorização própria.",
    model: "jk-abacus-agent-capabilities",
    provider: "local_operational" as const,
    usage: null,
    capabilities: abacusAgentCapabilities(false),
    agentExecution: {
      permitted: canUseAbacusCapability(buildAbacusCapabilityReport(), "agent_execution"),
      reason: "Metadados de conversa não comprovam permissão para executar agentes. Requer verificação específica e recente.",
    },
    ...(probe ? { conversationProbe: probe } : {}),
  };
}
