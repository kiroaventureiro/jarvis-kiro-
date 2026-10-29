import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { listProjectMemory } from "../../../../lib/kiro-project-memory";
export const dynamic="force-dynamic";
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({source:"curated_seed",liveSync:false,projects:listProjectMemory()},
 {headers:{"Cache-Control":"no-store"}});
}
