import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { N8N_WORKFLOWS, workflowPlan } from "../../../../lib/n8n-workflow-registry";
export const dynamic="force-dynamic";
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({stage:"prepared_not_connected",workflows:Object.keys(N8N_WORKFLOWS).map(workflowPlan),
 executionEnabled:false,note:"Nenhum webhook é chamado ou configurado nesta etapa."},
 {headers:{"Cache-Control":"no-store"}});
}
export async function POST(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({error:"Execução n8n desativada durante a construção da arquitetura"},{status:403});
}
