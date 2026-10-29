import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorized, cookieName } from "../../../../../lib/auth";
import { developerPlanner } from "../../../../../lib/connectors/server";
import {
  originAllowed,
  jsonBody,
  hash,
  safeText,
  publicError,
} from "../../../../../lib/connectors/security";
import { oauthApps } from "../../../../../lib/connectors/oauth";
import { costPermission } from "../../../../../lib/voice/cost-policy";
import { ConnectorError } from "../../../../../lib/connectors/types";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!(await authorized()))
    return NextResponse.json(
      { error: "Sessão necessária." },
      { status: 401, headers },
    );
  if (!originAllowed(request, oauthApps().origin || undefined))
    return NextResponse.json(
      { error: "Origem não autorizada." },
      { status: 403, headers },
    );
  try {
    const data = await jsonBody(request, 12000),
      planner = await developerPlanner(),
      project = safeText(data.project, 100);
    if (data.mode === "diagnose")
      return NextResponse.json(await planner.investigate(project), { headers });
    if (
      data.mode !== "propose" ||
      data.authorizeModel !== true ||
      !costPermission("abacus", process.env).allowed
    )
      throw new ConnectorError("MODEL_APPROVAL_REQUIRED", 403);
    const result = await planner.repair(
      project,
      data.request,
      data.paths,
      hash((await cookies()).get(cookieName)!.value),
    );
    return NextResponse.json(result, { headers });
  } catch (e) {
    const error = publicError(e);
    return NextResponse.json(error, { status: error.status, headers });
  }
}
