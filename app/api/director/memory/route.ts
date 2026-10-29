import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { lookupJarvisMemory } from "../../../../lib/jarvis-memory";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 const query=new URL(request.url).searchParams.get("q")?.trim()??"";
 if(query.length<3||query.length>160)return NextResponse.json({error:"Consulta deve ter de 3 a 160 caracteres"},{status:400});
 return NextResponse.json({records:lookupJarvisMemory(query),source:"curated_versioned_index",liveConnectorAccess:false},{headers:{"Cache-Control":"no-store"}});
}
