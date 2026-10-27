import {
  AbacusError,
  normalizeUsage,
  type AbacusResult,
  type AbacusChunk,
  type buildAbacusPlan,
} from "./protocol";
import { readSSE } from "./sse";
export const ABACUS_ENDPOINT = "https://routellm.abacus.ai/v1/chat/completions";
type Plan = ReturnType<typeof buildAbacusPlan>;
function retryDelay(raw: string | null) {
  if (!raw) return null;
  const numeric = Number(raw);
  const value = Number.isFinite(numeric)
    ? numeric
    : Math.ceil((Date.parse(raw) - Date.now()) / 1000);
  return Number.isFinite(value) ? Math.max(1, Math.min(300, value)) : null;
}
function statusError(response: Response) {
  if (response.status === 429)
    return new AbacusError(
      "ABACUS_RATE_LIMIT",
      429,
      retryDelay(response.headers.get("Retry-After")),
    );
  if ([401, 403].includes(response.status))
    return new AbacusError("ABACUS_AUTH", 503);
  return new AbacusError("ABACUS_UNAVAILABLE", 502);
}
function parseReply(value: unknown): AbacusResult {
  const v = value as {
    model?: unknown;
    usage?: unknown;
    choices?: Array<{
      message?: { content?: unknown };
      finish_reason?: unknown;
    }>;
  };
  const choice = v?.choices?.[0],
    text = choice?.message?.content;
  if (
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 12000 ||
    ["tool_calls", "content_filter"].includes(String(choice?.finish_reason))
  )
    throw new AbacusError("ABACUS_INVALID_RESPONSE", 502);
  return {
    text,
    model: typeof v.model === "string" ? v.model.slice(0, 100) : "route-llm",
    usage: normalizeUsage(v.usage),
    truncated: choice?.finish_reason === "length",
  };
}
export async function* runAbacus(
  plan: Plan,
  options: {
    key: string;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
    stream?: boolean;
    timeoutMs?: number;
  },
): AsyncGenerator<AbacusChunk> {
  const timeout = new AbortController(),
    timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? 20000),
    signal = options.signal
      ? AbortSignal.any([options.signal, timeout.signal])
      : timeout.signal;
  try {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const response = await (options.fetcher || fetch)(ABACUS_ENDPOINT, {
      method: "POST",
      signal,
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + options.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: plan.model,
        max_tokens: plan.max_tokens,
        messages: plan.messages,
        stream: !!options.stream,
      }),
    });
    if (!response.ok) throw statusError(response);
    if (
      !options.stream ||
      !response.headers.get("Content-Type")?.includes("text/event-stream")
    ) {
      const raw = await response.text();
      if (raw.length > 100000)
        throw new AbacusError("ABACUS_INVALID_RESPONSE", 502);
      yield { type: "done", reply: parseReply(JSON.parse(raw)) };
      return;
    }
    if (!response.body) throw new AbacusError("ABACUS_INVALID_RESPONSE", 502);
    let text = "",
      model = "route-llm",
      usage: AbacusResult["usage"] = null,
      finish = "",
      done = false;
    for await (const raw of readSSE(response.body, signal)) {
      if (raw.trim() === "[DONE]") {
        done = true;
        break;
      }
      const v = JSON.parse(raw);
      if (v.error) throw new AbacusError("ABACUS_UNAVAILABLE", 502);
      if (typeof v.model === "string") model = v.model.slice(0, 100);
      if (v.usage) usage = normalizeUsage(v.usage);
      const choice = v.choices?.[0];
      if (typeof choice?.finish_reason === "string")
        finish = choice.finish_reason;
      const delta = choice?.delta?.content;
      if (typeof delta === "string" && delta) {
        text += delta;
        if (text.length > 12000)
          throw new AbacusError("ABACUS_INVALID_RESPONSE", 502);
        yield { type: "delta", text: delta };
      }
    }
    if (!done || !text.trim() || !["stop", "length"].includes(finish))
      throw new AbacusError("ABACUS_INVALID_RESPONSE", 502);
    yield {
      type: "done",
      reply: { text, model, usage, truncated: finish === "length" },
    };
  } catch (error) {
    if (options.signal?.aborted) throw new AbacusError("ABACUS_CANCELLED", 499);
    if (timeout.signal.aborted) throw new AbacusError("ABACUS_TIMEOUT", 504);
    if (error instanceof AbacusError) throw error;
    if (error instanceof TypeError)
      throw new AbacusError("ABACUS_UNAVAILABLE", 502);
    throw new AbacusError("ABACUS_INVALID_RESPONSE", 502);
  } finally {
    clearTimeout(timer);
  }
}
