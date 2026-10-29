import type { HoloScene, HoloModule } from "./types";
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function repeatsSpeech(value: string, spoken: string) {
  const v = norm(value),
    s = norm(spoken);
  if (!v || v.length < 22) return false;
  if (s.includes(v)) return true;
  const words = v.split(" ").filter((x) => x.length > 2),
    source = new Set(s.split(" "));
  return (
    words.length >= 8 &&
    words.filter((w) => source.has(w)).length / words.length >= 0.85
  );
}
/** Projection is supplemental evidence; the full spoken answer stays in narration/export. */
export function complementaryScene(
  scene: HoloScene | null,
  spoken: string,
): HoloScene | null {
  if (!scene) return null;
  const seen = new Set<string>();
  const extra = (s: string, max = 220) => {
    if (repeatsSpeech(s, spoken)) return "";
    const n = norm(s);
    if (!n || seen.has(n)) return "";
    seen.add(n);
    return s.slice(0, max);
  };
  const modules: HoloModule[] = scene.modules.flatMap((m): HoloModule[] => {
    if (m.kind === "text") {
      const text = extra(m.text);
      return text
        ? [{ ...m, text, title: m.title.length > 65 ? "Referência" : m.title }]
        : [];
    }
    if (m.kind === "report") {
      const summary = extra(m.summary);
      const items = m.items.flatMap((p) => {
        let detail = p.detail;
        if (norm(detail).startsWith(norm(p.label) + " "))
          detail = detail.slice(p.label.length).replace(/^[. :—–-]+/, "");
        if (repeatsSpeech(p.label, spoken) && repeatsSpeech(detail, spoken))
          return [];
        const d = extra(detail, 180);
        if (!d) return [];
        return [
          {
            label: p.label.length > 65 ? "Informação complementar" : p.label,
            detail: d,
          },
        ];
      });
      return summary || items.length || m.href
        ? [
            {
              ...m,
              title: m.title.length > 65 ? "Referências" : m.title,
              summary,
              items,
              body: undefined,
            },
          ]
        : [];
    }
    if (m.kind === "timeline")
      return [
        {
          ...m,
          events: m.events.map((e) => ({
            ...e,
            detail: repeatsSpeech(e.detail, spoken)
              ? ""
              : e.detail.slice(0, 160),
          })),
        },
      ];
    if (m.kind === "connections")
      return [
        {
          ...m,
          items: m.items.map((i) => ({
            ...i,
            detail: repeatsSpeech(i.detail, spoken)
              ? ""
              : i.detail.slice(0, 100),
          })),
        },
      ];
    return [m];
  });
  return modules.length
    ? { ...scene, modules, narration: spoken || scene.narration }
    : null;
}
