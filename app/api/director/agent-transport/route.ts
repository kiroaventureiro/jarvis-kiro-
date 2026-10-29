import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { AGENT_TRANSPORT } from "../../../../lib/agent-transport-contract";
export const dynamic="force-dynamic";
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({status:"not_configured",contract:AGENT_TRANSPORT,
 note:"Contrato criado, mas não existe comunicação autenticada ou recebimento de webhooks."},
 {headers:{"Cache-Control":"no-store"}});
}
export async function POST(){
 return NextResponse.json({error:"Canal de transporte inativo; verificação de assinatura e replay ainda não implementadas"},{status:503});
}
