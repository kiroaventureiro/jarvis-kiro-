import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
export const dynamic="force-dynamic";
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 const endpoint=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!endpoint||!key)return NextResponse.json({error:"Supabase ainda não configurado"},{status:503});
 let url:URL;
 try{url=new URL(endpoint)}catch{return NextResponse.json({error:"Endereço de banco inválido"},{status:503});}
 if(url.protocol!=="https:"||!/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)||url.username||url.password||url.port||url.pathname!=="/")
  return NextResponse.json({error:"Endpoint Supabase não permitido"},{status:503});
 try {
  const res=await fetch(url.origin+"/rest/v1/",{
   headers:{apikey:key},cache:"no-store",signal:AbortSignal.timeout(10000)
  });
  return NextResponse.json({source:"supabase_live",fetchedAt:new Date().toISOString(),
   reachable:res.ok,upstreamStatus:res.status,
   note:"Somente conectividade com a API REST. Não comprova RLS, tabelas ou autenticação de usuário."},
   {status:res.ok?200:502,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Falha de rede Supabase"},{status:502});}
}
