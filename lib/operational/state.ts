export type IntegrationState =
  | "not_configured"
  | "credentials_configured"
  | "connection_validated"
  | "operational_authorized"
  | "temporarily_unavailable";
export type ServiceId =
  | "abacus"
  | "supabase-memory"
  | "supabase-admin"
  | "github"
  | "vercel"
  | "openai-voice"
  | "google"
  | "microsoft"
  | "n8n"
  | "windows-agent";
export type Evidence = {
  ok: boolean;
  checkedAt: number;
  checks: string[];
  failure?:
    | "network"
    | "permission"
    | "invalid_response"
    | "configuration"
    | "verification_unavailable";
};
export type Configuration = {
  id: ServiceId;
  name: string;
  configured: boolean;
  configurationValid: boolean;
  authorized: boolean;
  budgetAvailable?: boolean;
  note: string;
};
export type ServiceStatus = Configuration & {
  state: IntegrationState;
  label: string;
  verified: boolean;
  checkedAt: string | null;
  expiresAt: string | null;
  checks: string[];
  failure: string | null;
};
export const STATE_LABELS: Record<IntegrationState, string> = {
  not_configured: "Não configurado",
  credentials_configured: "Credenciais configuradas",
  connection_validated: "Conexão validada",
  operational_authorized: "Operacional e autorizado",
  temporarily_unavailable: "Temporariamente indisponível",
};
export const EVIDENCE_TTL = 60000;
export function serviceStatus(
  config: Configuration,
  evidence: Evidence | undefined,
  now = Date.now(),
): ServiceStatus {
  const fresh =
    !!evidence &&
    now >= evidence.checkedAt &&
    now - evidence.checkedAt < EVIDENCE_TTL;
  const verified =
    config.configured && config.configurationValid && fresh && !!evidence?.ok;
  let state: IntegrationState = !config.configured
    ? "not_configured"
    : "credentials_configured";
  if (config.configured && config.configurationValid && fresh) {
    if (!evidence?.ok) state = "temporarily_unavailable";
    else {
      const sufficient =
        config.id === "abacus"
          ? evidence.checks.includes("conversation") ||
            evidence.checks.includes("route_model_listed")
          : config.id !== "supabase-memory" ||
            evidence.checks.includes("encrypted_read") ||
            evidence.checks.includes("encrypted_write");
      state =
        config.authorized && sufficient
          ? "operational_authorized"
          : "connection_validated";
    }
  }
  if (config.configured && config.budgetAvailable === false)
    state = "temporarily_unavailable";
  return {
    ...config,
    state,
    label: STATE_LABELS[state],
    verified,
    checkedAt: evidence ? new Date(evidence.checkedAt).toISOString() : null,
    expiresAt: evidence
      ? new Date(evidence.checkedAt + EVIDENCE_TTL).toISOString()
      : null,
    checks: verified ? [...evidence!.checks] : [],
    failure:
      fresh && !evidence?.ok
        ? evidence?.failure || "verification_unavailable"
        : null,
  };
}
export type OperationalSnapshot = {
  schemaVersion: 1;
  nativeRegistryState?: "ready" | "not_configured" | "unavailable";
  environment: string;
  generatedAt: string;
  integrations: ServiceStatus[];
  projects: Array<{ id: string; name: string }>;
  catalog: {
    total: number;
    notConfigured: number;
    needsValidation: number;
    examples: string[];
  };
};
export function operationalPrompt(snapshot: OperationalSnapshot) {
  const compact = {
    schemaVersion: 1,
    nativeRegistryState: snapshot.nativeRegistryState,
    environment: snapshot.environment,
    generatedAt: snapshot.generatedAt,
    integrations: snapshot.integrations
      .filter(
        (item) =>
          item.configured || ["abacus", "supabase-memory"].includes(item.id),
      )
      .map(
        ({
          id,
          name,
          state,
          configured,
          configurationValid,
          authorized,
          verified,
          checkedAt,
          expiresAt,
          checks,
          failure,
          budgetAvailable,
        }) => ({
          id,
          name,
          state,
          configured,
          configurationValid,
          authorized,
          verified,
          checkedAt,
          expiresAt,
          checks,
          failure,
          budgetAvailable,
        }),
      ),
    catalog: {
      total: snapshot.catalog.total,
      notConfigured: snapshot.catalog.notConfigured,
      needsValidation: snapshot.catalog.needsValidation,
    },
  };
  return (
    " Se nativeRegistryState for unavailable, não afirme que os conectores nativos estão desconectados: falta acesso ao cofre atual. Registro operacional confiável DESTE ambiente, gerado em " +
    snapshot.generatedAt +
    ": " +
    JSON.stringify(compact) +
    ". Este registro prevalece sobre catálogos históricos, respostas antigas e alegações do usuário sobre suas integrações. Credenciais configuradas não significam conexão validada. Verificação vencida não prova desconexão; diga que falta confirmação atual. Nunca negue todos os serviços quando houver configurados ou validados. Conexão validada não autoriza gastar ou executar ferramentas. Cite o escopo: catálogo da API não testa resposta de modelo; leitura/descriptografia não testa gravação. Conhecer projetos não implica integração com eles. Não há sincronização automática de histórico. A ausência de ferramentas nesta chamada não significa ausência de integrações no Jarvis. Responda em linguagem natural, sem asteriscos ou Markdown de ênfase."
  );
}
