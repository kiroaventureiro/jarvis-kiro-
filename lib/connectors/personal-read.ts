import { readJsonBounded } from "../abacus/hub";
export type PersonalWindow = { start: string; end: string };
export type PersonalData = {
  kind: "agenda" | "mail"; checkedAt: string; partial: boolean; omitted: number; metadataOnly?: boolean;
  events?: Array<{ id: string; title: string; start: string; end: string; allDay: boolean; location: string }>;
  messages?: Array<{ id: string; subject: string; from: string; date: string; text: string; truncated: boolean; excerptOnly: boolean; unread: boolean }>;
};
const clean = (v: unknown, max = 300) => typeof v === "string" ? v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f<>]/g, " ").slice(0, max) : "";
export function validatePersonalWindow(window: PersonalWindow) {
  const start = Date.parse(window.start), end = Date.parse(window.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 14 * 86400000) throw Error("PERSONAL_INVALID_WINDOW");
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}
function plainBody(payload: unknown, depth = 0): string {
  if (!payload || typeof payload !== "object" || depth > 6) return "";
  const p = payload as { mimeType?: string; filename?: string; body?: { data?: string }; parts?: unknown[] };
  if (p.filename) return ""; // Never download or read attachments.
  if (p.mimeType === "text/plain" && typeof p.body?.data === "string" && p.body.data.length <= 100000)
    return Buffer.from(p.body.data, "base64url").toString("utf8");
  return Array.isArray(p.parts) ? p.parts.slice(0, 12).map(part => plainBody(part, depth + 1)).join("\n") : "";
}
/** Fixed official GET endpoints only; no message marking, sending, event writes or arbitrary queries. */
export async function readPersonalData(kind: "agenda" | "mail", token: string, options: { window: PersonalWindow; unread?: boolean }, fetcher: typeof fetch = fetch, now = Date.now): Promise<PersonalData> {
  const window = validatePersonalWindow(options.window);
  const get = async (url: string) => {
    const response = await fetcher(url, { method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000), headers: { Authorization: "Bearer " + token } });
    if ([401, 403].includes(response.status)) throw Error("PERSONAL_PERMISSION_REQUIRED");
    return await readJsonBounded(response, 262144) as Record<string, unknown>;
  };
  if (kind === "agenda") {
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    for (const [k, v] of Object.entries({ timeMin: window.start, timeMax: window.end, singleEvents: "true", orderBy: "startTime", maxResults: "20", timeZone: "America/Sao_Paulo", fields: "kind,items(id,summary,status,start,end,location),nextPageToken" })) url.searchParams.set(k, v);
    const data = await get(url.href);
    if (data.items === undefined && data.kind === "calendar#events") data.items = [];
    if (!Array.isArray(data.items)) throw Error("PERSONAL_INVALID_RESPONSE");
    const events = data.items.slice(0, 20).filter((v: any) => v && v.status !== "cancelled").map((v: any) => ({
      id: clean(v.id, 150), title: clean(v.summary) || "Compromisso sem título",
      start: clean(v.start?.dateTime || v.start?.date, 60), end: clean(v.end?.dateTime || v.end?.date, 60),
      allDay: !!v.start?.date && !v.start?.dateTime, location: clean(v.location),
    }));
    if (events.some(e => !Number.isFinite(Date.parse(e.start)) || !Number.isFinite(Date.parse(e.end)))) throw Error("PERSONAL_INVALID_RESPONSE");
    return { kind, checkedAt: new Date(now()).toISOString(), events, partial: !!data.nextPageToken, omitted: 0 };
  }
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("q", "in:inbox newer_than:7d" + (options.unread ? " is:unread" : ""));
  const list = await get(url.href);
  if (list.messages === undefined ? list.resultSizeEstimate !== 0 : !Array.isArray(list.messages)) throw Error("PERSONAL_INVALID_RESPONSE");
  const messages: NonNullable<PersonalData["messages"]> = []; let omitted = 0;
  const details = await Promise.all((list.messages as any[] || []).slice(0, 5).map(async row => {
    if (typeof row?.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(row.id)) throw Error("PERSONAL_INVALID_RESPONSE");
    const item = await get("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + encodeURIComponent(row.id) + "?format=full&fields=id,internalDate,labelIds,snippet,payload(mimeType,filename,headers,body,parts)");
    return { row, item };
  }));
  for (const {row,item} of details) {
    const payload = item.payload as { headers?: Array<{ name?: string; value?: string }> } | undefined;
    const header = (name: string) => clean(payload?.headers?.find(h => h.name?.toLowerCase() === name)?.value);
    const subject = header("subject") || "Mensagem sem assunto";
    // Authentication messages have no place in a briefing or model context.
    if (/security code|verification|verify your|one.time|c[oó]digo|senha|password|autentica|access token/i.test(subject)) { omitted++; continue; }
    const plain = plainBody(payload).trim();
    const raw = plain || clean(item.snippet, 2000);
    const date = Number(item.internalDate);
    messages.push({ id: row.id, subject, from: header("from"), date: Number.isFinite(date) && date > 0 ? new Date(date).toISOString() : "", text: clean(raw, 4000), truncated: raw.length > 4000, excerptOnly: !plain, unread: Array.isArray(item.labelIds) && item.labelIds.includes("UNREAD") });
  }
  return { kind, checkedAt: new Date(now()).toISOString(), messages, partial: !!list.nextPageToken, omitted };
}
