"use client";
import { useState } from "react";
type Status = {
  configured: boolean;
  paidCallsAllowed: boolean;
  callsPerHour: number;
  tokenLimitPerHour: number;
  telemetry?: {
    completed: number;
    failed: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    unknownUsage: number;
    unverifiedReservedTokens: number;
    models: Record<string, number>;
  };
};
export default function AbacusStatus() {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  async function inspect() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/director/abacus", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sessão necessária");
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível consultar");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="glass notice" aria-label="Integração Abacus RouteLLM">
      <h2>Abacus RouteLLM</h2>
      <p>
        Conversa, contexto limitado da sessão e projetos KIRO, com respostas
        progressivas. A consulta abaixo lê apenas o estado deste servidor e não
        executa modelos.
      </p>
      <button type="button" onClick={inspect} disabled={loading}>
        {loading ? "Consultando…" : "Consultar estado da Abacus"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {status ? (
        <div role="status">
          <p>
            Configuração no servidor:{" "}
            {status.configured
              ? "presente; não validada por chamada real"
              : "ausente"}
            . Uso pago:{" "}
            {status.paidCallsAllowed ? "autorizado no servidor" : "bloqueado"}.
          </p>
          <p>
            Limites locais: {status.callsPerHour} chamadas/hora e{" "}
            {status.tokenLimitPerHour} tokens/hora, com reserva conservadora.
            Contadores temporários por instância, sem garantia de teto
            financeiro global.
          </p>
          {status.telemetry ? (
            <>
              <p>
                Concluídas: {status.telemetry.completed}; falhas:{" "}
                {status.telemetry.failed}. Tokens informados:{" "}
                {status.telemetry.totalTokens} (entrada{" "}
                {status.telemetry.promptTokens}, saída{" "}
                {status.telemetry.completionTokens}, cache informado{" "}
                {status.telemetry.cachedTokens}).
              </p>
              <p>
                Chamadas sem informação de tokens:{" "}
                {status.telemetry.unknownUsage}; reservas debitadas no limite
                local: {status.telemetry.unverifiedReservedTokens}. Modelos
                observados:{" "}
                {Object.keys(status.telemetry.models).join(", ") || "nenhum"}.
              </p>
            </>
          ) : null}
          <p>
            Saldo Abacus e custo monetário: não consultados. Créditos não são
            tokens. Os benefícios ilimitados da interface ChatLLM não significam
            API gratuita.
          </p>
        </div>
      ) : null}
      <p>
        Imagem e áudio: documentados pela Abacus, preparados para integração
        futura e sujeitos a autorização. Vídeo, pesquisa web e ferramentas
        externas não estão habilitados no Jarvis. O catálogo de serviços não
        concede acesso à conta.
      </p>
    </section>
  );
}
