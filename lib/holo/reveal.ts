export type HighlightKind =
  | "person"
  | "region"
  | "date"
  | "metric"
  | "number"
  | "reference"
  | "attention"
  | "positive"
  | "critical";
export type Highlight = { text: string; kind: HighlightKind };
export type TextRole = "title" | "subtitle" | "body" | "metadata";
export type RevealPlan = {
  units: string[];
  duration: number;
  batch: number;
  interval: number;
};
export function wordUnits(text: string): string[] {
  if (typeof Intl.Segmenter !== "undefined") {
    const segments = [
      ...new Intl.Segmenter("pt-BR", { granularity: "word" }).segment(text),
    ];
    const out: string[] = [];
    let buffer = "";
    for (const part of segments) {
      buffer += part.segment;
      if (/\s$/u.test(part.segment)) {
        out.push(buffer);
        buffer = "";
      }
    }
    if (buffer) out.push(buffer);
    return out;
  }
  return text.match(/\S+\s*|\s+/gu) || [];
}
export function revealPlan(text: string, role: TextRole = "body"): RevealPlan {
  const units = wordUnits(text),
    batch =
      role === "title"
        ? 1
        : units.length > 90
          ? 5
          : units.length > 40
            ? 3
            : units.length > 20
              ? 2
              : 1;
  const interval = role === "title" ? 100 : role === "metadata" ? 80 : 105;
  return {
    units,
    batch,
    interval,
    duration: Math.ceil(units.length / batch) * interval,
  };
}
export function visibleUnits(plan: RevealPlan, elapsed: number) {
  return Math.min(
    plan.units.length,
    Math.max(0, Math.floor(elapsed / plan.interval) * plan.batch),
  );
}
export function chunkText(text: string, limit: number): string[] {
  const max = Math.max(64, Math.floor(limit)),
    units = wordUnits(text),
    out: string[] = [];
  let line = "";
  for (const token of units) {
    if (line && line.length + token.length > max) {
      out.push(line.trim());
      line = "";
    }
    line += token;
    if (line.length > max * 2) {
      out.push(line.trim());
      line = "";
    }
  }
  if (line.trim()) out.push(line.trim());
  return out;
}
export function conciseTitle(text: string, max = 60) {
  if (text.length <= max) return text;
  const words = wordUnits(text);
  let out = "";
  for (const word of words) {
    if ((out + word).length > max - 1) break;
    out += word;
  }
  return (out.trim() || "Contexto") + "…";
}
export function semanticHighlights(
  text: string,
  context: string[] = [],
): Highlight[] {
  const out: Highlight[] = [];
  const add = (value: string, kind: HighlightKind) => {
    if (
      value.trim().length > 1 &&
      !out.some(
        (x) =>
          x.text.toLocaleLowerCase("pt-BR") ===
          value.toLocaleLowerCase("pt-BR"),
      )
    )
      out.push({ text: value.trim(), kind });
  };
  for (const value of context.slice(0, 2))
    if (text.toLowerCase().includes(value.toLowerCase())) add(value, "region");
  for (const m of text.matchAll(
    /\b(?:Dom|Dona|Dr\.|Dra\.)\s+\p{Lu}[\p{L}-]+(?:\s+(?:\p{Lu}[\p{L}-]+|[IVX]+)){0,2}/gu,
  ))
    add(m[0], "person");
  for (const m of text.matchAll(
    /\b(?:IPCA|Selic|PIB|Supabase|Abacus|GitHub|Vercel|KIRO)\b|d[oó]lar/gi,
  ))
    add(
      m[0],
      /Supabase|Abacus|GitHub|Vercel/i.test(m[0]) ? "reference" : "metric",
    );
  for (const m of text.matchAll(
    /R\$\s?[\d.,]+|-?\d+(?:[.,]\d+)?\s?%|\b(?:1[5-9]\d{2}|20\d{2})\b/g,
  ))
    add(m[0], /^\d{4}$/.test(m[0]) ? "date" : "number");
  return out.slice(0, 6);
}
export function highlightedRuns(text: string, highlights: Highlight[]) {
  const matches: Array<{ start: number; end: number; kind: HighlightKind }> =
    [];
  for (const h of highlights) {
    const escaped = h.text.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
    if (!escaped) continue;
    const regex = new RegExp(escaped, "giu");
    for (const m of text.matchAll(regex)) {
      if (m.index !== undefined)
        matches.push({
          start: m.index,
          end: m.index + m[0].length,
          kind: h.kind,
        });
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Array<{ text: string; kind?: HighlightKind }> = [];
  let index = 0;
  for (const m of matches) {
    if (m.start < index) continue;
    if (m.start > index) out.push({ text: text.slice(index, m.start) });
    out.push({ text: text.slice(m.start, m.end), kind: m.kind });
    index = m.end;
  }
  if (index < text.length) out.push({ text: text.slice(index) });
  return out;
}
