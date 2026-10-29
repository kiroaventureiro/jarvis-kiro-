import { composeScene } from "../holo/orchestrator";
import { boundHistory, type ChatTurn, type AbacusResult } from "./protocol";
import { readSSE } from "./sse";
function complete(
  raw: AbacusResult,
  message: string,
  onGeneratedMedia?: (
    items: Array<{ id: string; label: string; file: File }>,
  ) => void,
): AbacusResult {
  if (
    raw.generatedImageId &&
    /^[-\w]{1,90}$/.test(raw.generatedImageId) &&
    typeof raw.inlineAsset === "string" &&
    raw.inlineAsset.length < 11000000
  ) {
    const m =
      /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        raw.inlineAsset,
      );
    if (m && onGeneratedMedia) {
      const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      onGeneratedMedia([
        {
          id: raw.generatedImageId,
          label: "Imagem criada por IA",
          file: new File([bytes], "jarvis-imagem", { type: m[1] }),
        },
      ]);
    }
  }
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
    onGeneratedMedia?: (
      items: Array<{ id: string; label: string; file: File }>,
    ) => void;
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
    return complete(data, message, options.onGeneratedMedia);
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
  return complete(reply, message, options.onGeneratedMedia);
}
