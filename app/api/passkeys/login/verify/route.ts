import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { consumeChallenge, hashChallenge } from "../../../../../lib/passkey-challenges";
import { getCredential, advanceCounter } from "../../../../../lib/passkey-store";
import { verifyKnownDevice } from "../../../../../lib/passkey-verify";
import { cookieName, session } from "../../../../../lib/auth";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (process.env.JARVIS_PASSKEY_LOGIN_ENABLED !== "true") return NextResponse.json({error:"Login indisponível"},{status:503});
  if (req.headers.get("origin") !== process.env.JARVIS_WEBAUTHN_ORIGIN) return NextResponse.json({error:"Origem não autorizada"},{status:403});
  try {
    const text=await req.text();
    if(text.length>16000) throw new Error("Payload grande");
    const response=JSON.parse(text) as AuthenticationResponseJSON;
    if(typeof response?.id !== "string" || typeof response?.response?.clientDataJSON !== "string") throw new Error("Resposta inválida");
    const stored=await getCredential(response.id);
    if(!stored) throw new Error("Dispositivo desconhecido");
    const clientData=JSON.parse(Buffer.from(response.response.clientDataJSON,"base64url").toString("utf8")) as {challenge?:unknown};
    if(typeof clientData.challenge !== "string" || clientData.challenge.length>512) throw new Error("Desafio inválido");
    if(!await consumeChallenge(hashChallenge(clientData.challenge),"authenticate")) throw new Error("Desafio inválido ou reutilizado");
    const counter=await verifyKnownDevice(response,clientData.challenge,stored);
    await advanceCounter(stored.id,stored.counter,counter);
    const out=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
    out.cookies.set(cookieName,session(),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:86400});
    return out;
  } catch { return NextResponse.json({error:"Autenticação não autorizada"},{status:401,headers:{"Cache-Control":"no-store"}}); }
}
