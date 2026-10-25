import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { WINDOWS_CAPABILITIES,inspectWindowsCommand } from "../../../../lib/windows-agent-contract";
export const dynamic="force-dynamic";
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({phase:"architecture_only",connected:false,
 capabilities:Object.keys(WINDOWS_CAPABILITIES).map(inspectWindowsCommand)},
 {headers:{"Cache-Control":"no-store"}});
}
export async function POST(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({error:"Comandos locais desabilitados"},{status:403});
}
