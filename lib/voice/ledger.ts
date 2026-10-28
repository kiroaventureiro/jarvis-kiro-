import type { StateStore } from "../connectors/types";
export type VoiceUsageState = {
  since: number;
  started: number;
  sessions: Record<
    string,
    {
      at: number;
      seen: string[];
      input: number;
      output: number;
      reports: number;
    }
  >;
};
export function voiceUsageStats(
  v: VoiceUsageState | undefined,
  now = Date.now(),
) {
  const active = v && now - v.since < 3600000 ? v : undefined;
  const entries = Object.values(active?.sessions || {});
  return {
    persistent: !!v,
    sessions: active?.started || 0,
    inputTokens: entries.reduce((s, e) => s + e.input, 0),
    outputTokens: entries.reduce((s, e) => s + e.output, 0),
    responses: entries.reduce((s, e) => s + e.reports, 0),
    source: "client_reported" as const,
    note: "Tokens relatados pelo navegador; não é fatura nem confirmação independente do provedor. Limite persistente controla aberturas, não gasto monetário de uma sessão.",
  };
}
export async function admitVoiceSession(
  store: StateStore,
  id: string,
  limit: number,
  now = Date.now(),
) {
  if (!store.configured()) return { persistent: false, sessionId: null };
  return store.update((s) => {
    if (!s.voiceUsage || now - s.voiceUsage.since >= 3600000)
      s.voiceUsage = { since: now, started: 0, sessions: {} };
    const v = s.voiceUsage;
    if (v.started >= limit) throw Error("VOICE_SESSION_LIMIT");
    v.started++;
    v.sessions[id] = { at: now, seen: [], input: 0, output: 0, reports: 0 };
    return { persistent: true, sessionId: id };
  });
}
export function validateVoiceReport(value: unknown) {
  const d = value as Record<string, unknown>;
  if (
    !d ||
    typeof d !== "object" ||
    Array.isArray(d) ||
    Object.keys(d).some(
      (k) =>
        !["sessionId", "responseId", "inputTokens", "outputTokens"].includes(k),
    ) ||
    typeof d.sessionId !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(d.sessionId) ||
    typeof d.responseId !== "string" ||
    !/^[\w-]{1,128}$/.test(d.responseId) ||
    ![d.inputTokens, d.outputTokens].every(
      (n) =>
        typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 5000000,
    )
  )
    throw Error("INVALID_USAGE_REPORT");
  return d as {
    sessionId: string;
    responseId: string;
    inputTokens: number;
    outputTokens: number;
  };
}
export async function recordVoiceUsage(
  store: StateStore,
  raw: unknown,
  now = Date.now(),
) {
  const d = validateVoiceReport(raw);
  return store.update((s) => {
    const v = s.voiceUsage,
      session = v?.sessions[d.sessionId];
    if (!v || !session || now - v.since >= 3600000)
      throw Error("UNKNOWN_USAGE_SESSION");
    if (!session.seen.includes(d.responseId)) {
      if (session.seen.length >= 200) throw Error("USAGE_REPORT_LIMIT");
      session.seen.push(d.responseId);
      session.input += d.inputTokens;
      session.output += d.outputTokens;
      session.reports++;
    }
    return voiceUsageStats(v, now);
  });
}

export function voiceUsageIntent(message: string) {
  const n = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    /\b(consumo|tokens|gasto|gastei)\b/.test(n) &&
    /\b(voz|realtime|sessao|sessoes)\b/.test(n)
  );
}
