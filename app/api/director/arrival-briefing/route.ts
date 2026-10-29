import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { arrivalBriefing } from "../../../../lib/connectors/arrival-briefing";
import { connectorStore } from "../../../../lib/connectors/server";

export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (!(await authorized()))
    return NextResponse.json({ error: "Sessão necessária" }, { status: 401, headers });
  const result = await arrivalBriefing(connectorStore);
  return NextResponse.json({ text: result.text }, { headers });
}
