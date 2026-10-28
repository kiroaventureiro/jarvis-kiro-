export type CapabilityState = "supported" | "unsupported" | "not_verified";
export type AgentCapability = {
  id: string;
  state: CapabilityState;
  reason: string;
  executionVerified: boolean;
  source: string;
};
export function abacusAgentCapabilities(
  platformReadVerified: boolean,
): AgentCapability[] {
  return [
    {
      id: "developer-platform-read",
      state: platformReadVerified ? "supported" : "not_verified",
      executionVerified: platformReadVerified,
      reason:
        "Leitura de projetos e deployments; não implica acesso a sessões do ChatLLM.",
      source: "https://api.abacus.ai/help/developer-platform/api",
    },
    {
      id: "deployment-conversation",
      state: "not_verified",
      executionVerified: false,
      reason:
        "getConversationResponse exige deployment compatível e deploymentToken. Não foi feita inferência paga.",
      source: "https://api.abacus.ai/help/developer-platform/useCases/CHAT_LLM",
    },
    {
      id: "existing-chatllm-agent-conversation",
      state: "not_verified",
      executionVerified: false,
      reason:
        "Não há contrato confirmado nesta integração para continuar a conversa da aba AI Agent. convoId da interface não é deploymentConversationId nem credencial.",
      source: "https://api.abacus.ai/help/chatllm-ai-super-assistant",
    },
    {
      id: "browser-agent-bridge",
      state: "unsupported",
      executionVerified: false,
      reason:
        "O runtime JK não tem agente navegador isolado instalado. Sessões do navegador do Codex não são automaticamente acessíveis ao JK.",
      source: "local:jk-runtime",
    },
    {
      id: "chatllm-video-app-task-execution",
      state: "not_verified",
      executionVerified: false,
      reason:
        "Ações e custos não foram verificados por API ou ponte de navegador autorizada.",
      source: "https://api.abacus.ai/help/chatllm-ai-super-assistant",
    },
  ];
}
