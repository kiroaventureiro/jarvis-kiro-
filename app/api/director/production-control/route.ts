import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { plannedProductionCapabilities } from "../../../../lib/production-control-contracts";
export const dynamic = "force-dynamic";
export async function GET() {
 if (!(await authorized())) return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({phase:"architecture_only",capabilities:plannedProductionCapabilities(),
  warning:"Nenhum comando no OBS, KIRO TV ou n8n foi executado."},
  {headers:{"Cache-Control":"no-store"}});
}
export async function POST() {
 if (!(await authorized())) return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({error:"Execução bloqueada até autorização específica e implementação do agente."},{status:403});
}
