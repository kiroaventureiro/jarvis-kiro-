import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { planJarvisTask, type JarvisTask } from "../../../../lib/jarvis-orchestrator";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 let input:unknown;
 try{input=await request.json()}catch{return NextResponse.json({error:"JSON inválido"},{status:400})}
 if(!input||typeof input!=="object")return NextResponse.json({error:"Pedido inválido"},{status:400});
 const data=input as Record<string,unknown>;
 if(typeof data.id!=="string"||data.id.length>80||typeof data.question!=="string"||data.question.length<1||data.question.length>500||!["answer","consult","propose_action"].includes(String(data.intent))||
 (data.workflow!==undefined&&!["project_report","content_pipeline","broadcast_health"].includes(String(data.workflow))))
 return NextResponse.json({error:"Parâmetros inválidos"},{status:400});
 const plan=planJarvisTask(data as JarvisTask);
 return NextResponse.json(plan,{headers:{"Cache-Control":"no-store"}});
}
