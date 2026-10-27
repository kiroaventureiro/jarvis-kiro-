import type { Evidence } from "./state";
export async function probeAbacusCatalog(
  key: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Omit<Evidence, "checkedAt">> {
  const res = await fetcher("https://routellm.abacus.ai/v1/models", {
    method: "GET",
    headers: { Authorization: "Bearer " + key },
    cache: "no-store",
    redirect: "error",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(4000)])
      : AbortSignal.timeout(4000),
  });
  if (!res.ok)
    return {
      ok: false,
      checks: [],
      failure: [401, 403].includes(res.status)
        ? "permission"
        : "verification_unavailable",
    };
  if (!res.body) return { ok: false, checks: [], failure: "invalid_response" };
  const reader = res.body.getReader();
  let bytes = 0,
    raw = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 1000000) throw new Error("INVALID_CATALOG");
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const data = JSON.parse(raw);
  const items = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data)
      ? data
      : null;
  if (
    !items?.length ||
    !items.every((x: { id?: unknown }) => x && typeof x.id === "string")
  )
    return { ok: false, checks: [], failure: "invalid_response" };
  return {
    ok: true,
    checks: [
      "api_catalog",
      ...(items.some((x: { id: string }) => x.id === "route-llm")
        ? ["route_model_listed"]
        : []),
    ],
  };
}
