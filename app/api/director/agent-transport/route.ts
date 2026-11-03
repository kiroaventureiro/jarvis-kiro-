import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { AGENT_TRANSPORT } from "../../../../lib/agent-transport-contract";
import { connectorStore } from "../../../../lib/connectors/server";
import { acceptAgentEvent, sourceSecret, verifyAgentEnvelope } from "../../../../lib/agent-transport-auth";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};

export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401,headers});
 const vault=connectorStore.configured();
 return NextResponse.json({
  status:vault && (sourceSecret("n8n")||sourceSecret("windows_agent")) ? "inbox_configured" : "not_configured",
  sources:{n8n:!!sourceSecret("n8n"),windows_agent:!!sourceSecret("windows_agent")},
  encryptedReplayStore:vault,remoteTaskDispatch:false,
  contract:AGENT_TRANSPORT,
  note:"Recebimento autenticado de eventos, não execução de comandos ou confirmação de tarefas Codex.",
 },{headers});
}

/** Inbound worker event, never a remote instruction/executor or trusted task completion. */
export async function POST(request:Request){
 if(!connectorStore.configured())
  return NextResponse.json({error:"Cofre de eventos indisponível"},{status:503,headers});
 const source=request.headers.get("x-jarvis-agent-source");
 if(source!=="n8n" && source!=="windows_agent")
  return NextResponse.json({error:"Fonte não autorizada"},{status:401,headers});
 if(!sourceSecret(source))
  return NextResponse.json({error:"Fonte não configurada"},{status:503,headers});
 if(Number(request.headers.get("content-length")||0)>4096)
  return NextResponse.json({error:"Mensagem muito grande"},{status:413,headers});
 let raw="";
 try {raw=await request.text()}catch{return NextResponse.json({error:"Mensagem inválida"},{status:400,headers})}
 const message=verifyAgentEnvelope(raw,request.headers.get("x-jarvis-agent-timestamp"),
   request.headers.get("x-jarvis-agent-signature"),source);
 if(!message)return NextResponse.json({error:"Autenticação ou mensagem inválida"},{status:401,headers});
 try {
  const result=await acceptAgentEvent(message);
  return NextResponse.json(result,{status:result.accepted?202:409,headers});
 } catch {
  return NextResponse.json({error:"Persistência indisponível"},{status:503,headers});
 }
}
