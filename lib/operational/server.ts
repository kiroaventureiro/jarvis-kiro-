import "server-only";
import { withNativeConnectors } from "../connectors/native-status";
import { createHash } from "node:crypto";
import catalog from "../../config/connection-catalog.json";
import projects from "../../config/kiro-project-registry.json";
import { memoryConfigured, inspectServerMemory } from "../server-memory";
import { costPermission, providerCallBudget } from "../voice/cost-policy";
import { abacusUsage, tokenLimit } from "../abacus/usage";
import { OperationalRegistry } from "./registry";
import { probeAbacusCatalog } from "./probes";
import { operationalPrompt, type Configuration, type ServiceId } from "./state";
import { operationalQuestion, operationalAnswer } from "./questions";
const specs: Array<{ id: ServiceId; name: string; required: string[] }> = [
  { id: "abacus", name: "Abacus RouteLLM", required: ["ABACUS_API_KEY"] },
  {
    id: "supabase-memory",
    name: "Supabase e memória criptografada",
    required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  { id: "github", name: "GitHub", required: ["GITHUB_READ_TOKEN"] },
  { id: "vercel", name: "Vercel", required: ["VERCEL_API_TOKEN"] },
  { id: "openai-voice", name: "OpenAI voice", required: ["OPENAI_API_KEY"] },
  {
    id: "google",
    name: "Google Drive/Gmail/Calendar",
    required: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    id: "microsoft",
    name: "Microsoft OneDrive/Outlook",
    required: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
  },
  { id: "n8n", name: "n8n", required: ["N8N_BASE_URL", "N8N_API_KEY"] },
  {
    id: "windows-agent",
    name: "OBS/KIRO TV Windows Agent",
    required: ["WINDOWS_AGENT_BASE_URL", "WINDOWS_AGENT_SHARED_SECRET"],
  },
];
function environment() {
  const name = process.env.VERCEL_ENV;
  return name && ["preview", "production", "development"].includes(name)
    ? name
    : process.env.NODE_ENV === "test"
      ? "test"
      : "local";
}
function keyFor(id: ServiceId) {
  const spec = specs.find((x) => x.id === id)!;
  return createHash("sha256")
    .update(
      JSON.stringify([
        environment(),
        id,
        ...spec.required.map((k) => process.env[k] || ""),
        id === "supabase-memory"
          ? process.env.JARVIS_MEMORY_ENCRYPTION_KEY || ""
          : "",
      ]),
    )
    .digest("hex");
}
function configurations(): Configuration[] {
  const policy = costPermission("abacus", process.env),
    usage = abacusUsage.stats(),
    remainingTokens =
      usage.totalTokens +
        usage.unverifiedReservedTokens +
        usage.reservedTokens <
      tokenLimit(process.env);
  return specs.map((spec) => {
    const configured = spec.required.every((k) => !!process.env[k]?.trim());
    const valid =
      spec.id === "supabase-memory" ? memoryConfigured() : configured;
    return {
      id: spec.id,
      name: spec.name,
      configured,
      configurationValid: valid,
      authorized:
        spec.id === "abacus"
          ? policy.allowed
          : spec.id === "supabase-memory" && valid,
      ...(spec.id === "abacus"
        ? {
            budgetAvailable:
              !policy.allowed ||
              (remainingTokens &&
                providerCallBudget.available("abacus", policy)),
          }
        : {}),
      note:
        spec.id === "supabase-memory" && !valid
          ? "A configuração completa exige endpoint permitido, credencial de servidor e chave AES-256 válida."
          : spec.id === "abacus"
            ? "Validação por catálogo não executa modelos; uso pago segue a política existente."
            : "Configuração não equivale a OAuth, conexão testada ou execução autorizada.",
    };
  });
}
export const operationalRegistry = new OperationalRegistry({
  configurations,
  keyFor,
  probes: {
    abacus: (signal) =>
      probeAbacusCatalog(process.env.ABACUS_API_KEY!.trim(), signal),
    "supabase-memory": inspectServerMemory,
  },
  projects: projects.projects.map((p) => ({ id: p.id, name: p.name })),
  catalog: catalog.items,
  environment,
});
export function operationalSnapshot() {
  return operationalRegistry.snapshot();
}
export async function operationalSnapshotLive(verify = false) {
  return withNativeConnectors(operationalSnapshot(), verify);
}
export async function operationalContext(message = "", signal?: AbortSignal) {
  const kind = operationalQuestion(message);
  const coreSnapshot = await operationalRegistry.read({
    verify: !!kind && kind !== "projects",
    ids:
      kind === "abacus"
        ? ["abacus"]
        : kind === "memory"
          ? ["supabase-memory"]
          : undefined,
    signal,
  });
  const snapshot = await withNativeConnectors(
    coreSnapshot,
    !!kind && kind !== "projects",
  );
  return operationalPrompt(snapshot);
}
export async function answerOperationalQuestion(
  message: string,
  signal: AbortSignal,
) {
  const kind = operationalQuestion(message);
  if (!kind) return null;
  const coreSnapshot = await operationalRegistry.read({
    verify: kind !== "projects",
    ids:
      kind === "abacus"
        ? ["abacus"]
        : kind === "memory"
          ? ["supabase-memory"]
          : undefined,
    signal,
  });
  const snapshot = await withNativeConnectors(
    coreSnapshot,
    kind !== "projects",
  );
  return {
    text:
      snapshot.nativeRegistryState === "unavailable" &&
      (kind === "overview" || kind === "github" || kind === "vercel")
        ? "O cofre dos conectores nativos está temporariamente indisponível. Não posso confirmar seus estados atuais nem afirmar que estão desconectados."
        : operationalAnswer(kind, snapshot),
    model: "jarvis-operational",
    usage: null,
    provider: "local_operational",
    operational: snapshot,
  };
}
export function recordOperationalSuccess(id: ServiceId, checks: string[]) {
  operationalRegistry.record(id, true, checks);
}
export function recordOperationalFailure(id: ServiceId) {
  operationalRegistry.record(id, false, [], "verification_unavailable");
}
