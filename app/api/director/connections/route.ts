import { operationalSnapshotLive } from "../../../../lib/operational/server";
import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import catalog from "../../../../config/connection-catalog.json";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const operational = await operationalSnapshotLive();
  return NextResponse.json(
    { ...catalog, operational: operational },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
