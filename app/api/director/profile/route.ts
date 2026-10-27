import { operationalSnapshot } from "../../../../lib/operational/server";
import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import {
  getJarvisProfile,
  getIntegrationStatus,
} from "../../../../lib/jarvis-profile";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json(
    {
      operational: operationalSnapshot(),
      profile: getJarvisProfile(),
      integrations: getIntegrationStatus(),
      warning:
        "Catálogo declarativo e registro operacional são distintos; somente evidência recente valida uma conexão.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
