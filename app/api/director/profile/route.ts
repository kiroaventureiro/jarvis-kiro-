import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { getJarvisProfile, getIntegrationStatus } from "../../../../lib/jarvis-profile";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await authorized())) return NextResponse.json({error:"Não autorizado"},{status:401});
  return NextResponse.json({
    profile:getJarvisProfile(),
    integrations:getIntegrationStatus(),
    warning:"Catálogo declarativo. Integrações não são autenticadas por esta rota.",
  },{headers:{"Cache-Control":"no-store"}});
}
