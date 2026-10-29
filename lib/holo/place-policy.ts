export type PlaceRow = [string, string, string, number, number, string];
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function projectWorldPoint(lon: number, lat: number) {
  return { x: ((lon + 180) * 1000) / 360, y: ((90 - lat) * 500) / 180 };
}
export function explicitPlaceQuery(message: string) {
  return /\b(mapa|localize|localizar|onde fica|aproxime|aproximar)\b/i.test(
    norm(message),
  );
}
export function findPlace(message: string, rows: PlaceRow[], country?: string) {
  if (!explicitPlaceQuery(message)) return null;
  let n = " " + norm(message).replace(/[^a-z0-9 ]/g, " ") + " ";
  const aliases: Record<string, string> = {
    "nova iorque": "new york",
    "nova york": "new york",
    londres: "london",
    pequim: "beijing",
    roma: "rome",
    atenas: "athens",
    munique: "munich",
    varsovia: "warsaw",
    copenhague: "copenhagen",
  };
  for (const [a, b] of Object.entries(aliases))
    n = n.replace(" " + a + " ", " " + b + " ");
  const matches = rows
    .filter(
      (r) =>
        (!country || r[2] === country) &&
        r[1].length >= 3 &&
        n.includes(" " + norm(r[1]).replace(/[^a-z0-9 ]/g, " ") + " "),
    )
    .sort((a, b) => b[1].length - a[1].length);
  return matches[0]
    ? {
        place: matches[0],
        ambiguous:
          matches.filter((r) => norm(r[1]) === norm(matches[0][1])).length > 1,
      }
    : null;
}
