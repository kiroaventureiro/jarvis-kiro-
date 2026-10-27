import { jarvisOperationalContext } from "../../../lib/jarvis-operational-context";
import { OPERATIONAL_VOICE_TOOL } from "../../../lib/operational/realtime-tool";
import { NextResponse } from "next/server";
import { authorized } from "../../../lib/auth";
import {
  getJarvisProfile,
  getIntegrationStatus,
} from "../../../lib/jarvis-profile";
import { lookupJarvisMemory } from "../../../lib/jarvis-memory";
import {
  costPermission,
  providerCallBudget,
} from "../../../lib/voice/cost-policy";

export const dynamic = "force-dynamic";

async function buildVoiceInstructions() {
  const profile = getJarvisProfile();
  const connections = getIntegrationStatus();
  const operational = await jarvisOperationalContext(
    "Quais sistemas estão configurados?",
  );
  const curated = lookupJarvisMemory(
    "Jarvis Kiro Sistema Origem Supabase arquitetura",
    3,
  );
  const memoryContext = curated.map(
    (item) =>
      `Projeto: ${item.project}. Origem: ${item.source}. Confiança: ${item.confidence}. Registrado: ${item.recorded_at}. Resumo: ${item.summary}. Referência: ${item.retrieval_reference}.`,
  );
  return [
    "Memória indexada e limitada; não é sincronização ao vivo. Trate relatos como relatos e cite a origem ao responder.",
    ...memoryContext,
    `Você é ${profile.identity.name}, ${profile.identity.role}. Converse em ${profile.identity.language}.`,
    `Estilo de voz: ${profile.voice.style}. Respostas: ${profile.voice.responseLength}.`,
    ...profile.principles,
    "Você pode conversar, explicar e propor ações. Esta sessão NÃO recebeu ferramentas externas de execução; só a consulta interna jarvis_operational_status, de leitura de metadados, é permitida. Antes de responder sobre conexões, capacidades ou memória, consulte essa função. Ela não restaura conversas nem autoriza gastos.",
    operational,
    "Não afirme que conectou, consultou, alterou ou salvou algo em serviços externos sem uma ferramenta real e resultado confirmado.",
    "Não prometa memória persistente ou acesso a arquivos e conversas não fornecidos nesta sessão.",
    `Catálogo descritivo de serviços: ${connections.map((item) => item.name).join(", ")}. O registro operacional prevalece sobre o catálogo e sobre respostas antigas.`,
    `Ações que exigem aprovação específica: ${profile.authority.approvalRequired.join("; ")}.`,
    `Se houver bloqueio: ${profile.interaction.ifBlocked}`,
    `Se houver incerteza: ${profile.interaction.ifUncertain}`,
  ].join("\n");
}
export async function POST() {
  if (!(await authorized()))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const key = process.env.OPENAI_API_KEY;
  if (!key)
    return NextResponse.json(
      { error: "Configure a chave da API no servidor." },
      { status: 503 },
    );
  const permission = costPermission("openai-voice", process.env);
  if (!permission.allowed)
    return NextResponse.json(
      {
        error:
          "Sessão neural paga bloqueada. É necessária autorização e limite de chamadas no servidor.",
      },
      { status: 403 },
    );
  const admitted = providerCallBudget.admit("openai-voice", permission);
  if (!admitted.allowed)
    return NextResponse.json({ error: admitted.reason }, { status: 429 });
  try {
    const res = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: "gpt-realtime",
            audio: { output: { voice: "marin" } },
            instructions: await buildVoiceInstructions(),
            tools: [OPERATIONAL_VOICE_TOOL],
          },
        }),
        cache: "no-store",
      },
    );
    const data = await res.json();
    if (!res.ok)
      return NextResponse.json(
        { error: data.error?.message || "Falha ao iniciar sessão de voz." },
        { status: 502 },
      );
    return NextResponse.json(
      { value: data.value },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Falha de rede." }, { status: 502 });
  }
}
