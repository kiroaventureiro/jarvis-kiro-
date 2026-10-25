import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { validateTaskEnvelope, createTaskReceipt } from "../../../../lib/jarvis-task-envelope";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 let payload:unknown;
 try{payload=await request.json()}catch{return NextResponse.json({error:"JSON inválido"},{status:400});}
 if(!validateTaskEnvelope(payload))return NextResponse.json({error:"Formato de tarefa inválido"},{status:400});
 const receipt=createTaskReceipt(payload);
 return NextResponse.json({receipt,persisted:false,auditStored:false,simulationOnly:true,
 note:"Prévia de tarefa; não foi executada nem registrada em banco."},{headers:{"Cache-Control":"no-store"}});
}
