import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { runLocalSkill } from "../../../../lib/jarvis-local-skills";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 let body:unknown;
 try{body=await request.json()}catch{return NextResponse.json({error:"JSON inválido"},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Dados inválidos"},{status:400});
 const x=body as Record<string,unknown>;
 if(typeof x.skill!=="string"||x.skill.length>40||
 (x.projectId!==undefined&&(typeof x.projectId!=="string"||x.projectId.length>60))||
 (x.idea!==undefined&&(typeof x.idea!=="string"||x.idea.length>1500))||
 (x.format!==undefined&&!["short_9_16","video_16_9"].includes(String(x.format)))||
 (x.sceneCount!==undefined&&(!Number.isInteger(x.sceneCount)||Number(x.sceneCount)<1||Number(x.sceneCount)>12)))
 return NextResponse.json({error:"Parâmetros inválidos"},{status:400});
 const result=runLocalSkill(x);
 return NextResponse.json(result,{status:result.ok?200:400,headers:{"Cache-Control":"no-store"}});
}
