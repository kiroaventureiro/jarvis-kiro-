import { operationalSnapshotLive } from "../../../../lib/operational/server";
import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { getIntegrationReadiness } from "../../../../lib/integration-readiness";
export const dynamic = "force-dynamic";

/** Authenticated owner-only, metadata only. Never return environment variable values. */
export async function GET() {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const operational = await operationalSnapshotLive();
  return NextResponse.json(
    {
      stage: "operational_registry",
      operational: operational,
      liveValidationDeferred: !operational.integrations.some((x) => x.verified),
      integrations: getIntegrationReadiness(operational),
      warning:
        "Credenciais presentes não significam integração ativa. Nenhuma conexão externa é testada nesta rota.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
