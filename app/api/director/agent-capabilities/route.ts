import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { capabilityInventory } from "../../../../lib/agents/capability-inventory";
import { connectorStore, connectors } from "../../../../lib/connectors/server";
import { AGENT_TRANSPORT } from "../../../../lib/agent-transport-contract";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Authenticated inventory, no network probe or credential material. */
export async function GET() {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers });

  const inventory = capabilityInventory();
  let connectorsState: "vault_not_configured" | "vault_unavailable" | "available" = "vault_not_configured";
  let providers: Array<{ id: string; state: string; resourceCount: number; lastVerifiedAt: string | null; writeAllowed: boolean }> = [];

  if (connectorStore.configured()) {
    try {
      const overview = await connectors.overview();
      providers = overview.providers.map(p => {
        const c = p.connection;
        const hasResources = !!c?.resources?.length;
        const verified = !!c?.verifiedAt && c.status === "connected" && hasResources;
        return {
          id: p.provider,
          state: !c ? "not_connected" : !verified ? "not_verified" : "verified_metadata_only",
          resourceCount: c?.resources?.length || 0,
          lastVerifiedAt: c?.verifiedAt || null,
          writeAllowed: !!c?.grants?.some(g => ["write", "deploy", "configure"].includes(g)) && !!p.writeAllowlist.length,
        };
      });
      connectorsState = "available";
    } catch {
      connectorsState = "vault_unavailable";
    }
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(), inventory, connectors: { state: connectorsState, providers },
    agentTransport: {
      state: AGENT_TRANSPORT.enabled ? "configured" : "not_configured",
      remoteExecutionAvailable: AGENT_TRANSPORT.enabled && AGENT_TRANSPORT.allowRemoteExecution,
    },
    note: "Credencial e último teste não comprovam execução atual. Cada operação requer validação de permissões e resultado real. Repositórios externos são candidatos, não agentes ativados.",
  }, { headers });
}
