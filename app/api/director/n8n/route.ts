import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { requestOriginAllowed } from "../../../../lib/request-origin";
import { connectN8n, disconnectN8n, n8nStatus, testN8n, listN8nWorkflows, n8nWorkflowDetails } from "../../../../lib/n8n/connection";
import { startCatalogRun, catalogRunStatus } from "../../../../lib/n8n/catalog-run";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
function error(e:unknown){const code=e instanceof Error?e.message:"N8N_UNAVAILABLE";return NextResponse.json({error:code},{status:code==="VAULT_NOT_CONFIGURED"?503:400,headers});}
export async function GET(){
  if(!(await authorized()))return NextResponse.json({error:"AUTH_REQUIRED"},{status:401,headers});
  try{return NextResponse.json(await n8nStatus(),{headers});}catch(e){return error(e);}
}
export async function POST(request:Request){
  if(!(await authorized()))return NextResponse.json({error:"AUTH_REQUIRED"},{status:401,headers});
  if(!requestOriginAllowed(request))return NextResponse.json({error:"ORIGIN_DENIED"},{status:403,headers});
  try{
    const body=await request.json();
    if(!body||typeof body!=="object"||Array.isArray(body))throw Error("INVALID_REQUEST");
    const data=body as Record<string,unknown>;
    if(data.action==="connect"&&typeof data.url==="string"&&typeof data.apiKey==="string"){
      return NextResponse.json(await connectN8n(data.url,data.apiKey,request.signal),{headers});
    }
    if(data.action==="list")return NextResponse.json(await listN8nWorkflows(request.signal),{headers});
    if(data.action==="details" && typeof data.id==="string")return NextResponse.json(await n8nWorkflowDetails(data.id,request.signal),{headers});
    if(data.action==="catalog-report" && Object.keys(data).length===1)return NextResponse.json(await startCatalogRun(),{headers});
    if(data.action==="catalog-report-status" && Object.keys(data).length===2 && typeof data.id==="string")return NextResponse.json(await catalogRunStatus(data.id),{headers});
    if(data.action==="test")return NextResponse.json(await testN8n(request.signal),{headers});
    if(data.action==="disconnect"&&data.confirmation==="DESCONECTAR N8N")return NextResponse.json(await disconnectN8n(),{headers});
    throw Error("OPERATION_DENIED");
  }catch(e){return error(e);}
}
