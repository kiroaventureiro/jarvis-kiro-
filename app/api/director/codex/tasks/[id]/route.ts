import { NextResponse } from "next/server";
import { authorized } from "../../../../../../lib/auth";
import { jarvisResultView } from "../../../../../../lib/orchestration/result-view";
import { getCodexTask } from "../../../../../../lib/codex/task-store";

export const dynamic = "force-dynamic";
/** Read-only status; no worker execution or approval is implied. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await authorized()))
    return NextResponse.json({error:"Sessão necessária"},{status:401,headers:{"Cache-Control":"no-store"}});
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({error:"Identificador inválido"},{status:400,headers:{"Cache-Control":"no-store"}});
  try {
    const task=await getCodexTask(id);
    if (!task)
      return NextResponse.json({error:"Tarefa não encontrada"},{status:404,headers:{"Cache-Control":"no-store"}});
    const result = {
      requestId:task.id,
      source:"codex" as const,
      status:task.state === "approved" ? "needs_authorization" as const : task.state === "cancelled" ? "failed" as const : task.state,
      messages:[task.state === "draft"
        ? "Tarefa registrada como rascunho. Nenhum executor foi acionado."
        : "Estado registrado: " + task.state + ". A execução remota ainda não está conectada."],
      artifacts:[],
      provenance:{provider:"codex-task-store",taskReference:task.id},
    };
    return NextResponse.json({task,view:jarvisResultView(result),executorConnected:false},{headers:{"Cache-Control":"private, no-store"}});
  } catch {
    return NextResponse.json({error:"Armazenamento indisponível"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
