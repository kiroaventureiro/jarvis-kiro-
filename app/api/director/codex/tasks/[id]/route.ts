import { NextResponse } from "next/server";
import { authorized } from "../../../../../../lib/auth";
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
    return NextResponse.json({task,executorConnected:false},{headers:{"Cache-Control":"private, no-store"}});
  } catch {
    return NextResponse.json({error:"Armazenamento indisponível"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
