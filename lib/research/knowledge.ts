import {
  publicResearchQuery,
  requestIntent,
} from "../cognitive/request-intent";
import type { HoloScene } from "../holo/types";
export type KnowledgeSource = {
  title: string;
  href: string;
  extract: string;
  updatedAt: string | null;
  checkedAt: string;
  license: string;
};
export type KnowledgeResult = {
  query: string;
  sources: KnowledgeSource[];
  checkedAt: string;
  limitation: string;
};
export class KnowledgeResearch {
  private cache = new Map<string, { until: number; result: KnowledgeResult }>();
  private recent: number[] = [];
  constructor(
    private fetcher: typeof fetch = fetch,
    private now = () => Date.now(),
  ) {}
  async search(
    message: string,
    signal?: AbortSignal,
  ): Promise<KnowledgeResult | null> {
    const q = publicResearchQuery(message);
    if (!q) return null;
    const hit = this.cache.get(q);
    if (hit && hit.until > this.now()) return hit.result;
    this.recent = this.recent.filter((t) => this.now() - t < 60000);
    if (this.recent.length >= 10) throw Error("PUBLIC_RESEARCH_RATE_LIMIT");
    this.recent.push(this.now());
    const checkedAt = new Date(this.now()).toISOString(),
      sources: KnowledgeSource[] = [];
    for (const language of ["pt", "en"]) {
      if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
      const url = new URL("https://" + language + ".wikipedia.org/w/api.php");
      url.search = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        generator: "search",
        gsrsearch: q,
        gsrnamespace: "0",
        gsrlimit: "3",
        prop: "extracts|info|revisions",
        exintro: "1",
        explaintext: "1",
        exchars: "1100",
        exlimit: "3",
        inprop: "url",
        rvprop: "timestamp",
      }).toString();
      const r = await this.fetcher(url, {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(7000)])
          : AbortSignal.timeout(7000),
        headers: {
          Accept: "application/json",
          "User-Agent":
            "JarvisKiro/1.0 (https://github.com/kiroaventureiro/jarvis-kiro-; public-reference research)",
        },
        redirect: "error",
        cache: "no-store",
      });
      if (!r.ok) throw Error("PUBLIC_RESEARCH_UNAVAILABLE");
      const reader = r.body?.getReader();
      if (!reader) throw Error("PUBLIC_RESEARCH_INVALID");
      let raw = "",
        size = 0;
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const p = await reader.read();
          if (p.done) break;
          size += p.value.byteLength;
          if (size > 350000) {
            await reader.cancel();
            throw Error("PUBLIC_RESEARCH_LIMIT");
          }
          raw += decoder.decode(p.value, { stream: true });
        }
        raw += decoder.decode();
      } finally {
        reader.releaseLock();
      }
      const body = JSON.parse(raw);
      const pages = Array.isArray(body?.query?.pages) ? body.query.pages : [];
      for (const p of pages.slice(0, 3)) {
        if (
          typeof p.title !== "string" ||
          typeof p.extract !== "string" ||
          !p.extract.trim() ||
          typeof p.fullurl !== "string"
        )
          continue;
        const href = new URL(p.fullurl);
        if (
          href.protocol !== "https:" ||
          href.hostname !== language + ".wikipedia.org" ||
          !href.pathname.startsWith("/wiki/") ||
          href.username ||
          href.password
        )
          continue;
        sources.push({
          title: p.title.slice(0, 150),
          href: href.href,
          extract: p.extract.replace(/<[^>]+>/g, "").slice(0, 1300),
          updatedAt:
            typeof p.revisions?.[0]?.timestamp === "string"
              ? p.revisions[0].timestamp
              : null,
          checkedAt,
          license: "CC BY-SA 4.0 · Wikipédia",
        });
      }
      if (sources.length) break;
    }
    const result = {
      query: q,
      sources,
      checkedAt,
      limitation:
        requestIntent(message) === "current"
          ? "Referências enciclopédicas consultadas agora; isso não confirma notícias de hoje ou o estado atual completo do assunto."
          : "Referências enciclopédicas, sem verificação independente de todas as afirmações.",
    };
    if (this.cache.size >= 30)
      this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(q, { until: this.now() + 180000, result });
    return result;
  }
}
export function knowledgeVisual(
  text: string,
  data: KnowledgeResult,
): HoloScene {
  return {
    version: 1,
    id: "knowledge-" + Date.now(),
    title: "Investigação · " + data.query.slice(0, 70),
    mode: "analysis",
    createdAt: data.checkedAt,
    source: {
      kind: "research",
      label: "Referências públicas · procedência disponível",
      checkedAt: data.checkedAt,
    },
    narration: text,
    modules: [
      {
        id: "analysis",
        kind: "text",
        title: "O que encontrei",
        text,
        tags: ["Pesquisa pública"],
      },
      ...data.sources.map((s, i) => ({
        id: "source-" + i,
        kind: "report" as const,
        title: s.title,
        summary: s.extract,
        items: [{ label: "Origem e reutilização", detail: s.license }],
        href: s.href,
        body:
          s.extract +
          "\n" +
          s.license +
          "\nConsultada em " +
          s.checkedAt +
          "\n" +
          (s.updatedAt
            ? "Revisão da página: " + s.updatedAt
            : "Revisão não informada"),
      })),
    ],
    sources: data.sources.map((s) => ({
      label: s.title,
      href: s.href,
      checkedAt: s.checkedAt,
      status: "ok",
      note: s.license + " · " + data.limitation,
    })),
  };
}
export function knowledgeReply(data: KnowledgeResult) {
  const text = data.sources.length
    ? data.sources.map((s) => s.title + ": " + s.extract).join("\n\n") +
      "\n\n" +
      data.limitation
    : "Não encontrei uma referência pública adequada nessa fonte. Posso continuar por outra fonte conectada; nenhum resultado foi inventado.";
  return {
    text,
    visual: data.sources.length ? knowledgeVisual(text, data) : undefined,
    model: "jk-public-reference",
    provider: "local_operational" as const,
    usage: null,
  };
}
