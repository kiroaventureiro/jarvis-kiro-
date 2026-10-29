import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorized, cookieName } from "../../../../lib/auth";
import {
  connectors,
  connectorOAuth,
  projects,
} from "../../../../lib/connectors/server";
import {
  provider,
  hash,
  jsonBody,
  originAllowed,
  publicError,
  safeText,
} from "../../../../lib/connectors/security";
import { ConnectorError } from "../../../../lib/connectors/types";
import { oauthApps } from "../../../../lib/connectors/oauth";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
export async function GET() {
  if (!(await authorized()))
    return NextResponse.json(
      { error: "Sessão do proprietário necessária." },
      { status: 401, headers },
    );
  try {
    return NextResponse.json(
      {
        ...(await connectors.overview()),
        kiroProjects: projects.projects.map((p) => ({
          id: p.id,
          name: p.name,
        })),
      },
      { headers },
    );
  } catch (e) {
    const error = publicError(e);
    return NextResponse.json(error, { status: error.status, headers });
  }
}
export async function POST(request: Request) {
  if (!(await authorized()))
    return NextResponse.json(
      { error: "Sessão do proprietário necessária." },
      { status: 401, headers },
    );
  if (!originAllowed(request, oauthApps().origin || undefined))
    return NextResponse.json(
      { error: "Origem não autorizada." },
      { status: 403, headers },
    );
  try {
    const data = await jsonBody(request),
      session = (await cookies()).get(cookieName)!.value,
      sessionId = hash(session);
    const op = data.op;
    if (op === "verify_saved")
      return NextResponse.json(await connectors.verifySavedConnections(), {headers});
    if (op === "plan")
      return NextResponse.json(
        await connectors.plan(data.title, data.actions),
        { headers },
      );
    if (op === "approve")
      return NextResponse.json(
        await connectors.approve(
          safeText(data.id, 80),
          safeText(data.digest, 64),
          safeText(data.confirmation, 90),
          sessionId,
        ),
        { headers },
      );
    if (op === "execute")
      return NextResponse.json(
        await connectors.execute(
          safeText(data.id, 80),
          safeText(data.digest, 64),
          sessionId,
        ),
        { headers },
      );
    if (op === "cancel")
      return NextResponse.json(await connectors.cancel(safeText(data.id, 80)), {
        headers,
      });
    const p = provider(data.provider);
    if (op === "connect") {
      const result = await connectorOAuth.start(
        p,
        Number(session.split(".")[0]),
      );
      const response = NextResponse.json(
        { authorizationUrl: result.authorizationUrl },
        { headers },
      );
      response.cookies.set("jk_dev_oauth", result.binding, {
        httpOnly: true,
        secure: new URL(request.url).protocol === "https:",
        sameSite: "lax",
        path: "/api/director/connectors/oauth",
        maxAge: 600,
      });
      return response;
    }
    if (op === "token") {
      const token = safeText(data.token, 10000),
        teamId =
          typeof data.teamId === "string" && /^[\w-]{1,80}$/.test(data.teamId)
            ? data.teamId
            : undefined;
      return NextResponse.json(
        await connectors.connect(
          p,
          {
            accessToken: token,
            ...(p === "vercel" && teamId ? { teamId } : {}),
          },
          "token",
        ),
        { headers },
      );
    }
    if (op === "test" || op === "discover")
      return NextResponse.json(
        await connectors.test(p, Number(data.page) || 1),
        { headers },
      );
    if (op === "scope")
      return NextResponse.json(
        await connectors.scope(p, data.resources, data.grants),
        { headers },
      );
    if (op === "disconnect" || op === "revoke") {
      if (
        data.confirmation !==
        (op === "revoke" ? "REVOGAR " : "DESCONECTAR ") + p
      )
        throw new ConnectorError("APPROVAL_REQUIRED", 403);
      return NextResponse.json(
        await connectors.disconnect(p, op === "revoke"),
        { headers },
      );
    }
    throw new ConnectorError("OPERATION_BLOCKED");
  } catch (e) {
    const error = publicError(e);
    return NextResponse.json(error, { status: error.status, headers });
  }
}
