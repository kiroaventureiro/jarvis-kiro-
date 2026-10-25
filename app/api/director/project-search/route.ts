import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { lookupJarvisMemory } from "../../../../lib/jarvis-memory";

export const dynamic="force-dynamic";
const OWNER="kiroaventureiro";
const REPO_PATTERN=/^[a-zA-Z0-9._-]{1,100}$/;

/** Owner-only retrieval: no arbitrary URLs, branches, code execution, or repository writes. */
export async function GET(request:Request){
  if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
  const u=new URL(request.url);
  const repo=u.searchParams.get("repo")??"";
  const q=(u.searchParams.get("q")??"").trim();
  if(!REPO_PATTERN.test(repo)||q.length<3||q.length>100)
    return NextResponse.json({error:"Informe repo válido e consulta de 3 a 100 caracteres"},{status:400});
  const token=process.env.GITHUB_READ_TOKEN;
  if(!token)return NextResponse.json({error:"Integração GitHub não configurada"},{status:503});
  try{
    const result=await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q+" repo:"+OWNER+"/"+repo)}&per_page=10`,{
      headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":"2022-11-28"},
      cache:"no-store",signal:AbortSignal.timeout(10000),
    });
    if(!result.ok)return NextResponse.json({error:"Busca GitHub indisponível",status:result.status},{status:502});
    const body=await result.json() as {items?:Array<{title?:string;html_url?:string;state?:string;updated_at?:string;number?:number}>};
    const issues=(body.items??[]).slice(0,10).map(x=>({number:x.number,title:x.title,url:x.html_url,state:x.state,updatedAt:x.updated_at}));
    return NextResponse.json({
      source:"github_live",repo:OWNER+"/"+repo,fetchedAt:new Date().toISOString(),issues,
      curatedMemory:lookupJarvisMemory(q,3),
      note:"Resultados GitHub são consultas atuais; memória local é histórico documentado, não sincronização ao vivo.",
    },{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({error:"Não foi possível consultar GitHub"},{status:502});
  }
}
