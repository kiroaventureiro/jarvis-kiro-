import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { sameOrigin } from "../../../../lib/abacus/http";
import { costPermission, providerCallBudget } from "../../../../lib/voice/cost-policy";
import { buildGeminiLiveInstructions } from "../../../../lib/voice/gemini-live-instructions";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };
const MODEL = process.env.JARVIS_GEMINI_LIVE_MODEL || "gemini-3.8-live";

export async function POST(request: Request) {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers });
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
  if (process.env.JARVIS_GEMINI_LIVE_ENABLED !== "true")
    return NextResponse.json({ error: "Gemini Live está desativado neste ambiente." }, { status: 403, headers });

  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key)
    return NextResponse.json(
      { error: "Configure GEMINI_API_KEY no servidor da Vercel." },
      { status: 503, headers },
    );

  const permission = costPermission("gemini-live", process.env);
  if (!permission.allowed)
    return NextResponse.json(
      { error: "Gemini Live está bloqueado até configurar autorização e limite de sessões no servidor." },
      { status: 403, headers },
    );
  const admitted = providerCallBudget.admit("gemini-live", permission);
  if (!admitted.allowed)
    return NextResponse.json({ error: admitted.reason }, { status: 429, headers });

  try {
    const now = Date.now();
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: `models/${MODEL}`,
          config: {
            responseModalities: ["AUDIO"],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: {},
            systemInstruction: {
              parts: [{ text: await buildGeminiLiveInstructions() }],
            },
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data: unknown = await response.json();
    if (!response.ok || !data || typeof data !== "object" || !("name" in data) || typeof data.name !== "string") {
      return NextResponse.json(
        { error: "O Google não emitiu um token Gemini Live. Verifique a chave, o acesso ao modelo e a disponibilidade da API." },
        { status: response.status === 429 ? 429 : 502, headers },
      );
    }
    return NextResponse.json(
      { token: data.name, model: MODEL, expiresInSeconds: 1800 },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível provisionar a sessão Gemini Live." },
      { status: 503, headers },
    );
  }
}
