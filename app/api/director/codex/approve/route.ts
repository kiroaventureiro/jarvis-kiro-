import { NextResponse } from "next/server";
import { authorized } from "../../../../../lib/auth";
import { getCodexTask, updateCodexTask } from "../../../../../lib/codex/task-store";
import { codexWorkerReadiness } from "../../../../../lib/codex/worker-readiness";

export const dynamic="force-dynamic";
/** Records a scoped user approval; never dispatches or executes the Codex task. */
export async function POST(request:Request) {
 if(!(await authorized()))return NextResponse.json({error:"Sessão necessária"},{status:401});
 const origin=request.headers.get("origin");
 if((origin&&origin!==new URL(request.url).origin)||request.headers.get("sec-fetch-site")==="cross-site")
  return NextResponse.json({error:"Origem inválida"},{status:403});
 if(Number(request.headers.get("content-length")||0)>1024)return NextResponse.json({error:"Pedido grande demais"},{status:413});
 let body:unknown;
 try{const raw=await request.text();if(raw.length>1024)throw Error("TOO_LARGE");body=JSON.parse(raw);}
 catch{return NextResponse.json({error:"JSON inválido"},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Pedido inválido"},{status:400});
 const v=body as Record<string,unknown>;
 if(typeof v.taskId!=="string"||!/^[0-9a-f-]{36}$/i.test(v.taskId)||v.approved!==true||
    v.confirmation!=="autorizo esta tarefa")
  return NextResponse.json({error:"É necessária autorização explícita para esta tarefa"},{status:400});
 try{
  const task=await getCodexTask(v.taskId);
  if(!task||task.state!=="draft"||task.repository!=="kiroaventureiro/jarvis-kiro-"||
     task.branch!=="feature/diretor-tecnico-agent")
   return NextResponse.json({error:"Tarefa não encontrada ou indisponível para aprovação"},{status:409});
  const saved=await updateCodexTask(task.id,"approved",{approvalVerified:true});
  return NextResponse.json({task:saved,started:false,queued:false,executor:codexWorkerReadiness().execution,
    message:"Aprovação registrada. Nenhuma execução foi iniciada."},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Não foi possível registrar a aprovação"},{status:409});}
}
