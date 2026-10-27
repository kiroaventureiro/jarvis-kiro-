import type { HoloScene, HoloModule } from "./types";
export type Layout = "left" | "right" | "top" | "bottom" | "center";
export type DemonstrationStep = {
  id: string;
  moduleId: string;
  supportId?: string;
  focus: Layout;
  cue: string;
  duration: number;
  point?: number;
};
export function presentationPlan(scene: HoloScene): DemonstrationStep[] {
  const out: DemonstrationStep[] = [];
  const modules = scene.modules;
  for (const m of modules) {
    if (m.kind === "report" && modules.length === 1 && m.items.length > 1) {
      for (const [i, p] of m.items.slice(0, 4).entries())
        out.push({
          id: m.id + "-" + i,
          moduleId: m.id,
          focus: (["left", "right", "center", "bottom"] as Layout[])[i % 4],
          cue: p.label,
          duration: Math.max(
            5500,
            Math.min(11000, (p.label + p.detail).length * 42),
          ),
          point: i,
        });
    } else
      out.push({
        id: m.id,
        moduleId: m.id,
        supportId:
          m.kind === "metrics"
            ? modules.find((x) => x.kind === "map")?.id
            : undefined,
        focus:
          m.kind === "map" || m.kind === "metrics" || m.kind === "compare"
            ? "center"
            : m.kind === "timeline"
              ? "right"
              : out.length % 2
                ? "right"
                : "left",
        cue: m.title,
        duration:
          m.kind === "map"
            ? 8500
            : m.kind === "metrics"
              ? 10000
              : m.kind === "timeline"
                ? 11000
                : 7500,
      });
  }
  const report = modules.find((m) => m.kind === "report");
  if (report && (out.length > 1 || out[0]?.point !== undefined))
    out.push({
      id: "conclusion",
      moduleId: report.id,
      focus: "center",
      cue: "Síntese e relatório completo",
      duration: 8000,
    });
  return out.slice(0, 12);
}
export function planDuration(plan: DemonstrationStep[]) {
  return plan.reduce((s, x) => s + x.duration, 0);
}
export function stepAt(plan: DemonstrationStep[], elapsed: number) {
  let start = 0;
  for (let i = 0; i < plan.length; i++) {
    const end = start + plan[i].duration;
    if (elapsed < end || i === plan.length - 1)
      return {
        index: i,
        start,
        progress: Math.max(
          0,
          Math.min(1, (elapsed - start) / plan[i].duration),
        ),
        finished: elapsed >= end && i === plan.length - 1,
      };
    start = end;
  }
  return { index: 0, start: 0, progress: 0, finished: true };
}
export function narrationText(scene: HoloScene) {
  return (
    scene.narration ||
    scene.modules
      .filter(
        (m): m is Extract<HoloModule, { kind: "report" }> =>
          m.kind === "report",
      )
      .map(
        (m) =>
          m.body ||
          [m.summary, ...m.items.map((x) => x.label + ". " + x.detail)].join(
            " ",
          ),
      )
      .join(" ") ||
    scene.title
  );
}
export function chartRange(values: number[]) {
  const low = Math.min(0, ...values),
    high = Math.max(0, ...values);
  return { low, high: high === low ? low + 1 : high };
}
export function chartPosition(value: number, low: number, high: number) {
  return (value - low) / (high - low || 1);
}
export function googleMapsUrl(query: string) {
  const u = new URL("https://www.google.com/maps/search/");
  u.searchParams.set("api", "1");
  u.searchParams.set("query", query.slice(0, 200));
  return u.href;
}
