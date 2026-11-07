import type { PersonalData, PersonalWindow } from "./connectors/personal-read";
export type PersonalPlan = { tasks: Array<"agenda" | "mail">; dayOffset: 0 | 1; days: 1 | 7; unread: boolean; startDate?: string };
export type PersonalModel = (kind: "intent" | "summary", data: string, signal?: AbortSignal) => Promise<string>;
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function personalCandidate(text: string) {
  const n = fold(text);
  return /agenda|compromiss|reunio|reuniao|e.?mail|gmail|mensage(?:m|ns)|caixa de entrada|boletim|resumo do dia|meu dia|minha semana|horarios|prioridades|(?:tenho|preciso fazer).*(?:hoje|amanha|semana)|(?:hoje|amanha).*(?:tenho|pendencia)|o que.*(?:pendente|marcado)|urgente.*(?:mim|minh)/.test(n);
}
export function personalFallback(text: string): PersonalPlan | null {
  const n = fold(text);
  if (/\b(envie|enviar|apague|exclua|crie|criar|marque|agende|altere|cancele|responda)\b/.test(n)) return null;
  if (/como (?:fazer|criar|organizar|configurar)|o que (?:e|significa)\b/.test(n)) return null;
  const agenda = /agenda|compromiss|reuniao|reunio|tenho.*(?:hoje|amanha|semana)/.test(n);
  const mail = /e.?mail|gmail|mensage(?:m|ns)|caixa de entrada/.test(n);
  const summary = /boletim|resumo do dia|organize.*dia|organizar.*dia|prioridades.*dia/.test(n) || (!agenda && !mail && /o que.*(?:hoje|amanha)/.test(n));
  if (/\d{4}-\d{2}-\d{2}|\bdia\s+\d|segunda|terca|quarta|quinta|sexta|sabado|domingo/.test(n)) return null;
  if (!summary && !agenda && !mail) return null;
  return { tasks: summary ? ["agenda", "mail"] : [...(agenda ? ["agenda" as const] : []), ...(mail ? ["mail" as const] : [])], dayOffset: /amanha/.test(n) ? 1 : 0, days: /semana|proximos dias/.test(n) ? 7 : 1, unread: /nao lid|por ler|sem ler/.test(n) };
}
export function parsePersonalPlan(text: string): PersonalPlan | null {
  let v: any;
  try { v = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return null; }
  if (v?.action !== "read" || !Array.isArray(v.tasks) || !v.tasks.length || v.tasks.length > 2 ||
    !v.tasks.every((t: unknown) => t === "agenda" || t === "mail") || ![0, 1].includes(v.dayOffset) || ![1, 7].includes(v.days) || typeof v.unread !== "boolean" ||
    Object.keys(v).some(k => !["action", "tasks", "dayOffset", "days", "unread", "startDate"].includes(k))) return null;
  if (v.startDate !== undefined && (typeof v.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.startDate) || !Number.isFinite(Date.parse(v.startDate)) || new Date(v.startDate).toISOString().slice(0,10) !== v.startDate)) return null;
  return { tasks: [...new Set(v.tasks)] as PersonalPlan["tasks"], dayOffset: v.dayOffset, days: v.days, unread: v.unread, ...(v.startDate ? { startDate: v.startDate } : {}) };
}
export function personalWindow(plan: PersonalPlan, now = Date.now()): PersonalWindow {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  const start = Date.parse((plan.startDate || date) + "T00:00:00-03:00") + (plan.startDate ? 0 : plan.dayOffset * 86400000);
  if (Math.abs(start - now) > 367 * 86400000) throw Error("PERSONAL_INVALID_WINDOW");
  return { start: new Date(start).toISOString(), end: new Date(start + plan.days * 86400000).toISOString() };
}
export function personalFacts(data: PersonalData) {
  const time = (v: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(v));
  if (data.kind === "agenda") return "Agenda principal: " + (data.events?.length ? data.events.map(e => e.title + " — " + (e.allDay ? e.start + " (dia inteiro)" : time(e.start)) + (e.location ? "; local: " + e.location : "")).join("\n") : "nenhum compromisso retornado no período consultado") + (data.partial ? ". Há mais resultados além desta primeira página." : ".");
  return (data.metadataOnly ? "Assuntos Gmail disponíveis pela autorização básica: " : "Caixa de entrada, mensagens dos últimos sete dias: ") + (data.messages?.length ? data.messages.map(m => m.subject + (m.from ? " — " + m.from : "") + (m.unread ? " (não lida)" : "") + (m.date ? "; " + time(m.date) : "")).join("\n") : "nenhuma mensagem retornada nesta consulta") + (data.partial ? ". A consulta é uma amostra e pode haver mais mensagens." : ".") + (data.omitted ? " Mensagens de autenticação foram omitidas do resumo." : "") + (data.metadataOnly ? " Não li o texto das mensagens; para isso falta autorizar Gmail · texto para resumo pessoal em Conexões." : "");
}
export async function answerPersonalRequest(message: string, dependencies: { read: (kind: "agenda" | "mail", options: { window: PersonalWindow; unread: boolean }) => Promise<PersonalData>; model: PersonalModel; now?: () => number }, history: Array<{ role: string; content: string }> = [], signal?: AbortSignal) {
  if (!personalCandidate(message) && !history.filter(t => t.role === "user").slice(-2).some(t => personalCandidate(t.content))) return null;
  // Writes are handled elsewhere; a model interpretation cannot turn one into a read or an execution.
  if (/\b(envie|enviar|apague|exclua|crie|criar|marque|agende|altere|cancele|responda)\b/.test(fold(message))) return null;
  let plan: PersonalPlan | null = null;
  try {
    const interpreted = await dependencies.model("intent", JSON.stringify({ message, today: new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(dependencies.now?.() ?? Date.now())), recentUserContext: history.filter(t => t.role === "user").slice(-2).map(t => t.content.slice(0, 500)) }), signal);
    try { if (JSON.parse(interpreted.replace(/^```(?:json)?\s*|\s*```$/g, "")).action === "none") return null; } catch {}
    plan = parsePersonalPlan(interpreted);
  } catch { if (signal?.aborted) return null; }
  plan ||= personalFallback(message);
  if (!plan) return null;
  const explicit = personalFallback(message);
  if (explicit && explicit.tasks.length === 1) {
    plan.tasks = plan.tasks.filter(task => explicit.tasks.includes(task));
    if (!plan.tasks.length) return null;
  }
  let window: PersonalWindow;
  try { window = personalWindow(plan, dependencies.now?.()); } catch { return { text: "Não consegui determinar com segurança o período. Qual dia ou semana você quer consultar? Não fiz leituras das suas contas.",model:"jk-personal-assistant",provider:"local_operational" as const,usage:null }; }
  const results = await Promise.all(plan.tasks.map(async kind => {
    try { return { kind, data: await dependencies.read(kind, { window, unread: plan!.unread }) }; }
    catch (error) {
      const code = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "";
      const permission = ["WORKSPACE_SCOPE_REQUIRED", "WORKSPACE_NOT_CONNECTED", "WORKSPACE_REAUTHORIZE", "PERSONAL_PERMISSION_REQUIRED"].includes(code);
      return { kind, error: permission ? "Falta confirmar a autorização adicional de " + (kind === "agenda" ? "Google Agenda · compromissos da agenda principal" : "Gmail · texto para resumo pessoal") + " em Conexões. As autorizações anteriores não foram removidas." : "A consulta não foi confirmada agora. Não vou concluir que não existem registros nem que a conta foi desconectada." };
    }
  }));
  if (signal?.aborted) return null;
  const data = results.flatMap(r => r.data ? [r.data] : []);
  const facts = data.map(d => personalFacts(d) + " Leitura confirmada em " + new Date(d.checkedAt).toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"}) + ".");
  let analysis = "";
  if (data.some(d => (d.events?.length || d.messages?.length))) try {
    analysis = await dependencies.model("summary", JSON.stringify({ request: message, window, timeZone: "America/Sao_Paulo", observations: data }), signal);
    if (analysis.length > 6000) analysis = analysis.slice(0, 6000) + " (análise truncada)";
  } catch { /* Confirmed facts remain useful even if the model is unavailable. */ }
  if (signal?.aborted) return null;
  const text = ["Seu resumo pessoal. Período da agenda: " + window.start.slice(0, 10) + " a " + window.end.slice(0, 10) + " (fim exclusivo), horário de São Paulo.", ...facts,
    ...results.filter(r => r.error).map(r => (r.kind === "agenda" ? "Agenda: " : "E-mails: ") + r.error),
    analysis ? "Análise e prioridades sugeridas, com base nessa amostra: " + analysis : data.length ? "Sugestão: comece pelos compromissos com horário marcado e revise as mensagens listadas; não atribuí urgência sem analisar seu conteúdo." : "Depois da autorização, posso consultar essas fontes para organizar seu dia.",
    "Consulta feita agora, sem enviar e-mails, marcar mensagens como lidas ou alterar compromissos. Não é monitoramento contínuo nem um inventário completo das suas contas."].join("\n\n");
  return { text, model: "jk-personal-assistant", provider: "local_operational" as const, usage: null };
}
