"use client";
import { useState } from "react";
import type { OperationalSnapshot } from "../../lib/operational/state";
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
  const [operational, setOperational] = useState<OperationalSnapshot | null>(
    null,
  );
  async function verify() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        "/api/director/operational-status?verify=1",
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok)
        throw new Error("Entre como proprietário para verificar o estado.");
      setOperational(await response.json());
    } catch {
      setError(
        "Não foi possível consultar o estado operacional. Nenhuma conexão foi presumida.",
      );
    } finally {
      setLoading(false);
    }
  }
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
      <button type="button" onClick={verify} disabled={loading}>
        Verificar estado operacional
      </button>
      {operational ? (
        <div role="status">
          <h3>Estado do ambiente {operational.environment}</h3>
          <p>
            Consulta de leitura, sem gerar resposta de modelo ou gravar
            conversas. O catálogo mantém {operational.catalog.total}{" "}
            plataformas.
          </p>
          {operational.integrations
            .filter(
              (item) =>
                item.configured ||
                ["abacus", "supabase-memory"].includes(item.id),
            )
            .map((item) => (
              <p key={item.id}>
                <strong>
                  {item.name}: {item.label}.
                </strong>{" "}
                {item.checkedAt
                  ? "Última verificação em " +
                    new Date(item.checkedAt).toLocaleString("pt-BR") +
                    ". "
                  : "Sem verificação recente. "}
                {item.id === "supabase-memory"
                  ? item.checks.includes("encrypted_read")
                    ? "Leitura e descriptografia verificadas; gravação é uma ação manual."
                    : "Não há confirmação atual de leitura criptografada."
                  : item.checks.includes("conversation")
                    ? "Conversa concluída com sucesso."
                    : item.checks.includes("api_catalog")
                      ? "Catálogo autenticado respondeu; geração não testada nesta consulta."
                      : ""}{" "}
                {item.note}
              </p>
            ))}
        </div>
      ) : null}
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
        Imagem, áudio e análise visual estão disponíveis no laboratório abaixo,
        sujeitos ao modelo da conta e ao orçamento autorizado. Pesquisa web tem
        autorização própria. Vídeo e execução de agentes da interface Abacus
        ainda não estão integrados ao JK. Consultar o catálogo não concede
        permissões.
      </p>
    </section>
  );
}
