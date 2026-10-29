import { NextResponse } from "next/server";
import { authorized } from "../../../../../lib/auth";
import { codexWorkerReadiness } from "../../../../../lib/codex/worker-readiness";
import { getCodexTask } from "../../../../../lib/codex/task-store";
export const dynamic="force-dynamic";
/** Fail-closed dispatch gate until a genuine authenticated worker is configured. */
export async function POST(request:Request) {
 if(!(await authorized()))return NextResponse.json({error:"Sessão necessária"},{status:401});
 const origin=request.headers.get("origin");
 if((origin&&origin!==new URL(request.url).origin)||request.headers.get("sec-fetch-site")==="cross-site")
  return NextResponse.json({error:"Origem inválida"},{status:403});
 if(Number(request.headers.get("content-length")||0)>1024)
  return NextResponse.json({error:"Pedido muito grande"},{status:413});
 let body:unknown;
 try{const text=await request.text();if(text.length>1024)throw Error("INVALID_SIZE");body=JSON.parse(text);}
 catch{return NextResponse.json({error:"JSON inválido"},{status:400});}
 const b=body as Record<string,unknown>|null;
 if(!b||Array.isArray(b)||typeof b.taskId!=="string"||!/^[0-9a-f-]{36}$/i.test(b.taskId))
  return NextResponse.json({error:"Identificador inválido"},{status:400});
 try{
  const task=await getCodexTask(b.taskId);
  if(!task||task.state!=="approved"||task.repository!=="kiroaventureiro/jarvis-kiro-"||task.branch!=="feature/diretor-tecnico-agent")return NextResponse.json({error:"Tarefa não aprovada ou fora do escopo autorizado"},{status:409});
  const readiness=codexWorkerReadiness();
  if(!readiness.canStartTasks||!readiness.workerAuthenticated)
   return NextResponse.json({error:"Executor Codex ainda não conectado",started:false,queued:false,readiness},{status:503,headers:{"Cache-Control":"private, no-store"}});
  // No dispatch implementation: the route deliberately fails closed.
  return NextResponse.json({error:"Canal de execução ainda indisponível",started:false,queued:false},{status:503});
 }catch{return NextResponse.json({error:"Não foi possível verificar a tarefa",started:false,queued:false},{status:503});}
}
