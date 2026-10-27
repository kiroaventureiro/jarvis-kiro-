import countries from "../../config/holo-world-index.json";
import type { HoloScene } from "./types";
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function countryFor(query: string) {
  const n = " " + norm(query).replace(/[^a-z0-9 ]/g, " ") + " ";
  const aliases: Record<string, string> = {
    "estados unidos": "USA",
    eua: "USA",
    "united states": "USA",
    "reino unido": "GBR",
    inglaterra: "GBR",
    russia: "RUS",
    china: "CHN",
    brasil: "BRA",
    brasileira: "BRA",
    brasileiro: "BRA",
    japao: "JPN",
  };
  for (const [alias, id] of Object.entries(aliases))
    if (n.includes(" " + alias + " "))
      return countries.find((c) => c.id === id);
  return [...countries]
    .sort((a, b) => b.name.length - a.name.length)
    .find(
      (c) =>
        n.includes(" " + norm(c.name) + " ") ||
        n.includes(" " + norm(c.english) + " "),
    );
}
export function geographyScene(message: string): HoloScene | null {
  const n = norm(message),
    country = countryFor(message);
  if (
    !/mapa|mundi|mundo|pais|paises|continente|geogra|territori|localiz|onde fica/.test(
      n,
    ) &&
    !country
  )
    return null;
  const name = country?.name || "Mundo";
  return {
    version: 1,
    id: "geo-" + (country?.id || "world"),
    title: country ? name + " · contexto geográfico" : "Mapa-múndi interativo",
    mode: "explanation",
    createdAt: new Date().toISOString(),
    source: {
      kind: "reference",
      label: "Natural Earth · cartografia de referência",
      href: "https://www.naturalearthdata.com/about/terms-of-use/",
    },
    modules: [
      {
        id: "world",
        kind: "map",
        title: country ? "Localizando " + name : "Explorar o mundo",
        region: "WORLD",
        focusCountry: country?.id,
        caption:
          "Selecione um país, aproxime o mapa ou abra a localização no Google Maps. Malha simplificada; não é geocodificação em tempo real.",
      },
      {
        id: "geo-context",
        kind: "report",
        title: "Exploração geográfica",
        summary: "Mapa global com seleção de áreas e acesso ao Google Maps.",
        items: [
          {
            label: country ? name : "Navegação",
            detail: country
              ? "A área está destacada no contexto mundial. O mapa não implica levantamento de indicadores atuais deste país."
              : "Use a busca e a seleção para destacar a área desejada.",
          },
          {
            label: "Fontes e limites",
            detail:
              "Natural Earth 1:110m. Limites simplificados, áreas em disputa e pequenos territórios exigem consulta cartográfica específica.",
          },
        ],
      },
    ],
  };
}
