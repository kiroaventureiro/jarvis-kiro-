/**
 * Navi bridge foundation. No network request is made by this module.
 * The ChatGPT session and Codex desktop session are NOT accessible through an API key.
 */
export type NaviCapability = "conversation" | "project_context" | "codex_delegation";
export type NaviBridgeState = "disabled" | "needs_configuration" | "awaiting_billing_authorization" | "ready_for_validation";
export type NaviBridgeStatus = {
  state: NaviBridgeState;
  capabilities: Record<NaviCapability, "planned" | "configuration_required">;
  reason: string;
};
export function naviBridgeStatus(env: Record<string, string | undefined>): NaviBridgeStatus {
  const enabled = env.JARVIS_NAVI_ENABLED === "true";
  const hasKey = Boolean(env.OPENAI_API_KEY?.trim());
  const billingAuthorized = env.JARVIS_OPENAI_API_BILLING_AUTHORIZED === "true";
  return {
    state: !enabled ? "disabled" : !hasKey ? "needs_configuration" : !billingAuthorized ? "awaiting_billing_authorization" : "ready_for_validation",
    capabilities: {
      conversation: enabled && hasKey && billingAuthorized ? "configuration_required" : "planned",
      project_context: "planned",
      codex_delegation: "planned",
    },
    reason: !enabled
      ? "Ponte Navi desativada por padrão. Nenhuma chamada OpenAI é feita."
      : !hasKey
        ? "Falta uma credencial de servidor. Não informe chaves na conversa."
        : !billingAuthorized
          ? "Credencial presente, mas a utilização da OpenAI API ainda não foi autorizada no servidor."
          : "Executor implementado; faltam validação funcional com provedor e habilitação na interface.",
  };
}
