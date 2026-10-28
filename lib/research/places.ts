import countries from "../../config/holo-world-index.json";
import "server-only";
import rows from "../../public/holo-places-index.json";
import { findPlace, type PlaceRow } from "../holo/place-policy";
import { countryFor } from "../holo/geography";
import type { HoloScene } from "../holo/types";
export function answerPlaceReference(message: string) {
  const country = countryFor(message),
    found = findPlace(message, rows as PlaceRow[], country?.id);
  if (!found) return null;
  const p = found.place,
    text =
      "Localizei " +
      p[1] +
      (p[5] ? ", " + p[5] : "") +
      " no contexto de " +
      (countries.find((c) => c.id === p[2])?.name || p[2]) +
      ". Coordenadas de referência: " +
      p[4].toFixed(3) +
      ", " +
      p[3].toFixed(3) +
      ". O ponto é uma referência cartográfica do Natural Earth, não um mapa de ruas nem um limite municipal." +
      (found.ambiguous
        ? " Existem localidades com nomes semelhantes; confirme o país e a região."
        : "");
  const visual: HoloScene = {
    version: 1,
    id: "geo-place-" + p[0],
    title: p[1] + " · localização de referência",
    mode: "explanation",
    createdAt: new Date().toISOString(),
    source: {
      kind: "reference",
      label: "Natural Earth · localidades de referência, dados locais",
      href: "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/",
    },
    narration: text,
    modules: [
      {
        id: "locality",
        kind: "map",
        region: "WORLD",
        title: p[1],
        focusCountry: p[2],
        focusPlaceId: p[0],
        caption: text,
      },
    ],
  };
  return {
    text,
    visual,
    model: "jk-local-geography",
    provider: "local_operational" as const,
    usage: null,
  };
}
