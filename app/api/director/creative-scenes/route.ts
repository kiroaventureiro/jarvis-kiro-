import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { buildCreativePlan, type CreativeRequest } from "../../../../lib/creative-production-engine";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 let body:unknown;
 try{body=await request.json()}catch{return NextResponse.json({error:"JSON inválido"},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Pedido inválido"},{status:400});
 const input=body as Record<string,unknown>;
 if(typeof input.projectId!=="string"||typeof input.idea!=="string"||
 !["short_9_16","video_16_9"].includes(String(input.format))||
 typeof input.sceneCount!=="number")return NextResponse.json({error:"Parâmetros inválidos"},{status:400});
 const result=buildCreativePlan(input as CreativeRequest);
 if(!result)return NextResponse.json({error:"Projeto ou dados inválidos"},{status:400});
 return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
}
