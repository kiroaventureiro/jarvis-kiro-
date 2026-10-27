import type { HoloScene, HoloModule } from "../holo/types";
export type Observation = { period: string; value: number };
export type Evidence = {
  id: string;
  label: string;
  unit: string;
  href: string;
  checkedAt: string;
  status: "ok" | "unavailable" | "mismatch";
  values: Observation[];
  note: string;
};
type Options = { fetcher?: typeof fetch; now?: () => number };
export const ECONOMY_SOURCES = [
  {
    id: "ipca",
    label: "IPCA mensal",
    unit: "% no mês",
    base: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json",
  },
  {
    id: "selic",
    label: "Meta Selic",
    unit: "% ao ano",
    base: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/20?formato=json",
  },
  {
    id: "usd",
    label: "Dólar comercial · venda",
    unit: "R$ por US$",
    base: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/20?formato=json",
  },
  {
    id: "ibge",
    label: "Conferência IPCA · IBGE",
    unit: "% no mês",
    base: "https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos/-12/variaveis/63?localidades=N1%5Ball%5D",
  },
] as const;
export function economyIntent(message: string) {
  const n = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    /economi|inflac|ipca|selic|dolar|juros|cambio/.test(n) &&
    /brasil|brasileir|\bipca\b|\bselic\b|\bdolar\b/.test(n)
  );
}
export function parseEconomicData(
  id: string,
  raw: unknown,
  now = Date.now(),
): Observation[] {
  const maxDate = new Date(now).toISOString().slice(0, 10);
  let rows: Observation[] = [];
  if (id === "ibge") {
    const root = Array.isArray(raw) ? raw[0] : null;
    if (
      root?.id !== "63" ||
      root.unidade !== "%" ||
      !String(root.variavel).includes("Variação mensal")
    )
      throw Error("invalid source");
    const entry = root.resultados
      ?.flatMap((x: any) => x.series || [])
      .find((s: any) => s.localidade?.id === "1");
    if (!entry?.serie) throw Error("empty source");
    rows = Object.entries(entry.serie).map(([period, value]) => ({
      period: /^\d{6}$/.test(period)
        ? period.slice(0, 4) + "-" + period.slice(4) + "-01"
        : "",
      value: /^-?\d+(?:[.,]\d+)?$/.test(String(value))
        ? Number(String(value).replace(",", "."))
        : NaN,
    }));
  } else {
    if (!Array.isArray(raw) || raw.length > 500) throw Error("invalid source");
    rows = raw.map((r) => {
      const m =
        typeof r?.data === "string"
          ? r.data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
          : null;
      return {
        period: m ? m[3] + "-" + m[2] + "-" + m[1] : "",
        value:
          typeof r?.valor === "string" && /^-?\d+(?:\.\d+)?$/.test(r.valor)
            ? Number(r.valor)
            : NaN,
      };
    });
  }
  const values = rows
    .filter(
      (r) =>
        /^\d{4}-\d{2}-\d{2}$/.test(r.period) &&
        Number.isFinite(Date.parse(r.period)) &&
        new Date(r.period).toISOString().slice(0, 10) === r.period &&
        r.period <= maxDate &&
        Number.isFinite(r.value) &&
        Math.abs(r.value) < 1e7,
    )
    .sort((a, b) => a.period.localeCompare(b.period));
  const unique = [...new Map(values.map((v) => [v.period, v])).values()];
  if (!unique.length) throw Error("no observed values");
  return unique.slice(-12);
}
export function compareInflation(a: Evidence, b: Evidence) {
  if (a.status !== "ok" || b.status !== "ok")
    return "Conferência entre IBGE e Banco Central indisponível.";
  const left = a.values.at(-1)!,
    right = b.values.find((v) => v.period === left.period);
  if (!right)
    return "As fontes têm períodos diferentes; não foi possível confirmar o último período entre elas.";
  return Math.abs(right.value - left.value) <= 0.01001
    ? "O IPCA do último período coincide entre IBGE e Banco Central (mesma estatística disseminada nas duas fontes)."
    : "Divergência encontrada entre IBGE e Banco Central no mesmo período; confira as fontes antes de concluir.";
}
export async function collectEconomy(
  options: Options = {},
): Promise<Evidence[]> {
  const now = (options.now || Date.now)(),
    checkedAt = new Date(now).toISOString(),
    fetcher = options.fetcher || fetch;
  return Promise.all(
    ECONOMY_SOURCES.map(async (source) => {
      const common = {
        id: source.id,
        label: source.label,
        unit: source.unit,
        href: source.base,
        checkedAt,
      };
      try {
        const response = await fetcher(source.base, {
          method: "GET",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(9000),
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw Error();
        const reader = response.body?.getReader();
        if (!reader) throw Error();
        let text = "",
          size = 0;
        const decoder = new TextDecoder();
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.length;
            if (size > 180000) {
              await reader.cancel();
              throw Error();
            }
            text += decoder.decode(part.value, { stream: true });
          }
          text += decoder.decode();
        } finally {
          reader.releaseLock();
        }
        const values = parseEconomicData(source.id, JSON.parse(text), now),
          latest = values.at(-1)!,
          age = (now - Date.parse(latest.period)) / 86400000;
        return {
          ...common,
          status: "ok" as const,
          values,
          note: (
            source.id === "ipca" || source.id === "ibge" ? age > 65 : age > 10
          )
            ? "Última observação disponível está defasada; não representa o valor de hoje."
            : "Última observação publicada; frequência e data constam no gráfico.",
        };
      } catch {
        return {
          ...common,
          status: "unavailable" as const,
          values: [],
          note: "Fonte não respondeu ou retornou dados inválidos. Nenhum número foi estimado.",
        };
      }
    }),
  );
}
const display = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const dateLabel = (s: string) =>
  s.slice(8) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4);
