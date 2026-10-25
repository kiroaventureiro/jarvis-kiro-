import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getPasskeyConfig } from "../../../../../lib/passkey-config";
import { saveChallenge, hashChallenge } from "../../../../../lib/passkey-challenges";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (process.env.JARVIS_PASSKEY_LOGIN_ENABLED !== "true") return NextResponse.json({ error: "Login por dispositivo indisponível" }, { status: 503 });
  if (req.headers.get("origin") !== process.env.JARVIS_WEBAUTHN_ORIGIN) return NextResponse.json({ error: "Origem não autorizada" }, { status: 403 });
  try {
    const { rpID } = getPasskeyConfig();
    const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
    await saveChallenge(hashChallenge(options.challenge), "authenticate", new Date(Date.now()+300000).toISOString());
    return NextResponse.json(options, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Falha ao iniciar login" }, { status: 503 }); }
}
