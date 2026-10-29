import { cookies } from "next/headers";
import { authorized, cookieName } from "../../../../lib/auth";
import { connectorStore } from "../../../../lib/connectors/server";
import { WorkspaceConnectors } from "../../../../lib/connectors/workspace";
import { jsonBody, originAllowed } from "../../../../lib/connectors/security";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
const service=()=>new WorkspaceConnectors(connectorStore,process.env);
export async function GET(){
 if(!await authorized())return Response.json({error:"Entre como proprietário."},{status:401,headers});
 try{return Response.json(await service().overview(),{headers});}catch{return Response.json({error:"Não foi possível ler o cofre de conexões."},{status:503,headers});}
}
export async function POST(request:Request){
 if(!await authorized())return Response.json({error:"Entre como proprietário."},{status:401,headers});
 if(!originAllowed(request,process.env.JARVIS_CONNECTOR_ORIGIN))return Response.json({error:"Origem inválida."},{status:403,headers});
 try{
  const body=await jsonBody(request),s=service();
  if(body.op==="authorize"){
   const session=(await cookies()).get(cookieName)?.value||"";
   const result=await s.start(String(body.provider),body.services,Number(session.split(".")[0]));
   const jar=await cookies();jar.set("jk_workspace_oauth",result.binding,{httpOnly:true,secure:new URL(request.url).protocol==="https:",sameSite:"lax",path:"/api/director/workspace-connectors",maxAge:600});
   return Response.json({authorizationUrl:result.authorizationUrl},{headers});
  }
  if(body.op==="read")return Response.json(await s.read(String(body.service)),{headers});
  if(body.op==="disconnect"&&body.confirmation==="DESCONECTAR")return Response.json(await s.disconnect(String(body.provider)),{headers});
  return Response.json({error:"Ação inválida."},{status:400,headers});
 }catch(e){
  const code=e instanceof Error?e.message:"";
  const message=code==="WORKSPACE_APP_NOT_CONFIGURED"?"Aplicativo OAuth ainda não configurado no servidor. Nenhuma autorização foi iniciada.":code==="WORKSPACE_REAUTHORIZE"?"A autorização expirou ou foi recusada. Autorize novamente no provedor.":code==="WORKSPACE_SCOPE_REQUIRED"?"Autorize este serviço antes de consultar.":"Não foi possível concluir. Confira a configuração, as permissões e se a API do serviço foi habilitada no provedor.";
  return Response.json({error:message},{status:503,headers});
 }
}
