import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { TASK_STATES,TASK_RETENTION } from "../../../../lib/task-memory-policy";
export const dynamic="force-dynamic";
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({stage:"policy_only",states:TASK_STATES,retention:TASK_RETENTION,
 persistedTaskCount:null,historyConnected:false,
 note:"Regras de memória prontas; sem banco, histórico persistente ou sincronização ativa."},
 {headers:{"Cache-Control":"no-store"}});
}
