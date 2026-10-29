import { requestOriginAllowed } from "../request-origin";
export function sameOrigin(request: Request) {
  return requestOriginAllowed(request, process.env.JARVIS_CONNECTOR_ORIGIN, false);
}
export async function boundedBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("INVALID_BODY");
  let size = 0,
    raw = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) throw Error("BODY_LIMIT");
      raw += decoder.decode(part.value, { stream: true });
    }
    raw += decoder.decode();
    return JSON.parse(raw);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
