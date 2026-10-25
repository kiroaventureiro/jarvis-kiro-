import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { authorized } from "../../../../../lib/auth";
import { getPasskeyConfig } from "../../../../../lib/passkey-config";
import { hashChallenge, saveChallenge } from "../../../../../lib/passkey-challenges";

export const dynamic = "force-dynamic";

/** Enrollment is owner-session-only and disabled until deployment explicitly enables it. */
export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({error:"Sessão do proprietário necessária"},{status:401});
  if (process.env.JARVIS_PASSKEY_ENROLLMENT_ENABLED !== "true") {
    return NextResponse.json({error:"Cadastro de dispositivos ainda não habilitado"},{status:503});
  }
  if (request.headers.get("origin") !== process.env.JARVIS_WEBAUTHN_ORIGIN) {
    return NextResponse.json({error:"Origem inválida"},{status:403});
  }
  try {
    const config=getPasskeyConfig();
    const options=await generateRegistrationOptions({
      rpName:config.rpName,rpID:config.rpID,
      userName:"proprietario-jarvis",userDisplayName:"Proprietário Jarvis Kiro",
      attestationType:"none",
      authenticatorSelection:{userVerification:"required",residentKey:"required"},
    });
    await saveChallenge(hashChallenge(options.challenge),"register",new Date(Date.now()+300000).toISOString());
    return NextResponse.json(options,{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Não foi possível iniciar o cadastro"},{status:503});
  }
}
