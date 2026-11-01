import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { connectorStore } from "../../../../lib/connectors/server";
import { admitVoiceSession } from "../../../../lib/voice/ledger";
import { getJarvisProfile, getIntegrationStatus } from "../../../../lib/jarvis-profile";
import { jarvisOperationalContext } from "../../../../lib/jarvis-operational-context";
import { lookupJarvisMemory } from "../../../../lib/jarvis-memory";
import { cognitiveProtocol } from "../../../../lib/cognitive/protocol";

export const dynamic = "force-dynamic";

const MODEL = "gemini-3.8-live";

async function buildInstructions() {
  const profile = getJarvisProfile();
  const connections = getIntegrationStatus();
  const operational = await jarvisOperationalContext("Quais sistemas estão configurados?");
  const memory = lookupJarvisMemory("Jarvis Kiro projetos arquitetura integrações", 3)
    .map((item) => `Projeto: ${item.project}. Origem: ${item.source}. Confiança: ${item.confidence}. Resumo: ${item.summary}. Referência: ${item.retrieval_reference}.`);
  return [
    "Você é a interface conversacional por voz do Jarvis Kiro. O Jarvis é a fonte de verdade para memória, contexto, agentes e integrações.",
    `Identidade: ${profile.identity.name}, ${profile.identity.role}. Idioma obrigatório: português brasileiro natural.`,
    `Estilo: ${profile.voice.style}. Voz masculina médio-grave, calma, clara, humana e conversacional. Não imite atores ou dubladores.`,
    cognitiveProtocol("", "voice"),
    "Não invente acesso, consultas, ações, memória persistente ou resultados. Nesta primeira fase experimental você ainda não possui ferramentas externas habilitadas; responda apenas com o contexto recebido e deixe claro quando uma consulta operacional for necessária.",
    "A memória abaixo é indexada e limitada, não é sincronização ao vivo. Trate os relatos como relatos e não revele dados desnecessários.",
    ...profile.principles,
    `Integrações registradas: ${connections.map((item) => item.name).join(", ")}.`,
    operational,
    ...memory,
  ].join("\n");
}

export async function POST() {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (process.env.JARVIS_GEMINI_LIVE_ENABLED !== "true") {
    return NextResponse.json({ error: "Gemini Live experimental está desativado no servidor." }, { status: 403 });
  }

  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Configure GEMINI_API_KEY no ambiente do servidor." }, { status: 503 });
  }

  if (process.env.JARVIS_GEMINI_LIVE_PAID_ALLOWED !== "true") {
    return NextResponse.json({ error: "Uso pago do Gemini Live não autorizado. Ative a autorização e configure um limite no servidor." }, { status: 403 });
  }

  const callsPerHour = Number(process.env.JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR);
  if (!Number.isInteger(callsPerHour) || callsPerHour < 1 || callsPerHour > 120) {
    return NextResponse.json({ error: "Configure JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR entre 1 e 120." }, { status: 503 });
  }

  try {
    const usage = await admitVoiceSession(connectorStore, randomUUID(), callsPerHour);
    const now = Date.now();
    const expires = new Date(now + 30 * 60 * 1000).toISOString();
    const newSessionExpires = new Date(now + 60 * 1000).toISOString();
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        uses: 1,
        expireTime: expires,
        newSessionExpireTime: newSessionExpires,
        liveConnectConstraints: {
          model: `models/${MODEL}`,
          config: {
            responseModalities: ["AUDIO"],
            sessionResumption: {},
            systemInstruction: { parts: [{ text: await buildInstructions() }] },
          },
        },
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || typeof data?.name !== "string") {
      return NextResponse.json({ error: "O Google não conseguiu emitir a credencial temporária do Gemini Live." }, { status: 502 });
    }

    return NextResponse.json({
      token: data.name,
      model: MODEL,
      expiresAt: expires,
      newSessionExpiresAt: newSessionExpires,
      usageSessionId: usage.sessionId,
      usagePersistent: usage.persistent,
    }, { headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } });
  } catch (error) {
    const limited = error instanceof Error && error.message === "VOICE_SESSION_LIMIT";
    return NextResponse.json({
      error: limited ? "Limite persistente de sessões Gemini Live atingido. Aguarde a próxima janela." : "Não foi possível preparar a sessão experimental Gemini Live.",
    }, { status: limited ? 429 : 503 });
  }
}
