import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
 if (!(await authorized())) return NextResponse.json({error:"Não autorizado"},{status:401});
 const token=process.env.VERCEL_API_TOKEN;
 if(!token)return NextResponse.json({error:"Vercel ainda não configurada"},{status:503});
 const id="jarvis-kiro";
 try {
  const res=await fetch("https://api.vercel.com/v9/projects/"+id,{
   headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(10000)
  });
  if(!res.ok)return NextResponse.json({error:"Consulta Vercel indisponível",upstreamStatus:res.status},{status:502});
  const info=await res.json() as {name?:string;id?:string;framework?:string;updatedAt?:number;link?:{repo?:string;org?:string}};
  return NextResponse.json({source:"vercel_live",fetchedAt:new Date().toISOString(),
   project:{name:info.name,id:info.id,framework:info.framework,updatedAt:info.updatedAt,repository:info.link?.repo},
   note:"Metadados de projeto apenas. Não atesta deploy saudável nem autoriza alteração."},
   {headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Falha de comunicação com Vercel"},{status:502});}
}
