import "server-only";

export type NaviTurn = { role: "user" | "assistant"; content: string };
export type NaviResult = { text: string; model: string; responseId?: string };

export class NaviError extends Error {
  constructor(public readonly code: "DISABLED" | "NOT_CONFIGURED" | "BILLING_NOT_AUTHORIZED" | "UNAVAILABLE" | "INVALID_RESPONSE") {
    super(code);
  }
}

export function naviConfig(env: Record<string, string | undefined>) {
  if (env.JARVIS_NAVI_ENABLED !== "true") throw new NaviError("DISABLED");
  if (!env.OPENAI_API_KEY?.trim()) throw new NaviError("NOT_CONFIGURED");
  // Independent API billing is not covered by ChatGPT/Codex subscriptions.
  if (env.JARVIS_OPENAI_API_BILLING_AUTHORIZED !== "true") throw new NaviError("BILLING_NOT_AUTHORIZED");
  const model = env.JARVIS_NAVI_MODEL || "gpt-5-mini";
  if (!/^[a-zA-Z0-9._-]{2,80}$/.test(model)) throw new NaviError("NOT_CONFIGURED");
  return { key: env.OPENAI_API_KEY, model };
}

export function safeNaviHistory(input: unknown): NaviTurn[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 12) throw new NaviError("INVALID_RESPONSE");
  return input.map((t: unknown) => {
    if (!t || typeof t !== "object") throw new NaviError("INVALID_RESPONSE");
    const v = t as Record<string, unknown>;
    if ((v.role !== "user" && v.role !== "assistant") || typeof v.content !== "string" ||
        !v.content.trim() || v.content.length > 2500) throw new NaviError("INVALID_RESPONSE");
    return { role: v.role, content: v.content };
  });
}

export async function askNavi(
  message: string,
  history: NaviTurn[],
  deps: {
    env: Record<string, string | undefined>;
    fetcher?: typeof fetch;
    signal?: AbortSignal;
  },
): Promise<NaviResult> {
  const { key, model } = naviConfig(deps.env);
  if (typeof message !== "string" || !message.trim() || message.length > 3000) throw new NaviError("INVALID_RESPONSE");
  const input = [...safeNaviHistory(history), {role: "user" as const, content: message.trim()}];
  const timeout = AbortSignal.timeout(25000);
  const signal = deps.signal ? AbortSignal.any([timeout, deps.signal]) : timeout;
  let response: Response;
  try {
    response = await (deps.fetcher || fetch)("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: "Você é Navi, assistente de colaboração do Jarvis JK. Responda naturalmente em português brasileiro. Não afirme ser a sessão privada do ChatGPT, não invente acessos, operações, ferramentas ou memória. Você só recebe o histórico explicitamente enviado. Para executar algo fora desta conversa, indique que é necessária uma ferramenta autorizada.",
        input,
        max_output_tokens: 1100,
        store: false,
      }),
      cache: "no-store",
      signal,
    });
  } catch {
    throw new NaviError("UNAVAILABLE");
  }
  if (!response.ok) throw new NaviError("UNAVAILABLE");
  let data: unknown;
  try { data = await response.json(); } catch { throw new NaviError("INVALID_RESPONSE"); }
  if (!data || typeof data !== "object") throw new NaviError("INVALID_RESPONSE");
  const obj = data as Record<string, unknown>;
  const output = Array.isArray(obj.output) ? obj.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block && typeof block === "object") {
        const b = block as Record<string, unknown>;
        if (b.type === "output_text" && typeof b.text === "string") parts.push(b.text);
      }
    }
  }
  const text = parts.join("\n").trim();
  if (!text) throw new NaviError("INVALID_RESPONSE");
  return { text: text.slice(0, 9000), model, responseId: typeof obj.id === "string" ? obj.id : undefined };
}
