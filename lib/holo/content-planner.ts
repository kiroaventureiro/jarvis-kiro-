import type { HoloScene, HoloModule } from "./types";
import type { DemonstrationStep, Layout } from "./presentation";
import {
  chunkText,
  conciseTitle,
  revealPlan,
  semanticHighlights,
} from "./reveal";
import countries from "../../config/holo-world-index.json";
export type PresentationSpace = { width: number; height: number };
export const DEFAULT_PRESENTATION_SPACE = { width: 1000, height: 520 };
export function contentBudget(space: PresentationSpace) {
  const compact = space.width < 720,
    width = Math.max(
      180,
      compact ? space.width - 34 : Math.min(560, space.width * 0.68) - 40,
    ),
    height = Math.max(100, space.height - 150);
  const lines = Math.max(3, Math.floor(height / 29) - 2),
    chars = Math.max(18, Math.floor(width / 9));
  return {
    characters: Math.max(80, Math.min(440, lines * chars)),
    titleCharacters: Math.max(32, Math.min(65, chars * 2)),
    compact,
  };
}
export function moduleText(m: HoloModule): string {
  switch (m.kind) {
    case "report":
      return [m.summary, ...m.items.map((p) => p.label + ". " + p.detail)]
        .filter(Boolean)
        .join(" ");
    case "timeline":
      return m.events
        .map((e) => e.when + " " + e.label + ". " + e.detail)
        .join(" ");
    case "text":
      return m.text;
    case "compare":
      return m.columns
        .map((c) => c.label + ". " + c.points.join(". "))
        .join(" ");
    case "connections":
      return m.items.map((c) => c.label + ". " + c.detail).join(" ");
    case "metrics": {
      const last = m.values.at(-1);
      return (
        m.title +
        ". " +
        m.unit +
        ". " +
        (last ? last.value + " " + (last.period || last.label) : "")
      );
    }
    case "media":
      return m.items
        .map((x) => x.label + ". " + (x.caption || "Referência disponível"))
        .join(" ");
    case "map":
      return m.title + ". " + m.caption;
  }
}
export function metricTone(id: string, title: string) {
  const n = (id + " " + title).toLowerCase();
  return /selic|juros/.test(n)
    ? "violet"
    : /usd|d[oó]lar|c[aâ]mbio/.test(n)
      ? "turquoise"
      : /ipca|infla/.test(n)
        ? "amber"
        : "cyan";
}
export function contextualCountries(
  scene: HoloScene,
  m: Extract<HoloModule, { kind: "map" }>,
) {
  if (m.region !== "WORLD") return [];
  const text =
    " " +
    (scene.narration || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z ]/g, " ") +
    " ";
  const ids = [
    ...(m.focusCountry ? [m.focusCountry] : []),
    ...countries
      .filter(
        (c) =>
          c.name.length > 3 &&
          text.includes(
            " " +
              c.name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase() +
              " ",
          ),
      )
      .map((c) => c.id),
  ];
  return [...new Set(ids)];
}
export function planContent(
  scene: HoloScene,
  space: PresentationSpace = DEFAULT_PRESENTATION_SPACE,
): DemonstrationStep[] {
  const budget = contentBudget(space),
    out: DemonstrationStep[] = [];
  function add(
    original: HoloModule,
    visual: HoloModule,
    origin: number,
    part = 0,
    summary = false,
    view: "chart" | "observation" | "combined" | "categories" = "combined",
  ) {
    const text = moduleText(visual),
      title = conciseTitle(visual.title, budget.titleCharacters),
      titleMs = revealPlan(title, "title").duration;
    const subtitleText =
      visual.kind === "timeline"
        ? visual.events[0]?.when || ""
        : visual.kind === "connections"
          ? visual.items[0]?.label || ""
          : visual.kind === "compare"
            ? visual.columns.map((c) => c.label).join(" ")
            : visual.kind === "metrics"
              ? visual.unit
              : visual.kind === "map"
                ? visual.region === "BR"
                  ? "Brasil · unidades da federação"
                  : countries.find((c) => c.id === visual.focusCountry)?.name ||
                    "Contexto global"
                : "";
    const subtitleMs = revealPlan(subtitleText, "subtitle").duration,
      subtitleStart = titleMs + 180,
      bodyStart = subtitleStart + subtitleMs + 150,
      bodyMs = revealPlan(text, "body").duration;
    const visualEnd = Math.max(
      800,
      bodyStart + bodyMs,
      visual.kind === "metrics" ? 4200 : visual.kind === "map" ? 2200 : 0,
    );
    const readMs = Math.max(
      1100,
      Math.min(5000, text.split(/\s+/).length * 85),
    );
    const focus: Layout =
      visual.kind === "map" ||
      visual.kind === "metrics" ||
      visual.kind === "compare"
        ? "center"
        : visual.kind === "timeline"
          ? "right"
          : (["left", "right", "center", "bottom", "top"] as Layout[])[
              out.filter((s) => !["map", "metrics"].includes(s.content.kind))
                .length % 5
            ];
    const countryNames =
      visual.kind === "map" && visual.focusCountry
        ? [
            countries.find((c) => c.id === visual.focusCountry)?.name || "",
          ].filter(Boolean)
        : countries
            .filter(
              (c) =>
                c.name.length > 3 &&
                (
                  " " +
                  text.toLocaleLowerCase("pt-BR").replace(/[^\p{L} ]/gu, " ") +
                  " "
                ).includes(" " + c.name.toLocaleLowerCase("pt-BR") + " "),
            )
            .slice(0, 2)
            .map((c) => c.name);
    out.push({
      id: original.id + "-flow-" + origin + "-" + part,
      moduleId: original.id,
      content: { ...visual, title },
      supportId:
        visual.kind === "metrics"
          ? scene.modules.find((m) => m.kind === "map")?.id
          : undefined,
      focus,
      cue: title,
      duration: visualEnd + readMs,
      point: original.kind === "report" ? origin : undefined,
      origin: { item: origin, part },
      message: conciseTitle(text, 110),
      highlights: semanticHighlights(text + " " + title, countryNames),
      source: scene.source,
      minimumMs: visualEnd + readMs,
      reveal: {
        titleMs,
        bodyStart,
        subtitleStart,
        completeAt: visualEnd,
      },
      completion: {
        readMs,
        timeoutMs: Math.max(25000, (visualEnd + readMs) * 4),
        voiceEnd: 0,
      },
      summarized: summary,
      metricTone: metricTone(original.id, original.title),
      metricView: view,
      metricDomain:
        original.kind === "metrics"
          ? {
              low: Math.min(0, ...original.values.map((v) => v.value)),
              high: Math.max(0, ...original.values.map((v) => v.value)),
            }
          : undefined,
    });
  }
  for (const m of scene.modules) {
    if (m.kind === "report") {
      if (m.summary)
        chunkText(m.summary, budget.characters).forEach((p, i) =>
          add(
            m,
            { ...m, summary: p, items: [], body: undefined },
            -1,
            i,
            !!m.body,
          ),
        );
      const points = m.items.length
        ? m.items
        : m.body && !m.summary
          ? [{ label: m.title, detail: m.body }]
          : [];
      points.forEach((p, i) =>
        chunkText(
          (p.label ? p.label + ". " : "") + p.detail,
          budget.characters,
        ).forEach((part, n) =>
          add(
            m,
            {
              ...m,
              title: conciseTitle(p.label || m.title, budget.titleCharacters),
              summary: part,
              items: [],
              body: undefined,
            },
            i,
            n,
            !!m.body,
          ),
        ),
      );
      if (!m.summary && !points.length) add(m, { ...m, body: undefined }, 0);
    } else if (m.kind === "timeline") {
      m.events.forEach((e, i) =>
        chunkText(
          e.label + ". " + e.detail,
          Math.max(80, budget.characters - 30),
        ).forEach((part, n) =>
          add(
            m,
            {
              ...m,
              title: e.when + " · " + conciseTitle(e.label, 42),
              events: [
                { ...e, label: conciseTitle(e.label, 50), detail: part },
              ],
            },
            i,
            n,
          ),
        ),
      );
    } else if (m.kind === "text")
      chunkText(m.text, budget.characters).forEach((text, i) =>
        add(m, { ...m, text, tags: m.tags.slice(0, 2) }, i),
      );
    else if (m.kind === "connections")
      m.items.forEach((item, i) => add(m, { ...m, items: [item] }, i));
    else if (m.kind === "media")
      m.items.forEach((item, i) => add(m, { ...m, items: [item] }, i));
    else if (m.kind === "compare") {
      const rows = Math.max(...m.columns.map((c) => c.points.length));
      for (let i = 0; i < rows; i++) {
        const chunks = m.columns.map((c) =>
          chunkText(
            c.points[i] || "Sem item correspondente informado.",
            Math.max(80, Math.floor(budget.characters / 2)),
          ),
        );
        for (let p = 0; p < Math.max(...chunks.map((x) => x.length)); p++)
          add(
            m,
            {
              ...m,
              columns: m.columns.map((c, j) => ({
                ...c,
                points: [chunks[j][p] || "Sem complemento informado."],
              })),
            },
            i,
            p,
          );
      }
    } else if (m.kind === "map") {
      const focuses = contextualCountries(scene, m);
      if (focuses.length)
        focuses.forEach((id, i) =>
          add(
            m,
            {
              ...m,
              focusCountry: id,
              caption: conciseTitle(
                m.caption,
                Math.min(160, budget.characters),
              ),
            },
            i,
            0,
            m.caption.length > budget.characters,
          ),
        );
      else
        add(
          m,
          {
            ...m,
            caption: conciseTitle(m.caption, Math.min(160, budget.characters)),
          },
          0,
          0,
          m.caption.length > budget.characters,
        );
    } else if (m.kind === "metrics" && m.style !== "line") {
      if (m.style === "radar") add(m, m, -1, 0, false, "chart");
      const count = space.width < 720 || space.height < 480 ? 1 : 3;
      for (let i = 0; i < m.values.length; i += count)
        add(
          m,
          { ...m, values: m.values.slice(i, i + count) },
          i,
          0,
          false,
          "categories",
        );
    } else if (
      m.kind === "metrics" &&
      (space.width < 720 || space.height < 480)
    ) {
      add(m, { ...m, title: m.title + " · evolução" }, 0, 0, false, "chart");
      add(
        m,
        { ...m, title: m.title + " · leitura atual" },
        1,
        0,
        false,
        "observation",
      );
    } else add(m, m, 0);
  }
  const total = out.reduce((sum, s) => sum + s.duration, 0) || 1;
  let prior = 0;
  out.forEach((step, i) => {
    prior += step.duration / total;
    step.completion.voiceEnd = i === out.length - 1 ? 1 : prior;
  });
  return out;
}
export type CompletionEvidence = {
  written: boolean;
  seen: boolean;
  elapsed: number;
  readingSince: number | null;
  voiceFraction: number;
  voiceFresh: boolean;
  voiceEnded: boolean;
};
export function mayComplete(step: DemonstrationStep, e: CompletionEvidence) {
  return (
    e.written &&
    e.seen &&
    e.elapsed >= step.minimumMs &&
    e.readingSince !== null &&
    e.elapsed - e.readingSince >= step.completion.readMs &&
    (!e.voiceFresh ||
      e.voiceEnded ||
      e.voiceFraction >= step.completion.voiceEnd)
  );
}
