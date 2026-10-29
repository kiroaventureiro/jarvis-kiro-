import "server-only";
import { ConnectorError, type Call, type Provider } from "./types";
export const API_ORIGINS: Record<Provider, string> = {
  github: "https://api.github.com",
  supabase: "https://api.supabase.com",
  vercel: "https://api.vercel.com",
};
export async function boundedResponse(response: Response, limit = 900000) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new ConnectorError(
      response.status === 401 || response.status === 403
        ? "UPSTREAM_AUTH"
        : response.status === 429
          ? "UPSTREAM_RATE_LIMIT"
          : "UPSTREAM_UNAVAILABLE",
      response.status === 429 ? 429 : 502,
    );
  }
  if (response.status === 204) return {};
  const reader = response.body?.getReader();
  if (!reader) return {};
  let raw = "",
    size = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new ConnectorError("UPSTREAM_LIMIT", 502);
      }
      raw += decoder.decode(part.value, { stream: true });
    }
    raw += decoder.decode();
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    if (e instanceof ConnectorError) throw e;
    throw new ConnectorError("UPSTREAM_INVALID", 502);
  } finally {
    reader.releaseLock();
  }
}
export const providerCall: Call = async (
  provider,
  credentials,
  path,
  options = {},
) => {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("#") ||
    /[\r\n]/.test(path)
  )
    throw new ConnectorError("PATH_BLOCKED");
  const url = new URL(path, API_ORIGINS[provider]);
  if (url.origin !== API_ORIGINS[provider])
    throw new ConnectorError("PATH_BLOCKED");
  return boundedResponse(
    await fetch(url, {
      method: options.method || "GET",
      headers: {
        Authorization: "Bearer " + credentials.accessToken,
        Accept:
          provider === "github"
            ? "application/vnd.github+json"
            : "application/json",
        ...(provider === "github"
          ? { "X-GitHub-Api-Version": "2022-11-28" }
          : {}),
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      redirect: "error",
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(12000)])
        : AbortSignal.timeout(12000),
    }),
  );
};
