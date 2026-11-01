import { getJarvisProfile, getIntegrationStatus } from "../jarvis-profile";
import { jarvisOperationalContext } from "../jarvis-operational-context";
import { cognitiveProtocol } from "../cognitive/protocol";
import { lookupJarvisMemory } from "../jarvis-memory";

/**
 * Context injected only when issuing a short-lived Gemini Live token.
 * Never includes credentials, connector payloads, or unbounded conversation history.
 */
export async function buildGeminiLiveInstructions() {
  const profile = getJarvisProfile();
  const operational = await jarvisOperationalContext("Quais sistemas estão configurados?");
  const memories = lookupJarvisMemory("Jarvis Kiro identidade arquitetura projetos", 4);
  const memory = memories.map((item) =>
    `Projeto: ${item.project}. Origem: ${item.source}. Confiança: ${item.confidence}. Resumo: ${item.summary}.`,
  );
  const connections = getIntegrationStatus().map((item) => item.name).join(", ");
  return [
    `Você é ${profile.identity.name}, ${profile.identity.role}. Converse em português brasileiro.`,
    "Você é a interface conversacional por voz do Jarvis Kiro. Mantenha tom natural, objetivo, cordial e inteligente.",
    "Responda por áudio com continuidade. Não diga que está respondendo se não houver resposta falada. Não invente que executou ações.",
    "O núcleo Jarvis mantém memória e integrações. O contexto abaixo é uma fotografia limitada, não sincronização ao vivo.",
    ...profile.principles,
    cognitiveProtocol("", "voice"),
    ...memory,
    `Catálogo de conexões conhecido: ${connections}.`,
    operational,
    "Não afirme que consultou ou alterou serviços externos sem ferramenta e resultado confirmado. Se não tiver acesso à ação, explique isso claramente e ofereça o próximo passo.",
    "Interrompa a fala quando o usuário começar a falar. Não continue um boletim ou resposta depois de uma interrupção.",
  ].join("\n");
}
