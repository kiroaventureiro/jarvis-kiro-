import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { continuityChecklist } from "../../../../lib/kiro-continuity";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 const project=new URL(request.url).searchParams.get("project")??"";
 if(!/^[a-z0-9-]{2,60}$/.test(project))return NextResponse.json({error:"Projeto inválido"},{status:400});
 return NextResponse.json(continuityChecklist(project),{headers:{"Cache-Control":"no-store"}});
}
