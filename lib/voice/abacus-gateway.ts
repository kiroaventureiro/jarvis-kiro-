import type { CostPermission } from "./cost-policy";
type Dependencies = {
  configured: () => boolean;
  permission: () => CostPermission;
  admit: (permission: CostPermission) => { allowed: boolean; reason: string };
  reply: (
    text: string,
    signal: AbortSignal,
  ) => Promise<{ text: string; model: string; usage: unknown }>;
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
  if (!deps.configured())
    return error("Chave Abacus não configurada no servidor", 503);
  const origin = request.headers.get("Origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
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
        if (size > 8192) {
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
  const { message } = data as { message?: unknown };
  if (
    typeof message !== "string" ||
    message.trim().length < 1 ||
    message.length > 1500
  )
    return error("Mensagem inválida", 400);
  const permission = deps.permission();
  if (!permission.allowed)
    return error(
      "Uso pago da Abacus bloqueado. É necessária autorização e orçamento de chamadas no servidor.",
      403,
    );
  const admitted = deps.admit(permission);
  if (!admitted.allowed) return error(admitted.reason, 429);
  try {
    const reply = await deps.reply(message, request.signal);
    return Response.json(reply, { headers });
  } catch {
    return error(
      request.signal.aborted
        ? "Pedido interrompido"
        : "Falha na solicitação à Abacus",
      502,
    );
  }
}
