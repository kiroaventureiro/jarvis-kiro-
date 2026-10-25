import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { getEcosystemOverview } from "../../../../lib/ecosystem-overview";
export const dynamic="force-dynamic";
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json(getEcosystemOverview(),{headers:{"Cache-Control":"no-store"}});
}
