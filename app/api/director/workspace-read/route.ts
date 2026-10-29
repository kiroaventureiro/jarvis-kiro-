import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { readWorkspace } from "../../../../lib/workspace-read-adapters";
export const dynamic="force-dynamic";

/** Read-only bridge. Temporary server access tokens are a placeholder for a future per-user OAuth vault. */
export async function GET(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 const params=new URL(request.url).searchParams;
 const provider=params.get("provider"), resource=params.get("resource");
 if(provider!=="google"&&provider!=="microsoft")return NextResponse.json({error:"Provedor inválido"},{status:400});
 if(resource!=="files"&&resource!=="mail"&&resource!=="calendar")return NextResponse.json({error:"Recurso inválido"},{status:400});
 const token=provider==="google"?process.env.GOOGLE_ACCESS_TOKEN:process.env.MICROSOFT_ACCESS_TOKEN;
 if(!token)return NextResponse.json({error:"Autorização OAuth ainda não configurada",provider},{status:503});
 const result=await readWorkspace(provider,resource,token);
 if(!result.ok)return NextResponse.json(result,{status:result.code==="PERMISSION_DENIED"?403:503});
 return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
}
