import { planContent, type PresentationSpace } from "./content-planner";
import type { Highlight } from "./reveal";
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
  content: HoloModule;
  origin: { item: number; part: number };
  message: string;
  highlights: Highlight[];
  source: HoloScene["source"];
  minimumMs: number;
  reveal: {
    titleMs: number;
    subtitleStart?: number;
    bodyStart: number;
    completeAt: number;
  };
  completion: { readMs: number; timeoutMs: number; voiceEnd: number };
  summarized: boolean;
  metricTone: string;
  metricView?: "chart" | "observation" | "combined" | "categories";
  metricDomain?: { low: number; high: number };
};
export function presentationPlan(
  scene: HoloScene,
  space?: PresentationSpace,
): DemonstrationStep[] {
  return planContent(scene, space);
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
