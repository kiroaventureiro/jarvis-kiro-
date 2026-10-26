import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { buildCreativeProductionPlan, type CreativeRequest } from "../../../../lib/creative-production-plan";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 let data:unknown;
 try{data=await request.json()}catch{return NextResponse.json({error:"JSON inválido"},{status:400})}
 if(!data||typeof data!=="object"||Array.isArray(data))return NextResponse.json({error:"Dados inválidos"},{status:400});
 const x=data as Record<string,unknown>;
 if(typeof x.project!=="string"||!/^[a-z0-9-]{2,60}$/.test(x.project)||
 typeof x.title!=="string"||x.title.trim().length<3||x.title.length>120||
 typeof x.brief!=="string"||x.brief.trim().length<3||x.brief.length>1500||
 !["short_9_16","landscape_16_9"].includes(String(x.format))||
 !["grok","openart","invideo","capcut","suno"].includes(String(x.provider)))
 return NextResponse.json({error:"Parâmetros inválidos"},{status:400});
 const plan=buildCreativeProductionPlan(x as CreativeRequest);
 return NextResponse.json(plan,{status:plan.valid?200:404,headers:{"Cache-Control":"no-store"}});
}
