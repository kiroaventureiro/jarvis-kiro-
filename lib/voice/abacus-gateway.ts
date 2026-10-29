import { requestOriginAllowed } from "../request-origin";
import {
  boundHistory,
  publicAbacusError,
  type AbacusInput,
  type AbacusChunk,
  type TaskKind,
} from "../abacus/protocol";
import type { CostPermission } from "./cost-policy";
type Dependencies = {
  prepare?: (
    message: string,
    signal: AbortSignal,
    input: AbacusInput,
  ) => Promise<AbacusInput>;
  configured: () => boolean;
  localReply?: (
    message: string,
    signal: AbortSignal,
    input: AbacusInput,
  ) => Promise<{ text: string; model: string; usage: unknown } | null>;
  permission: () => CostPermission;
  admit: (permission: CostPermission) => { allowed: boolean; reason: string };
  reply: (
    text: string,
    signal: AbortSignal,
    input?: AbacusInput,
  ) => Promise<{ text: string; model: string; usage: unknown }>;
  stream?: (
    text: string,
    signal: AbortSignal,
    input: AbacusInput,
  ) => AsyncGenerator<AbacusChunk>;
};
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function processAbacusRequest(
  request: Request,
  deps: Dependencies,
) {
  const error = (message: string, status: number) =>
    Response.json({ error: message }, { status, headers });
  if (!requestOriginAllowed(request, process.env.JARVIS_CONNECTOR_ORIGIN, false))
return error("Origem não autorizada", 403);
  let data: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw Error();
    const decoder = new TextDecoder();
    let raw = "",
      size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 24576) {
          await reader.cancel();
          throw Error();
        }
        raw += decoder.decode(part.value, { stream: true });
      }
      raw += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    data = JSON.parse(raw);
  } catch {
    return error("JSON inválido ou maior que o limite", 400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    return error("Pedido inválido", 400);
  const { message, history, task, stream } = data as {
    message?: unknown;
    history?: unknown;
    task?: unknown;
    stream?: unknown;
  };
  if (
    (task !== undefined &&
      !["chat", "code", "research"].includes(String(task))) ||
    (stream !== undefined && typeof stream !== "boolean") ||
    [
      "model",
      "tools",
      "abacus_tools",
      "apiKey",
      "api_key",
      "key",
      "modalities",
      "audio",
    ].some((key) => key in data)
  )
    return error("Opção não autorizada neste endpoint de texto", 400);
  if (
    typeof message !== "string" ||
    message.trim().length < 1 ||
    message.length > 1500
  )
    return error("Mensagem inválida", 400);
  let input: AbacusInput;
  try {
    input = {
      history: boundHistory(history, message),
      task: task as TaskKind | undefined,
    };
  } catch {
    return error(
      "Histórico inválido; somente mensagens de usuário e assistente são aceitas",
      400,
    );
  }
  if (deps.localReply) {
    const local = await deps.localReply(message, request.signal, input);
    if (local) return Response.json(local, { headers });
  }
  if (!deps.configured())
    return error("Chave Abacus não configurada no servidor", 503);
  const permission = deps.permission();
  if (!permission.allowed)
    return error(
      "Uso pago da Abacus bloqueado. É necessária autorização e orçamento de chamadas no servidor.",
      403,
    );
  const admitted = deps.admit(permission);
  if (!admitted.allowed) return error(admitted.reason, 429);
  const failure = (caught: unknown) => {
    const safe = publicAbacusError(caught);
    return Response.json(
      {
        error: safe.message,
        code: safe.code,
        retryAfterSeconds: safe.retryAfterSeconds,
      },
      {
        status: safe.status,
        headers: {
          ...headers,
          ...(safe.retryAfterSeconds
            ? { "Retry-After": String(safe.retryAfterSeconds) }
            : {}),
        },
      },
    );
  };
  try {
    if (deps.prepare)
      input = await deps.prepare(message, request.signal, input);
    if (stream === true && deps.stream) {
      const cancelled = new AbortController();
      const signal = AbortSignal.any([request.signal, cancelled.signal]);
      const iterator = deps.stream(message, signal, input);
      let next = await iterator.next(),
        terminal = false;
      const encoder = new TextEncoder();
      const frame = (value: unknown) =>
        encoder.encode("data: " + JSON.stringify(value) + "\n\n");
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            if (next.done) {
              if (!terminal)
                controller.enqueue(
                  frame({ type: "error", ...publicAbacusError(new Error()) }),
                );
              controller.close();
              return;
            }
            const value = next.value;
            controller.enqueue(
              frame(
                value.type === "done"
                  ? { type: "done", ...value.reply }
                  : value,
              ),
            );
            if (value.type === "done") {
              terminal = true;
              await iterator.return(undefined);
              controller.close();
              return;
            }
            next = await iterator.next();
          } catch (caught) {
            if (!cancelled.signal.aborted) {
              controller.enqueue(
                frame({ type: "error", ...publicAbacusError(caught) }),
              );
              controller.close();
            }
          }
        },
        async cancel() {
          cancelled.abort();
          await iterator.return(undefined);
        },
      });
      return new Response(body, {
        headers: {
          ...headers,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "private, no-store, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }
    const reply = await deps.reply(message, request.signal, input);
    return Response.json(reply, { headers });
  } catch (caught) {
    return failure(caught);
  }
}
