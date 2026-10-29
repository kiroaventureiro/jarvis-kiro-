import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { INDEX_POLICY } from "../../../../lib/project-reference-index";
export const dynamic="force-dynamic";
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({stage:"contract_only",providers:["github","google_drive","onedrive","chatgpt_import","local_agent"],
 policy:INDEX_POLICY,indexedReferences:null,connected:false,
 note:"Índice planejado. Ainda não há coleta, sincronização ou importação de conversas."},
 {headers:{"Cache-Control":"no-store"}});
}
