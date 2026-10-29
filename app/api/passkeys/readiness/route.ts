import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { getPasskeyConfig } from "../../../../lib/passkey-config";

export const dynamic = "force-dynamic";

/** Authenticated status only. Do not expose env values, keys or private endpoints. */
export async function GET() {
  if (!(await authorized())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  let rpValid = false;
  try { getPasskeyConfig(); rpValid = true; } catch { /* incomplete or unsafe RP settings */ }
  const checks = {
    databaseUrl: Boolean(process.env.SUPABASE_URL?.startsWith("https://")),
    serverCredential: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    webauthnDomain: rpValid,
    enrollmentEnabled: process.env.JARVIS_PASSKEY_ENROLLMENT_ENABLED === "true",
    loginEnabled: process.env.JARVIS_PASSKEY_LOGIN_ENABLED === "true",
    sessionConfigured: Boolean(process.env.JARVIS_SESSION_SECRET) && Boolean(process.env.JARVIS_ACCESS_PASSWORD),
  };
  const configurationReady = checks.databaseUrl && checks.serverCredential && checks.webauthnDomain && checks.sessionConfigured;
  return NextResponse.json({ configurationReady, checks, note: "Configuração apenas: nenhum teste de login, banco ou dispositivos foi executado por esta rota." }, { headers: { "Cache-Control": "no-store" } });
}
