import "server-only";
import { connectorStore, connectors } from "./server";
import {
  serviceStatus,
  type OperationalSnapshot,
  type ServiceId,
} from "../operational/state";
import catalog from "../../config/connection-catalog.json";
export async function withNativeConnectors(
  input: OperationalSnapshot,
  verify = false,
): Promise<OperationalSnapshot> {
  const snapshot = structuredClone(input);
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
    for (const p of ["github", "supabase", "vercel"] as const) {
      const c = state.connections[p];
      if (!c?.credentials || c.status === "disconnected") continue;
      const id: ServiceId = p === "supabase" ? "supabase-admin" : p,
        old = snapshot.integrations.find((s) => s.id === id);
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
        c.lastTestAt || c.verifiedAt
          ? {
              ok: !c.lastError && c.status === "connected",
              checkedAt: Date.parse(c.lastTestAt || c.verifiedAt!),
              checks: ["authorized_resource_listing"],
              ...(c.lastError ? { failure: "permission" as const } : {}),
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
