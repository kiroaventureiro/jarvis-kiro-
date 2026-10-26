import "server-only";
const ENDPOINT = "https://routellm.abacus.ai/v1/chat/completions";
export type AbacusReply = { text: string; model: string; usage: unknown };
export async function askAbacus(
  message: string,
  signal?: AbortSignal,
): Promise<AbacusReply> {
  const key = process.env.ABACUS_API_KEY;
  if (!key) throw new Error("ABACUS_NOT_CONFIGURED");
  if (message.trim().length < 1 || message.length > 1500)
    throw new Error("INVALID_INPUT");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "route-llm",
        stream: false,
        max_tokens: 350,
        messages: [
          {
            role: "system",
            content:
              "Você é um mecanismo auxiliar do Jarvis Kiro. Responda em português brasileiro, sem afirmar que executou ações externas. Não solicite credenciais.",
          },
          { role: "user", content: message },
        ],
      }),
    });
    if (!response.ok) throw new Error(`ABACUS_HTTP_${response.status}`);
    const data: unknown = await response.json();
    if (!data || typeof data !== "object")
      throw new Error("ABACUS_INVALID_RESPONSE");
    const result = data as {
      model?: unknown;
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: unknown;
    };
    const text = result.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("ABACUS_INVALID_RESPONSE");
    return {
      text,
      model: typeof result.model === "string" ? result.model : "route-llm",
      usage: result.usage ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
