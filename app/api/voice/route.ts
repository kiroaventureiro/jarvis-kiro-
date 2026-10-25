import { NextResponse } from "next/server";
import { authorized } from "../../../lib/auth";
import { getJarvisProfile, getIntegrationStatus } from "../../../lib/jarvis-profile";

export const dynamic = "force-dynamic";

function buildVoiceInstructions() {
  const profile = getJarvisProfile();
  const connections = getIntegrationStatus();
  const unavailable = connections.filter((item) => !item.connected).map((item) => item.name);
  return [
    `Você é ${profile.identity.name}, ${profile.identity.role}. Converse em ${profile.identity.language}.`,
    `Estilo de voz: ${profile.voice.style}. Respostas: ${profile.voice.responseLength}.`,
    ...profile.principles,
    "Você pode conversar, explicar e propor ações. Esta sessão de voz NÃO recebeu ferramentas externas.",
    "Não afirme que conectou, consultou, alterou ou salvou algo em serviços externos sem uma ferramenta real e resultado confirmado.",
    "Não prometa memória persistente ou acesso a arquivos e conversas não fornecidos nesta sessão.",
    `Catálogo de serviços ainda NÃO conectados nesta sessão: ${unavailable.join(", ")}.`,
    `Ações que exigem aprovação específica: ${profile.authority.approvalRequired.join("; ")}.`,
    `Se houver bloqueio: ${profile.interaction.ifBlocked}`,
    `Se houver incerteza: ${profile.interaction.ifUncertain}`,
  ].join("\n");
}
export async function POST() {
  if (!(await authorized())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Configure a chave da API no servidor." }, { status: 503 });
  try {
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: "gpt-realtime",
          audio: { output: { voice: "marin" } },
          instructions: buildVoiceInstructions(),
        },
      }),
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message || "Falha ao iniciar sessão de voz." }, { status: 502 });
    return NextResponse.json({ value: data.value }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Falha de rede." }, { status: 502 });
  }
}
