import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorized, cookieName } from "../../../../lib/auth";
import {
  connectors,
  connectorOAuth,
  projects,
  connectorStore,
} from "../../../../lib/connectors/server";
import {
  provider,
  hash,
  jsonBody,
  originAllowed,
  requestOriginStatus,
  publicError,
  safeText,
} from "../../../../lib/connectors/security";
import { ConnectorError } from "../../../../lib/connectors/types";
import { oauthApps } from "../../../../lib/connectors/oauth";
import { abacusHub } from "../../../../lib/abacus/hub-server";
import { inspectVoiceStudio } from "../../../../lib/voice/voicestudio";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
export async function GET(request: Request) {
  if (!(await authorized()))
    return NextResponse.json(
      { error: "Sessão do proprietário necessária." },
      { status: 401, headers },
    );
  if (request && new URL(request.url).searchParams.get("diagnostics") === "1") {
    const settings = ["JARVIS_CONNECTOR_STORE_URL", "JARVIS_CONNECTOR_STORE_KEY", "JARVIS_CONNECTOR_ENCRYPTION_KEY"];
    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      authenticated: true,
      origin: requestOriginStatus(request, oauthApps().origin || undefined),
      vaultConfigured: connectorStore.configured(),
      missingVaultSettings: settings.filter(key => !process.env[key]?.trim()),
      writePolicyPresent: !!process.env.JARVIS_CONNECTOR_WRITE_RESOURCES?.trim(),
      oauthConfigured: Object.fromEntries((["github", "supabase", "vercel"] as const).map(p => [p, connectorOAuth.configured(p)])),
      noProviderCalls: true,
      note: "GET de diagnóstico não verifica o Origin de um POST. Compare com os detalhes do envio recusado. Nenhum segredo, cookie ou corpo é incluído.",
    }, {headers});
  }
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
      { error: "Origem não autorizada.", code: "ORIGIN_NOT_ALLOWED", diagnostics: requestOriginStatus(request, oauthApps().origin || undefined) },
      { status: 403, headers },
    );
  try {
    const data = await jsonBody(request),
      session = (await cookies()).get(cookieName)!.value,
      sessionId = hash(session);
    const op = data.op;
    if (op === "verify_saved") {
      // Each integration is independent: an unavailable vault must not prevent
      // a read-only Abacus/VoiceStudio probe with its existing server config.
      const [native,abacus,studio]=await Promise.allSettled([
        connectors.verifySavedConnections(),
        abacusHub(true,request.signal),
        inspectVoiceStudio(process.env,request.signal),
      ]);
      const hub=abacus.status==="fulfilled"?abacus.value:null;
      return NextResponse.json({
        results:native.status==="fulfilled"?native.value.results:
          (["github","supabase","vercel"] as const).map(provider=>({provider,state:"failed"})),
        abacus:{state:hub?.state||"unavailable",models:hub?.discovery?.models.length||0,
          tools:hub?.discovery?.tools.length||0,toolsState:hub?.discovery?.toolsState||"not_verified",
          checkedAt:hub?.discovery?.checkedAt||null,generationTested:false},
        voiceStudio:{state:studio.status==="fulfilled"?studio.value.state:"unavailable",speechVerified:false},
      }, {headers});
    }
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
        secure: new URL(oauthApps().origin || request.url).protocol === "https:",
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
