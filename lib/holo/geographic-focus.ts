import type { HoloModule } from "./types";
type MapModule = Extract<HoloModule, { kind: "map" }>;
export const BRAZIL_FOCUSES = [
  {
    name: "Nordeste",
    ids: ["21", "22", "23", "24", "25", "26", "27", "28", "29"],
  },
  { name: "Norte", ids: ["11", "12", "13", "14", "15", "16", "17"] },
  { name: "Centro-Oeste", ids: ["50", "51", "52", "53"] },
  { name: "Sudeste", ids: ["31", "32", "33", "35"] },
  { name: "Sul", ids: ["41", "42", "43"] },
  { name: "Rio de Janeiro", ids: ["33"] },
  { name: "São Paulo", ids: ["35"] },
  { name: "Bahia", ids: ["29"] },
  { name: "Pernambuco", ids: ["26"] },
  { name: "Amazonas", ids: ["13"] },
  { name: "Minas Gerais", ids: ["31"] },
  { name: "Ceará", ids: ["23"] },
];
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function brazilFocuses(text: string) {
  const n = " " + norm(text).replace(/[^a-z -]/g, " ") + " ";
  return BRAZIL_FOCUSES.filter((x) => n.includes(" " + norm(x.name) + " "));
}
export function regionalMap(message: string): MapModule | null {
  const found = brazilFocuses(message);
  if (!found.length) return null;
  return {
    id: "brazil-locality",
    kind: "map",
    region: "BR",
    title: "Brasil · contexto regional",
    caption:
      "Divisão estadual atual do IBGE; não representa fronteiras históricas nem a planta de uma cidade.",
    focusRegions: found[0].ids,
    focusLabel: found[0].name,
  };
}
export function currentBoundaryNote(m: MapModule) {
  return m.region === "BR"
    ? "Limites estaduais atuais · IBGE. Aproximação regional; consulte cartografia municipal para endereços."
    : "Limites atuais simplificados · Natural Earth. Não representam fronteiras históricas.";
}

export const BRAZIL_STATE_IDS = [
  ...new Set(BRAZIL_FOCUSES.flatMap((x) => x.ids)),
];
