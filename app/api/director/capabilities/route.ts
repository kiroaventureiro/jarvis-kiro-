import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { codexWorkerReadiness } from "../../../../lib/codex/worker-readiness";
import { companionStatus } from "../../../../lib/companion/contract";

export const dynamic = "force-dynamic";
/** Operational capability report. No provider requests, billing, or device connections. */
export async function GET() {
  if (!(await authorized())) return NextResponse.json({error:"Sessão necessária"},{status:401,headers:{"Cache-Control":"no-store"}});
  const naviEnabled=process.env.JARVIS_NAVI_ENABLED==="true";
  const naviConfigured=!!process.env.OPENAI_API_KEY;
  const billingApproved=process.env.JARVIS_OPENAI_API_BILLING_AUTHORIZED==="true";
  return NextResponse.json({
    codex:codexWorkerReadiness(),
    navi:{
      configured:naviConfigured,
      enabled:naviEnabled,
      billingApproved,
      available:naviEnabled&&naviConfigured&&billingApproved
    },
    companion:companionStatus,
    note:"Disponibilidade de configuração não comprova execução, conexão ao dispositivo ou entrega de resposta."
  },{headers:{"Cache-Control":"private, no-store"}});
}