export function economyReply(evidence: Evidence[]) {
  const sources = evidence.map(({ label, href, checkedAt, status, note }) => ({
      label,
      href,
      checkedAt,
      status,
      note,
    })),
    confirmed = evidence.filter((x) => x.id !== "ibge" && x.status === "ok"),
    ipca = evidence.find((x) => x.id === "ipca")!,
    ibge = evidence.find((x) => x.id === "ibge")!;
  const comparison =
    ipca && ibge
      ? compareInflation(ipca, ibge)
      : "Conferência de fontes não disponível.";
  if (comparison.startsWith("Divergência"))
    for (const src of sources)
      if (src.href === ipca.href || src.href === ibge.href) {
        src.status = "mismatch";
        src.note = comparison;
      }
  const facts = confirmed.map((x) => {
    const last = x.values.at(-1)!;
    return {
      x,
      text:
        x.label +
        ": " +
        display(last.value) +
        " " +
        x.unit +
        ", observação de " +
        dateLabel(last.period) +
        ". " +
        x.note,
    };
  });
  const summary = facts.length
    ? "Consultei séries públicas do Banco Central e tentei conferir o IPCA no IBGE. " +
      facts.map((f) => f.text).join(" ") +
      " " +
      comparison +
      " Esses indicadores mostram preços, juros e câmbio; não são um diagnóstico completo da economia nem uma cotação em tempo real."
    : "As fontes oficiais não retornaram observações válidas agora. Não vou estimar números ou apresentar um gráfico como se tivesse sido consultado. O relatório registra as fontes e a indisponibilidade.";
  const modules: HoloModule[] = [
    {
      id: "economic-map",
      kind: "map",
      title: "Brasil no contexto mundial",
      region: "WORLD",
      focusCountry: "BRA",
      caption:
        "Contexto geográfico. Os gráficos usam apenas as séries oficiais indicadas; o mapa não atribui indicadores aos demais países.",
    },
    ...facts.map(({ x }) => ({
      id: x.id,
      kind: "metrics" as const,
      title: x.label,
      style: "line" as const,
      unit: x.unit + " · Banco Central",
      values: x.values.map((v) => ({
        label: v.period.slice(5, 7) + "/" + v.period.slice(2, 4),
        period: v.period,
        value: v.value,
      })),
    })),
    {
      id: "findings",
      kind: "report",
      title: "Leitura dos indicadores",
      summary: facts.length
        ? "Observações publicadas, com períodos e fontes identificados."
        : "Consulta indisponível; nenhuma medição inventada.",
      items: [
        ...facts.map((f) => ({ label: f.x.label, detail: f.text })),
        { label: "Conferência", detail: comparison },
        {
          label: "Escopo",
          detail:
            "Não inclui PIB, desemprego, notícias ou recomendações de investimento. Não equivale a pesquisa de toda a internet.",
        },
      ],
      body: summary,
    },
  ];
  const visual: HoloScene = {
    version: 1,
    id: "economy-br-" + Date.now(),
    title: "Economia brasileira · dados consultados",
    mode: "analysis",
    createdAt: new Date().toISOString(),
    source: {
      kind: "research",
      label: facts.length
        ? "Consulta a fontes oficiais · observe as datas"
        : "Fontes oficiais indisponíveis",
      href: "https://www.bcb.gov.br/estatisticas",
      checkedAt: new Date().toISOString(),
    },
    sources,
    modules,
    narration: summary,
  };
  return {
    text: summary,
    model: "jk-official-research",
    provider: "local_operational" as const,
    usage: null,
    visual,
  };
}
