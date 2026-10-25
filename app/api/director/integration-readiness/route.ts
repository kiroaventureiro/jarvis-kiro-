import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { getIntegrationReadiness } from "../../../../lib/integration-readiness";
export const dynamic = "force-dynamic";

/** Authenticated owner-only, metadata only. Never return environment variable values. */
export async function GET() {
  if (!(await authorized())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json({
    stage: "architecture_first",
    liveValidationDeferred: true,
    integrations: getIntegrationReadiness(),
    warning: "Credenciais presentes não significam integração ativa. Nenhuma conexão externa é testada nesta rota.",
  }, { headers: { "Cache-Control": "no-store" } });
}
