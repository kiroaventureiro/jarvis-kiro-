import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import inventory from "../../../../config/kiro-ecosystem-inventory.json";
export const dynamic = "force-dynamic";
export async function GET() {
 if (!(await authorized())) return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({stage:inventory.stage,services:inventory.services,liveAccess:false},
  {headers:{"Cache-Control":"no-store"}});
}
