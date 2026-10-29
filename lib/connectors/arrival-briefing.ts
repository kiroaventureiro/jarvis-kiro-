import "server-only";
import type { StateStore } from "./types";

const formatTime = () =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short",
  }).format(new Date());

async function bcbLast(series: 432 | 433, name: string) {
  const url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs." + series +
    "/dados/ultimos/1?formato=json";
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      headers: { Accept: "application/json" },
      next: { revalidate: 1800 },
    });
    if (!response.ok) return name + ": fonte indisponível agora";
    const rows: unknown = await response.json();
    const item = Array.isArray(rows) ? rows[0] : null;
    if (!item || !/^\d{2}\/\d{2}\/\d{4}$/.test(String(item.data)) ||
        !/^-?\d+(?:[.,]\d+)?$/.test(String(item.valor)))
      return name + ": dado não confirmado";
    return name + ": " + String(item.valor).replace(".", ",") + "% (referência " +
      item.data + "; Banco Central, série " + series + ")";
  } catch {
    return name + ": consulta indisponível agora";
  }
}

/** Read-only and evidence-bound. Never sends messages, executes writes or triggers models. */
export async function arrivalBriefing(store: StateStore) {
  const sections = ["Boletim do Jarvis, " + formatTime() + "."];
  if (!store.configured()) {
    sections.push("Meu cofre de conectores não está configurado.");
  } else {
    try {
      const state = await store.read();
      const names = ["github", "supabase", "vercel"] as const;
      const statuses = names.map((name) => {
        const c = state.connections[name];
        return name + ": " +
          (c?.status === "connected" && c.verifiedAt
            ? "última verificação " + c.verifiedAt
            : "conexão não verificada");
      });
      sections.push("Estado dos meus conectores: " + statuses.join("; ") + ".");
      const recent = state.audit
        .filter((a) => a.outcome === "failed" || a.outcome === "done")
        .slice(-3);
      if (recent.length)
        sections.push("Eventos de operação registrados: " +
          recent.map((a) => a.operation + " (" + a.outcome + ", " + a.at + ")").join("; ") +
          ". Isso não comprova mudanças de código ou deploys.");
      else sections.push("Não tenho eventos recentes suficientes para declarar novas evoluções ou falhas.");
    } catch {
      sections.push("Não consegui consultar meu estado operacional; não posso confirmar que tudo funciona.");
    }
  }
  const economy = await Promise.all([
    bcbLast(432, "Meta Selic"),
    bcbLast(433, "IPCA mensal"),
  ]);
  sections.push("Economia brasileira: " + economy.join("; ") +
    ". Bolsa de valores e câmbio exigem fonte de cotação verificada.");
  sections.push("Agenda, mensagens, notícias, clima e redes sociais só entram no resumo após consultas autorizadas; não tenho números confirmados para anunciar agora.");
  return {
    text: sections.join(" "),
    model: "jk-arrival-briefing",
    provider: "local_operational" as const,
    usage: null,
  };
}
