import type { RealtimeEvent } from "../jarvis-realtime";
export const OPERATIONAL_VOICE_TOOL = {
  type: "function",
  name: "jarvis_operational_status",
  description:
    "Consulta somente metadados confiáveis e recentes das integrações e projetos do Jarvis. Use antes de responder sobre capacidades, conexões, Abacus ou memória Supabase. Não lê conteúdo de conversas nem executa modelos, gravações ou ações.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
} as const;
export const VISUAL_RESEARCH_VOICE_TOOL = {
  type: "function",
  name: "jarvis_visual_research",
  description:
    "Consulta dados econômicos brasileiros em fontes públicas BCB/IBGE e prepara demonstrações e mapa-múndi. Use antes de responder sobre IPCA, inflação, Selic, dólar ou economia brasileira atual e para pedidos de mapas/geografia. Não é pesquisa geral na web. Não executa ações, modelos ou serviços pagos. Dados retornam com período e limitações.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", maxLength: 1500 } },
    required: ["query"],
    additionalProperties: false,
  },
} as const;
export function createOperationalVoiceTool(options: {
  signal: AbortSignal;
  send: (event: object) => void;
  isCurrent: () => boolean;
  onSnapshot?: (value: unknown) => void;
  onVisual?: (value: unknown) => void;
  fetcher?: typeof fetch;
}) {
  let lastResponse = "",
    used = 0,
    turnEpoch = 0;
  const seen = new Set<string>();
  return {
    resetTurn() {
      used = 0;
      turnEpoch++;
    },
    async handle(event: RealtimeEvent) {
      if (
        event.type !== "response.done" ||
        event.response?.status !== "completed"
      )
        return false;
      const calls =
        event.response.output?.filter((x) => x.type === "function_call") || [];
      if (!calls.length) return false;
      if (event.response_id && lastResponse === event.response_id) return true;
      lastResponse = event.response_id || "";
      for (const call of calls) {
        if (
          !["jarvis_operational_status", "jarvis_visual_research"].includes(
            call.name || "",
          )
        )
          throw new Error("Ferramenta não autorizada.");
        if (!call.call_id || seen.has(call.call_id)) continue;
        const turn = turnEpoch;
        seen.add(call.call_id);
        if (seen.size > 100 || used++ >= 1)
          throw new Error(
            "Limite de consultas operacionais desta interação. Faça uma nova pergunta.",
          );
        let args: unknown;
        try {
          args = JSON.parse(call.arguments || "{}");
        } catch {
          throw new Error("Consulta operacional inválida.");
        }
        if (
          !args ||
          typeof args !== "object" ||
          Array.isArray(args) ||
          (call.name === "jarvis_visual_research"
            ? Object.keys(args).length !== 1 ||
              typeof (args as { query?: unknown }).query !== "string" ||
              !(args as { query: string }).query.trim() ||
              (args as { query: string }).query.length > 1500
            : Object.keys(args).length)
        )
          throw new Error("Consulta operacional inválida.");
        let result: unknown;
        try {
          const response = await (options.fetcher || fetch)(
            call.name === "jarvis_visual_research"
              ? "/api/director/research"
              : "/api/director/operational-status?verify=1",
            {
              ...(call.name === "jarvis_visual_research"
                ? {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(args),
                  }
                : {}),
              credentials: "same-origin",
              cache: "no-store",
              signal: options.signal,
            },
          );
          if (!response.ok) throw new Error();
          const data = await response.json();
          if (
            call.name === "jarvis_visual_research"
              ? typeof data.available !== "boolean"
              : data.schemaVersion !== 1 || !Array.isArray(data.integrations)
          )
            throw new Error();
          result = data;
        } catch {
          if (options.signal.aborted) return true;
          result = {
            verified: false,
            error:
              "Não foi possível consultar a fonte solicitada. Informe a falha sem inventar dados nem concluir que todos os serviços estão desconectados.",
          };
        }
        if (
          !options.isCurrent() ||
          options.signal.aborted ||
          turn !== turnEpoch
        )
          return true;
        if (call.name === "jarvis_visual_research") options.onVisual?.(result);
        else options.onSnapshot?.(result);
        options.send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify(result),
          },
        });
        options.send({ type: "response.create", response: { tools: [] } });
      }
      return true;
    },
  };
}
