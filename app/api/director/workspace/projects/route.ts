import { requestOriginAllowed } from "../../../../../lib/request-origin";
import { NextResponse } from "next/server";
import { authorized } from "../../../../../lib/auth";
import { connectorStore } from "../../../../../lib/connectors/server";
import { listPersistentProjects, savePersistentProject } from "../../../../../lib/workspace/projects";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control": "private, no-store"};
export async function GET() {
  if (!(await authorized())) return NextResponse.json({error:"Não autorizado"}, {status:401,headers});
  if (!connectorStore.configured()) return NextResponse.json({error:"Cofre indisponível"}, {status:503,headers});
  try { return NextResponse.json({projects:await listPersistentProjects()}, {headers}); }
  catch { return NextResponse.json({error:"Não foi possível ler projetos"}, {status:503,headers}); }
}
export async function PUT(request: Request) {
  if (!(await authorized())) return NextResponse.json({error:"Não autorizado"}, {status:401,headers});
  if (!requestOriginAllowed(request, process.env.JARVIS_CONNECTOR_ORIGIN, false))
    return NextResponse.json({error:"Origem não autorizada"}, {status:403,headers});
  if (!connectorStore.configured()) return NextResponse.json({error:"Cofre indisponível"}, {status:503,headers});
  try {
    const body = await request.text();
    if (body.length > 12000) return NextResponse.json({error:"Registro grande demais"}, {status:413,headers});
    return NextResponse.json({project:await savePersistentProject(JSON.parse(body))}, {headers});
  } catch { return NextResponse.json({error:"Registro inválido ou indisponível"}, {status:400,headers}); }
}
