import "server-only";
import { PublicLibrary, libraryIntent } from "./library";
import type { HoloScene } from "../holo/types";
export const publicLibrary = new PublicLibrary();
export async function answerPublicLibrary(
  message: string,
  signal?: AbortSignal,
) {
  const intent = libraryIntent(message);
  if (!intent) return null;
  try {
    const items = await publicLibrary.search(
        intent.provider,
        intent.query,
        signal,
      ),
      checkedAt = new Date().toISOString();
    const source = intent.provider === "crossref" ? "Crossref" : "Open Library";
    const text = items.length
      ? "Encontrei " +
        items.length +
        " referências no " +
        source +
        " sobre " +
        intent.query +
        ". São registros bibliográficos, não leitura integral nem confirmação das conclusões dos trabalhos. Vou apresentar títulos, autoria e links para conferir as fontes."
      : "Não encontrei referências nessa consulta ao " + source + ".";
    const visual: HoloScene | undefined = items.length
      ? {
          version: 1,
          id: "library-" + crypto.randomUUID(),
          title: "Referências · " + source,
          mode: "analysis",
          createdAt: checkedAt,
          source: {
            kind: "research",
            label: source + " · metadados consultados",
            checkedAt,
          },
          narration: text,
          modules: items.map((i, n) => ({
            id: "reference-" + n,
            kind: "report",
            title: i.title,
            summary: [i.authors, i.year].filter(Boolean).join(" · "),
            items: [
              {
                label: "Escopo",
                detail:
                  "Registro bibliográfico; texto completo não foi lido por esta consulta.",
              },
            ],
            href: i.href,
          })),
          sources: items.map((i) => ({
            label: i.title,
            href: i.href,
            checkedAt,
            status: "ok",
          })),
        }
      : undefined;
    return {
      text,
      model: "jk-public-library",
      usage: null,
      provider: "local_operational" as const,
      visual,
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      text: "A fonte bibliográfica está indisponível ou atingiu o limite desta janela. Não inventei referências nem executei um modelo pago.",
      model: "jk-public-library",
      usage: null,
      provider: "local_operational" as const,
    };
  }
}
