import "server-only";
import { CommonsResearch, imageSearchIntent } from "./commons";
import type { HoloScene } from "../holo/types";
export const commonsResearch = new CommonsResearch();
export async function answerImages(message: string, signal?: AbortSignal) {
  const query = imageSearchIntent(message);
  if (!query) return null;
  try {
    const images = await commonsResearch.search(query, signal);
    const text = images.length
      ? "Encontrei referências de " +
        query +
        " no Wikimedia Commons. Vou mostrar cada imagem com autoria, licença e origem verificáveis. A classificação do tipo de imagem será indicada quando houver evidência."
      : "Não encontrei uma imagem disponível com autoria e licença verificáveis para esse pedido. Não vou substituir por uma imagem sintética.";
    const visual: HoloScene | undefined = images.length
      ? {
          version: 1,
          id: "images-" + crypto.randomUUID(),
          title: "Referências visuais · " + query.slice(0, 70),
          mode: "explanation",
          createdAt: new Date().toISOString(),
          source: {
            kind: "research",
            label: "Wikimedia Commons · metadados e arquivo verificados",
            href: "https://commons.wikimedia.org/",
            checkedAt: new Date().toISOString(),
          },
          narration: text,
          modules: [
            {
              id: "references",
              kind: "media",
              title: query.slice(0, 90),
              items: images.map((i, n) => ({
                id: "commons-" + n,
                type: "image",
                label: i.title.slice(5).slice(0, 120),
                commonsTitle: i.title,
                url: i.url,
                caption: "Referência do Wikimedia Commons; tipo: " + i.nature,
                credit: i.author,
                sourceHref: i.sourceHref,
                license: i.license,
                licenseHref: i.licenseHref,
                mediaNature: i.nature,
                verifiedAt: i.checkedAt,
              })),
            },
          ],
        }
      : undefined;
    return {
      text,
      model: "jk-commons-research",
      provider: "local_operational" as const,
      usage: null,
      visual,
    };
  } catch (e) {
    if (signal?.aborted) throw e;
    return {
      text:
        e instanceof Error
          ? e.message
          : "Pesquisa visual indisponível. Nenhuma imagem foi inventada.",
      model: "jk-commons-research",
      provider: "local_operational" as const,
      usage: null,
    };
  }
}
