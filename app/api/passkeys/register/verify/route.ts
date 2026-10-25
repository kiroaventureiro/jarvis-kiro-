import { NextResponse } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { authorized } from "../../../../../lib/auth";
import { consumeChallenge, hashChallenge } from "../../../../../lib/passkey-challenges";
import { verifyNewDevice } from "../../../../../lib/passkey-verify";
import { storeCredential } from "../../../../../lib/passkey-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Sessão necessária" }, { status: 401 });
  if (process.env.JARVIS_PASSKEY_ENROLLMENT_ENABLED !== "true")
    return NextResponse.json({ error: "Cadastro indisponível" }, { status: 503 });
  if (request.headers.get("origin") !== process.env.JARVIS_WEBAUTHN_ORIGIN)
    return NextResponse.json({ error: "Origem não autorizada" }, { status: 403 });
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object") throw new Error("Invalid response");
    const value = payload as { response?: RegistrationResponseJSON; deviceLabel?: unknown };
    if (!value.response || typeof value.response.response?.clientDataJSON !== "string") throw new Error("Invalid credential");
    if (value.response.response.clientDataJSON.length > 8192) throw new Error("Oversized response");
    const clientData = JSON.parse(Buffer.from(value.response.response.clientDataJSON,"base64url").toString("utf8")) as { challenge?: unknown };
    if (typeof clientData.challenge !== "string" || clientData.challenge.length > 512) throw new Error("Invalid challenge");
    // Consume atomically BEFORE cryptographic verification, to prevent replay.
    if (!(await consumeChallenge(hashChallenge(clientData.challenge), "register"))) throw new Error("Expired or reused challenge");
    const credential=await verifyNewDevice(value.response, clientData.challenge);
    const label = typeof value.deviceLabel === "string" ? value.deviceLabel.trim().slice(0,80) : "Dispositivo";
    await storeCredential(credential,label);
    return NextResponse.json({ ok:true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error:"Cadastro rejeitado ou serviço indisponível" }, { status:400, headers: { "Cache-Control": "no-store" } });
  }
}
