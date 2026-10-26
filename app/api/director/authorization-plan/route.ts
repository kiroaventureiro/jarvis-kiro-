import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { CONNECTION_GUARDRAILS } from "../../../../lib/connector-authorization-policy";
export const dynamic="force-dynamic";
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({phase:"authorization_architecture_only",connectedProviders:0,
 policy:CONNECTION_GUARDRAILS,tokenVaultReady:false,oauthCallbacksReady:false,
 note:"Nenhuma autenticação OAuth foi iniciada; não existe compartilhamento automático de conexões do ChatGPT."},
 {headers:{"Cache-Control":"no-store"}});
}
