/** CSRF allowlist independent of the internal URL chosen by a reverse proxy. */
function origin(value: string | null | undefined) {
  if (!value || value.length > 500) return null;
  try {
    const u = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    if (u.username || u.password || u.pathname !== "/" || u.search || u.hash ||
      (u.protocol !== "https:" && !(u.protocol === "http:" && loopback))) return null;
    return u.origin;
  } catch { return null; }
}
const official = ["https://jarvis-kiro.vercel.app", "https://jarvis-kiro-umiversokiro.vercel.app"];
export function requestOriginStatus(request: Request, configuredOrigin?: string, requireOrigin = true) {
  const canonical = origin(configuredOrigin), urlOrigin = new URL(request.url).origin;
  const raw = request.headers.get("origin"), submitted = origin(raw);
  const fetchSite = request.headers.get("sec-fetch-site");
  const allowed = new Set([...(canonical ? [canonical] : configuredOrigin ? [] : [urlOrigin]), ...official]);
  let reason = "ALLOWED";
  if (configuredOrigin && !canonical) reason = "ORIGIN_CONFIG_INVALID";
  else if (fetchSite === "cross-site") reason = "CROSS_SITE";
  else if (!raw) reason = requireOrigin ? "ORIGIN_REQUIRED" : "NON_BROWSER_REQUEST";
  else if (!submitted || raw !== submitted) reason = "ORIGIN_INVALID";
  else if (!allowed.has(submitted)) reason = "ORIGIN_NOT_ALLOWED";
  const headerHost = (name: string) => {
    const value = request.headers.get(name);
    return value && /^[a-zA-Z0-9.:[\]-]{1,253}$/.test(value) ? value : null;
  };
  return {
    allowed: reason === "ALLOWED" || reason === "NON_BROWSER_REQUEST",
    reason,
    origin: submitted,
    urlOrigin,
    canonicalOrigin: canonical,
    host: headerHost("host"),
    forwardedHost: headerHost("x-forwarded-host"),
    forwardedProto: ["http", "https"].includes(request.headers.get("x-forwarded-proto") || "") ? request.headers.get("x-forwarded-proto") : null,
    fetchSite: ["same-origin", "same-site", "cross-site", "none"].includes(fetchSite || "") ? fetchSite : null,
    proxyUrlDiffers: !!submitted && submitted !== urlOrigin,
  };
}
export function requestOriginAllowed(request: Request, configuredOrigin?: string, requireOrigin = true) {
  return requestOriginStatus(request, configuredOrigin, requireOrigin).allowed;
}
/** OAuth GETs arrive cross-site: fixed callback host plus state/PKCE/binding, not POST Origin rules. */
export function callbackHostAllowed(request: Request, configuredOrigin?: string) {
  const expected = origin(configuredOrigin);
  if (!expected) return false;
  return new URL(request.url).origin === expected || request.headers.get("host") === new URL(expected).host;
}
