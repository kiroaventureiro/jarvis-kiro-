import "server-only";
import { connectorStore, connectors } from "./server";
import {
  serviceStatus,
  type OperationalSnapshot,
  type ServiceId,
} from "../operational/state";
import catalog from "../../config/connection-catalog.json";
import { hmlAvailability } from "../n8n/discovery";
import { workspaceAuthorization } from "./authorization-status";
export async function withNativeConnectors(
  input: OperationalSnapshot,
  verify = false,
): Promise<OperationalSnapshot> {
  const snapshot = structuredClone(input);
  const hml = await hmlAvailability(verify);
  if (hml.configured) {
    const before = snapshot.integrations.findIndex(s => s.id === "n8n");
    const status = serviceStatus({
      id: "n8n", name: "n8n — homologação", configured: true,
      configurationValid: hml.configurationValid, authorized: false,
      note: "Transporte HML separado do catálogo administrativo. Somente simulações; ações externas não habilitadas. Teste em /integracoes/hml.",
    }, verify && hml.configurationValid ? {
      ok: hml.verified, checkedAt: Date.now(), checks: hml.verified ? ["authenticated_hml_status"] : [],
      ...(!hml.verified ? { failure: "verification_unavailable" as const } : {}),
    } : undefined);
    if (before >= 0) snapshot.integrations[before] = status;
    else snapshot.integrations.push(status);
  }
  if (!connectorStore.configured()) {
    snapshot.nativeRegistryState = "not_configured";
    return snapshot;
  }
  try {
    let state = await connectorStore.read();
    if (verify)
      await Promise.all(
        (["github", "supabase", "vercel"] as const).map(async (p) => {
          const c = state.connections[p];
          if (
            c?.status === "connected" &&
            c.credentials &&
            (!c.verifiedAt || Date.now() - Date.parse(c.verifiedAt) >= 60000)
          )
            try {
              await connectors.test(p);
            } catch {
              /* Status is persisted by the connector, never inferred as success. */
            }
        }),
      );
    state = await connectorStore.read();
    snapshot.nativeRegistryState = "ready";
    for (const provider of ["google", "microsoft"] as const) {
      const view = workspaceAuthorization(state, provider);
      if (!view.saved) continue;
      const old = snapshot.integrations.findIndex(s => s.id === provider);
      const prior = old >= 0 ? snapshot.integrations[old] : undefined;
      // Grants persist across deploys. Old per-service reads do not prove a
      // fresh full-provider test and must never erase the saved authorization.
      const status = serviceStatus({
        id: provider, name: provider === "google" ? "Google" : "Microsoft",
        configured: true, configurationValid: prior?.configurationValid ?? false,
        authorized: view.services.length > 0,
        note: "Autorização salva no cofre para: " + view.services.map(s => s.name).join(", ") + ". Somente metadados; nenhuma leitura de serviço realizada nesta consulta. Não afirme revogação por falta de verificação recente.",
      }, undefined);
      if (old >= 0) snapshot.integrations[old] = status;
      else snapshot.integrations.push(status);
    }
    for (const p of ["github", "supabase", "vercel"] as const) {
      const c = state.connections[p];
      if (!c?.credentials || c.status === "disconnected") continue;
      const id: ServiceId = p === "supabase" ? "supabase-admin" : p,
        old = snapshot.integrations.find((s) => s.id === id);
      const testedAt = c.lastTestAt || c.verifiedAt;
      const readIsNewer =
        !!c.lastReadAt &&
        (!testedAt || Date.parse(c.lastReadAt) >= Date.parse(testedAt));
      const evidenceAt = readIsNewer ? c.lastReadAt : testedAt;
      const result = serviceStatus(
        {
          id,
          name:
            p === "supabase"
              ? "Supabase administrativo"
              : p === "github"
                ? "GitHub"
                : "Vercel",
          configured: true,
          configurationValid: true,
          authorized:
            c.status === "connected" &&
            c.grants.includes("read") &&
            c.resources.length > 0,
          note: "Conector nativo; leitura limitada aos projetos escolhidos. Toda gravação exige plano aprovado. Memória Supabase é independente.",
        },
        evidenceAt
          ? {
              ok: (readIsNewer || !c.lastError) && c.status === "connected",
              checkedAt: Date.parse(evidenceAt),
              checks: readIsNewer
                ? ["authorized_read:" + c.lastReadOperation]
                : ["authorized_resource_listing"],
              ...(!readIsNewer && c.lastError
                ? { failure: "permission" as const }
                : {}),
            }
          : undefined,
      );
      if (old)
        snapshot.integrations[snapshot.integrations.indexOf(old)] = result;
      else snapshot.integrations.push(result);
    }
    const baseRows = catalog.items.filter((item) =>
      ["github", "vercel", "supabase"].includes(item.name.toLowerCase()),
    );
    for (const item of baseRows) {
      const name = item.name.toLowerCase(),
        before = input.integrations.filter((x) =>
          name === "supabase" ? x.id === "supabase-memory" : x.id === name,
        ),
        after = snapshot.integrations.filter((x) =>
          name === "supabase"
            ? ["supabase-memory", "supabase-admin"].includes(x.id)
            : x.id === name,
        );
      const was = before.some((x) => x.configured),
        is = after.some((x) => x.configured);
      snapshot.catalog.notConfigured += Number(!is) - Number(!was);
      snapshot.catalog.needsValidation +=
        Number(is && !after.some((x) => x.verified)) -
        Number(was && !before.some((x) => x.verified));
    }
    return snapshot;
  } catch {
    snapshot.nativeRegistryState = "unavailable";
    return snapshot;
  }
}
