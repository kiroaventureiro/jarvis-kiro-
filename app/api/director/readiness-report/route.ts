import { operationalSnapshotLive } from "../../../../lib/operational/server";
import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { getJarvisReadinessReport } from "../../../../lib/jarvis-readiness-report";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json(
    getJarvisReadinessReport(await operationalSnapshotLive()),
    { headers: { "Cache-Control": "no-store" } },
  );
}
