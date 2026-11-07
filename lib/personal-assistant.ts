import type { PersonalData, PersonalWindow } from "./connectors/personal-read";
import { personalContextFacts, type PersonalContext } from "./personal-context";
export type PersonalPlan = { tasks: Array<"agenda" | "mail">; dayOffset: 0 | 1; days: 1 | 7; unread: boolean; startDate?: string; includeContext?: boolean };
export type PersonalModel = (kind: "intent" | "summary", data: string, signal?: AbortSignal) => Promise<string>;
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function daySummaryIntent(message: string) {
  const n = fold(message);
  if (/\b(envie|enviar|apague|exclua|crie|criar|marque|agende|altere|cancele|responda)\b/.test(n)) return false;
  if (/como (?:fazer|criar|organizar|configurar)|o que (?:e|significa)\b/.test(n)) return false;
  // A summary about an article, subject or single platform is not permission
  // to read personal accounts. Let the semantic/specialist router handle it.
  if (!/meu dia|minha rotina|minha semana/.test(n) &&
      /\b(?:sobre|acerca|a respeito|do github|do youtube|da vercel|do artigo|desse texto|deste texto)\b/.test(n)) return false;
  if (!/meu dia|minha rotina|minha semana/.test(n) &&
      /\b(?:gmail|e-?mails?|agenda|github|youtube|vercel|supabase|documento|texto|artigo)\b/.test(n)) return false;
  return /\b(?:resum\w*|panorama|balanco|visao geral)\b.*\b(?:meu dia|do dia|hoje|minha rotina|minha semana|de tudo|tudo)\b|\bcomo\s+(?:esta|ta|anda|vai)\s+(?:o\s+)?meu dia\b|\bme (?:deixe|deixa|ponha|poe|coloque|coloca) a par\b|\bme atualiz[ae] (?:sobre )?(?:tudo|meu dia|minha rotina)\b/.test(n);
}
export function personalCandidate(text: string) {
  const n = fold(text);
  return daySummaryIntent(text) || /resum|panorama|me atualiz|minhas coisas|agenda|compromiss|reunio|reuniao|e.?mail|gmail|mensage(?:m|ns)|caixa de entrada|boletim|meu dia|minha semana|horarios|prioridades|(?:tenho|preciso fazer).*(?:hoje|amanha|semana)|(?:hoje|amanha).*(?:tenho|pendencia)|o que.*(?:pendente|marcado)|urgente.*(?:mim|minh)/.test(n);
}
export function personalFallback(text: string): PersonalPlan | null {
  const n = fold(text);
  if (/\b(envie|enviar|apague|exclua|crie|criar|marque|agende|altere|cancele|responda)\b/.test(n)) return null;
  if (/como (?:fazer|criar|organizar|configurar)|o que (?:e|significa)\b/.test(n)) return null;
  const agenda = /agenda|compromiss|reuniao|reunio|tenho.*(?:hoje|amanha|semana)/.test(n);
  const mail = /e.?mail|gmail|mensage(?:m|ns)|caixa de entrada/.test(n);
  const summary = daySummaryIntent(text) || /boletim|resumo do dia|organize.*dia|organizar.*dia|prioridades.*dia/.test(n) || (!agenda && !mail && /o que.*(?:hoje|amanha)/.test(n));
  if (/\d{4}-\d{2}-\d{2}|\bdia\s+\d|segunda|terca|quarta|quinta|sexta|sabado|domingo/.test(n)) return null;
  if (!summary && !agenda && !mail) return null;
  return { tasks: summary ? ["agenda", "mail"] : [...(agenda ? ["agenda" as const] : []), ...(mail ? ["mail" as const] : [])], dayOffset: /amanha/.test(n) ? 1 : 0, days: /semana|proximos dias/.test(n) ? 7 : 1, unread: /nao lid|por ler|sem ler/.test(n) };
}
export function parsePersonalPlan(text: string): PersonalPlan | null {
  let v: any;
  try { v = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return null; }
  if (v?.action !== "read" || !Array.isArray(v.tasks) || !v.tasks.length || v.tasks.length > 2 ||
    !v.tasks.every((t: unknown) => t === "agenda" || t === "mail") || ![0, 1].includes(v.dayOffset) || ![1, 7].includes(v.days) || typeof v.unread !== "boolean" ||
    (v.includeContext !== undefined && typeof v.includeContext !== "boolean") ||
    Object.keys(v).some(k => !["action", "tasks", "dayOffset", "days", "unread", "startDate", "includeContext"].includes(k))) return null;
  if (v.startDate !== undefined && (typeof v.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.startDate) || !Number.isFinite(Date.parse(v.startDate)) || new Date(v.startDate).toISOString().slice(0,10) !== v.startDate)) return null;
  return { tasks: [...new Set(v.tasks)] as PersonalPlan["tasks"], dayOffset: v.dayOffset, days: v.days, unread: v.unread, ...(v.startDate ? { startDate: v.startDate } : {}), ...(v.includeContext !== undefined ? {includeContext:v.includeContext} : {}) };
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
export async function answerPersonalRequest(message: string, dependencies: { read: (kind: "agenda" | "mail", options: { window: PersonalWindow; unread: boolean }) => Promise<PersonalData>; model: PersonalModel; context?: () => Promise<PersonalContext>; now?: () => number }, history: Array<{ role: string; content: string }> = [], signal?: AbortSignal) {
  if (!personalCandidate(message) && !history.filter(t => t.role === "user").slice(-2).some(t => personalCandidate(t.content))) return null;
  // Writes are handled elsewhere; a model interpretation cannot turn one into a read or an execution.
  if (/\b(envie|enviar|apague|exclua|crie|criar|marque|agende|altere|cancele|responda)\b/.test(fold(message))) return null;
  const broadSummary = daySummaryIntent(message);
  // Recognized broad summaries still work when the semantic service is down or
  // its budget is unavailable. Other paraphrases use semantic interpretation.
  let plan: PersonalPlan | null = broadSummary ? personalFallback(message) : null;
  if (!plan) try {
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
  let savedContext: PersonalContext | null = null, contextFailed = false;
  if ((broadSummary || plan.includeContext === true && plan.tasks.length === 2) && dependencies.context) try { savedContext = await dependencies.context(); } catch { contextFailed = true; }
  if (signal?.aborted) return null;
  let analysis = "";
  if (data.some(d => (d.events?.length || d.messages?.length)) || savedContext?.projects.length || savedContext?.pending.length) try {
    analysis = await dependencies.model("summary", JSON.stringify({ request: message, window, timeZone: "America/Sao_Paulo", observations: data, savedContext }), signal);
    if (analysis.length > 6000) analysis = analysis.slice(0, 6000) + " (análise truncada)";
  } catch { /* Confirmed facts remain useful even if the model is unavailable. */ }
  if (signal?.aborted) return null;
  const bound = (value:string,max:number) => value.length>max ? value.slice(0,max)+" (trecho do resumo; há mais detalhes na fonte)" : value;
  const text = ["Seu resumo pessoal sob demanda. Período da agenda: " + window.start.slice(0, 10) + " a " + window.end.slice(0, 10) + " (fim exclusivo), horário de São Paulo.", ...facts.map(f=>bound(f,2500)),
    ...(savedContext ? [bound(personalContextFacts(savedContext),2000)] : contextFailed ? ["Não consegui ler os registros de projetos e pendências agora. Isso não significa que eles foram apagados."] : []),
    ...results.filter(r => r.error).map(r => (r.kind === "agenda" ? "Agenda: " : "E-mails: ") + r.error),
    analysis ? "Análise e prioridades sugeridas, com base nessa amostra: " + bound(analysis,3000) : data.length ? "Sugestão: comece pelos compromissos com horário marcado e revise as mensagens listadas; não atribuí urgência sem analisar seu conteúdo." : "Depois da autorização, posso consultar essas fontes para organizar seu dia.",
    (data.length ? "Leituras feitas agora" : "Leitura das contas não confirmada nesta solicitação") + ". Não enviei e-mails, marquei mensagens como lidas nem alterei compromissos. Este resumo foi acionado pelo seu pedido, sem horário fixo, envio automático ou monitoramento contínuo. Não é um inventário completo das suas contas."].join("\n\n");
  return { text, model: "jk-personal-assistant", provider: "local_operational" as const, usage: null };
}
