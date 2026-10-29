import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { planCodexDelegation, type CodexTaskKind } from "../../../../lib/codex/delegation-plan";

export const dynamic = "force-dynamic";
/** Draft-only endpoint. It does not execute or queue a remote Codex worker. */
export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({error:"Sessão necessária"}, {status:401});
  const origin=request.headers.get("origin");
  if ((origin && origin!==new URL(request.url).origin) || request.headers.get("sec-fetch-site")==="cross-site")
    return NextResponse.json({error:"Origem não autorizada"}, {status:403});
  if (Number(request.headers.get("content-length")||0)>4096)
    return NextResponse.json({error:"Pedido muito grande"}, {status:413});
  let data: unknown;
  try {
    const raw=await request.text();
    if (raw.length>4096) return NextResponse.json({error:"Pedido muito grande"}, {status:413});
    data=JSON.parse(raw);
  } catch {return NextResponse.json({error:"JSON inválido"}, {status:400});}
  if (!data || typeof data!=="object" || Array.isArray(data))
    return NextResponse.json({error:"Pedido inválido"}, {status:400});
  const v=data as Record<string,unknown>;
  try {
    if (typeof v.task!=="string" || typeof v.repository!=="string" ||
        typeof v.branch!=="string" || typeof v.kind!=="string")
      return NextResponse.json({error:"Campos inválidos"}, {status:400});
    const plan=planCodexDelegation({
      task:v.task, repository:v.repository, branch:v.branch,
      kind:v.kind as CodexTaskKind,
    });
    return NextResponse.json({plan, queued:false, started:false}, {
      headers:{"Cache-Control":"private, no-store"}
    });
  } catch {
    return NextResponse.json({error:"Escopo Codex inválido ou branch protegida"}, {status:400});
  }
}

/** Honest executor discovery. Local Codex installations are not accessible from Vercel. */
export async function GET() {
  if (!(await authorized())) return NextResponse.json({error:"Sessão necessária"}, {status:401,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({
    provider:"codex",
    planner:"available",
    execution:"not_connected",
    workerAuthenticated:false,
    canStartTasks:false,
    canResumeTasks:false,
    detail:"O JK prepara tarefas, mas ainda não possui executor Codex autenticado. Nenhuma execução remota foi iniciada.",
  },{headers:{"Cache-Control":"private, no-store"}});
}
