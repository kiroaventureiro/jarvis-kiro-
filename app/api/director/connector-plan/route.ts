import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { plannedConnectorReadiness } from "../../../../lib/connector-contracts";

export const dynamic="force-dynamic";
/** Only returns a public-safe plan, never provider credentials or live user data. */
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({
  phase:"architecture_before_access",connections:plannedConnectorReadiness(),
  note:"Contratos em planejamento. Nenhum OAuth, agente Windows ou acesso externo foi ativado.",
 },{headers:{"Cache-Control":"no-store"}});
}
