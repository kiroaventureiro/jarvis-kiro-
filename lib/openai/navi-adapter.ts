/**
 * Navi bridge foundation. No network request is made by this module.
 * The ChatGPT session and Codex desktop session are NOT accessible through an API key.
 */
export type NaviCapability = "conversation" | "project_context" | "codex_delegation";
export type NaviBridgeState = "disabled" | "needs_configuration" | "ready_for_validation";
export type NaviBridgeStatus = {
  state: NaviBridgeState;
  capabilities: Record<NaviCapability, "planned" | "configuration_required">;
  reason: string;
};
export function naviBridgeStatus(env: Record<string, string | undefined>): NaviBridgeStatus {
  const enabled = env.JARVIS_NAVI_ENABLED === "true";
  const hasKey = Boolean(env.OPENAI_API_KEY?.trim());
  return {
    state: !enabled ? "disabled" : !hasKey ? "needs_configuration" : "ready_for_validation",
    capabilities: {
      conversation: enabled && hasKey ? "configuration_required" : "planned",
      project_context: "planned",
      codex_delegation: "planned",
    },
    reason: !enabled
      ? "Ponte Navi desativada por padrão. Nenhuma chamada OpenAI é feita."
      : !hasKey
        ? "Falta uma credencial de servidor. Não informe chaves na conversa."
        : "Credencial configurada; executor e autorização de custos ainda não implementados nem validados.",
  };
}
