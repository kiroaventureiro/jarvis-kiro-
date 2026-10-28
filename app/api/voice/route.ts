import { cognitiveProtocol } from "../../../lib/cognitive/protocol";
import { jarvisOperationalContext } from "../../../lib/jarvis-operational-context";
import {
  OPERATIONAL_VOICE_TOOL,
  VISUAL_RESEARCH_VOICE_TOOL,
} from "../../../lib/operational/realtime-tool";
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
    `Estilo de voz: ${profile.voice.style}. A profundidade acompanha o pedido, sem limite artificial de três frases.`,
    cognitiveProtocol("", "voice"),
    ...profile.principles,
    "Você pode conversar, explicar e propor ações. Esta sessão NÃO recebeu ferramentas externas de execução; as consultas internas jarvis_operational_status (metadados) e jarvis_visual_research (referências públicas, fontes BCB/IBGE, imagens, mapas e leituras de projetos autorizados) são permitidas. Quando precisar investigar um assunto ou verificar dados fora desta conversa, consulte jarvis_visual_research. Relate os períodos publicados e as limitações retornadas; não apresente esses indicadores como diagnóstico econômico completo ou cotação em tempo real. Antes de responder sobre conexões, capacidades ou memória, consulte essa função. Ela não restaura conversas nem autoriza gastos.",
    operational,
    "Ao responder sobre a Abacus, consulte jarvis_operational_status e use o campo abacus: catálogo, quantidade de modelos e ferramentas publicadas. Os dados privados da conta só são encaminhados quando o proprietário faz uma pergunta explícita sobre sua conta Abacus e o controle de compartilhamento está ativo. Se privateAccountForwarded for false, não deduza nem invente esses dados. A falta desse compartilhamento não significa ausência de integração. O estado genérico da conexão não substitui esses dados. Diferencie saldo observado e saldo em tempo real. Não negue dados presentes na ferramenta. Fale cada informação uma única vez, com linguagem natural. Não leia títulos dos quadros, datas de expiração internas ou o texto das demonstrações. A tela é complementar à narração, não sua transcrição.",
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
            tools: [OPERATIONAL_VOICE_TOOL, VISUAL_RESEARCH_VOICE_TOOL],
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
