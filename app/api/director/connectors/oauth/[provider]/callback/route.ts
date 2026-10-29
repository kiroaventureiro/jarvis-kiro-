import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  connectors,
  connectorOAuth,
} from "../../../../../../../lib/connectors/server";
import { provider } from "../../../../../../../lib/connectors/security";
import { oauthApps } from "../../../../../../../lib/connectors/oauth";
import { callbackHostAllowed } from "../../../../../../../lib/request-origin";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const apps = oauthApps();
  let success = false;
  try {
    const p = provider((await context.params).provider),
      url = new URL(request.url),
      binding = (await cookies()).get("jk_dev_oauth")?.value;
    if (!callbackHostAllowed(request, apps.origin) || url.searchParams.has("error"))
      throw Error();
    const result = await connectorOAuth.finish(
      p,
      url.searchParams.get("state") || "",
      binding || "",
      url.searchParams.get("code") || "",
    );
    const configId = url.searchParams.get("configurationId");
    if (p === "vercel" && configId && /^icfg_[\w-]+$/.test(configId))
      result.credentials.configurationId = configId;
    await connectors.connect(p, result.credentials, "oauth", result.scopes);
    success = true;
  } catch {
    /* Do not echo authorization codes, tokens, provider errors or callback parameters. */
  }
  const target = new URL(
    "/conexoes",
    apps.origin || new URL(request.url).origin,
  );
  target.searchParams.set("connectorAuth", success ? "received" : "failed");
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set("jk_dev_oauth", "", {
    httpOnly: true,
    secure: target.protocol === "https:",
    sameSite: "lax",
    path: "/api/director/connectors/oauth",
    maxAge: 0,
  });
  return response;
}
