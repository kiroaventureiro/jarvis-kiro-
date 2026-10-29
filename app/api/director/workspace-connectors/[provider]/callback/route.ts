import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectorStore } from "../../../../../../lib/connectors/server";
import { WorkspaceConnectors } from "../../../../../../lib/connectors/workspace";
import { callbackHostAllowed } from "../../../../../../lib/request-origin";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{provider:string}>}){
 const url=new URL(request.url);const origin=process.env.JARVIS_CONNECTOR_ORIGIN;
 let success=false;
 try{
  if(!callbackHostAllowed(request,origin)||url.searchParams.has("error"))throw Error();
  const binding=(await cookies()).get("jk_workspace_oauth")?.value||"";
  await new WorkspaceConnectors(connectorStore,process.env).finish((await context.params).provider,url.searchParams.get("state")||"",binding,url.searchParams.get("code")||"");
  success=true;
 }catch{/* Never echo codes, token responses or provider error parameters. */}
 const target=new URL("/conexoes",origin||url.origin);target.searchParams.set("workspaceAuth",success?"received":"failed");target.hash="workspace-connectors";
 const response=NextResponse.redirect(target);response.headers.set("Cache-Control","no-store");response.headers.set("Referrer-Policy","no-referrer");
 response.cookies.set("jk_workspace_oauth","",{httpOnly:true,secure:target.protocol==="https:",sameSite:"lax",path:"/api/director/workspace-connectors",maxAge:0});
 return response;
}
