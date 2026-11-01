import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import personality from "../../../../config/jarvis-personality.json";

export const dynamic = "force-dynamic";

const MODEL = "gemini-3.8-live";

export async function POST() {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY não está configurada neste ambiente da Vercel." },
      { status: 503 },
    );
  }

  const instructions = [
    `Você é ${personality.identity.name}, ${personality.identity.role}.`,
    `Fale sempre em ${personality.identity.language}.`,
    `Estilo: ${personality.voice.style}. Seja natural e objetivo; aprofunde quando solicitado.`,
    ...personality.principles,
    "Não afirme que consultou, alterou, conectou ou executou algo sem ferramenta e resultado confirmado.",
    "Não invente integrações, memória, estado de serviços ou resultados.",
    "Interrompa sua fala quando detectar que o usuário começou a falar e priorize a fala dele.",
  ].join("\\n");

  try {
    const now = Date.now();
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
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
              sessionResumption: {},
            },
          },
        }),
        cache: "no-store",
      },
    );
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Gemini não emitiu o token de sessão." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (typeof data.name !== "string" || !data.name) {
      return NextResponse.json(
        { error: "Resposta de autenticação Gemini sem token utilizável." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { token: data.name, model: MODEL, instructions },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível solicitar uma sessão temporária ao Gemini." },
      { status: 503 },
    );
  }
}
