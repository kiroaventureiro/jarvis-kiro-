import { composeScene } from "../holo/orchestrator";
import { boundHistory, type ChatTurn, type AbacusResult } from "./protocol";
import { readSSE } from "./sse";
function complete(raw: AbacusResult, message: string): AbacusResult {
  const reply = { ...raw, visual: composeScene(message, raw) || undefined };
  return reply.truncated
    ? {
        ...reply,
        text:
          reply.text +
          "\n\nEsta resposta atingiu o limite de saída. Peça para continuar se necessário.",
      }
    : reply;
}
export async function requestAbacus(
  message: string,
  options: {
    history?: ChatTurn[];
    signal: AbortSignal;
    onDelta?: (text: string) => void;
  },
): Promise<AbacusResult> {
  const response = await fetch("/api/director/abacus", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      message,
      history: boundHistory(options.history, message),
      stream: true,
    }),
    signal: options.signal,
  });
  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {}
    throw new Error(
      typeof data?.error === "string"
        ? data.error.slice(0, 240)
        : "Abacus indisponível. Tente mais tarde.",
    );
  }
  if (!response.headers.get("Content-Type")?.includes("text/event-stream")) {
    const data = await response.json();
    if (
      typeof data.text !== "string" ||
      !data.text.trim() ||
      data.text.length > 12000
    )
      throw new Error("Resposta inválida da Abacus");
    options.onDelta?.(data.text);
    return complete(data, message);
  }
  if (!response.body) throw new Error("Resposta vazia da Abacus");
  let aggregate = "",
    reply: AbacusResult | null = null;
  for await (const raw of readSSE(response.body, options.signal)) {
    const event = JSON.parse(raw);
    if (event.type === "error")
      throw new Error(
        typeof event.message === "string"
          ? event.message.slice(0, 240)
          : "Resposta interrompida.",
      );
    if (event.type === "delta" && typeof event.text === "string") {
      aggregate += event.text;
      if (aggregate.length > 12000)
        throw new Error("Resposta maior que o limite");
      options.onDelta?.(aggregate);
    }
    if (event.type === "done") {
      if (
        typeof event.text !== "string" ||
        !event.text.trim() ||
        event.text.length > 12000 ||
        (aggregate && event.text !== aggregate)
      )
        throw new Error("Resposta incompleta da Abacus");
      reply = event;
      break;
    }
  }
  if (options.signal.aborted) throw new DOMException("Cancelled", "AbortError");
  if (!reply)
    throw new Error("A resposta foi interrompida antes da conclusão.");
  return complete(reply, message);
}
