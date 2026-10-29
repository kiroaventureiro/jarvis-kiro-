import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import plan from "../../../../config/apple-integration-plan.json";
import { listSocialReadiness } from "../../../../lib/social-metrics-contracts";
export async function GET() {
 if (!(await authorized())) return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({apple:plan.features,social:listSocialReadiness(),liveAccess:false});
}
