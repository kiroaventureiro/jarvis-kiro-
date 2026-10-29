import "server-only";
import { connectorStore } from "../connectors/server";
import { voiceUsageIntent, voiceUsageStats } from "./ledger";
export async function answerVoiceUsageQuestion(message: string) {
  if (!voiceUsageIntent(message)) return null;
  try {
    const stats = voiceUsageStats(
      connectorStore.configured()
        ? (await connectorStore.read()).voiceUsage
        : undefined,
    );
    return {
      text: stats.persistent
        ? "Nesta janela, registrei " +
          stats.sessions +
          " aberturas de sessão e " +
          stats.responses +
          " respostas relatadas pelo navegador, com " +
          stats.inputTokens +
          " tokens de entrada e " +
          stats.outputTokens +
          " de saída. Esses tokens são relatos do cliente, não a fatura do provedor."
        : "Ainda não há registro persistente de consumo de voz nesta janela. Não vou estimar um gasto sem medição.",
      model: "jk-voice-usage",
      provider: "local_operational" as const,
      usage: null,
      stats,
    };
  } catch {
    return {
      text: "O registro persistente de consumo de voz está indisponível agora; não posso informar um total confirmado.",
      model: "jk-voice-usage",
      provider: "local_operational" as const,
      usage: null,
    };
  }
}
