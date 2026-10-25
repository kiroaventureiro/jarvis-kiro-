import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { getTaskHistoryStore } from "../../../../lib/task-history-store";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 const url=new URL(request.url);
 const context=url.searchParams.get("context");
 if(context!=="personal"&&context!=="kiro")return NextResponse.json({error:"Contexto inválido"},{status:400});
 const store=getTaskHistoryStore();
 try{
  const result=await store.list(context,undefined,20);
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({error:"Histórico persistente ainda não configurado",connected:false},{status:503});
 }
}
