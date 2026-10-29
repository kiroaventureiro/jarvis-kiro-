import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { buildSocialOverview } from "../../../../lib/jarvis-social-hub";
export const dynamic="force-dynamic";
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({stage:"architecture_only",networks:buildSocialOverview(),dataAvailable:false,
  note:"Nenhuma API de rede social foi autenticada. Nenhuma publicação está disponível."},
  {headers:{"Cache-Control":"no-store"}});
}
