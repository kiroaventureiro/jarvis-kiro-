import type { DemonstrationStep } from "./presentation";
import { mayComplete } from "./content-planner";
export type FlowEvidence = {
  stepId: string;
  written: boolean;
  seen: boolean;
  unseenPixels: number;
  visibleHeight?: number;
};
export type VoiceEvidence = {
  fraction: number;
  fresh: boolean;
  ended: boolean;
};
export type DirectorState = {
  index: number;
  elapsed: number;
  status: "playing" | "paused" | "complete" | "blocked";
  issue: string;
  readingSince: number | null;
};
export class HoloDirector {
  state: DirectorState = {
    index: 0,
    elapsed: 0,
    status: "playing",
    issue: "",
    readingSince: null,
  };
  constructor(public plan: DemonstrationStep[]) {}
  replacePlan(plan: DemonstrationStep[]) {
    const old = this.plan[this.state.index];
    let index = old ? plan.findIndex((s) => s.id === old.id) : -1;
    if (index < 0 && old)
      index = plan.findIndex(
        (s) => s.moduleId === old.moduleId && s.origin.item === old.origin.item,
      );
    if (index < 0) index = 0;
    const same = old?.id === plan[index]?.id;
    this.plan = plan;
    this.state = {
      ...this.state,
      index,
      elapsed: same ? this.state.elapsed : 0,
      readingSince: null,
    };
  }
  tick(
    delta: number,
    flow: FlowEvidence | undefined,
    voice: VoiceEvidence,
    speed = 1,
    visible = true,
  ) {
    if (this.state.status !== "playing" || !visible || !this.plan.length)
      return this.state;
    const step = this.plan[this.state.index],
      elapsed = this.state.elapsed + Math.max(0, Math.min(300, delta)) * speed,
      ready = flow?.stepId === step.id && flow.written && flow.seen;
    if (
      flow?.stepId === step.id &&
      flow.visibleHeight !== undefined &&
      flow.visibleHeight < 48 &&
      elapsed > 1500
    ) {
      this.state = {
        ...this.state,
        elapsed,
        status: "blocked",
        issue:
          "Amplie a área da demonstração ou use Explorar quadros para ler este conteúdo.",
      };
      return this.state;
    }
    const readingSince = ready ? (this.state.readingSince ?? elapsed) : null;
    if (
      mayComplete(step, {
        written: !!flow?.written && flow.stepId === step.id,
        seen: !!flow?.seen && flow.stepId === step.id,
        elapsed,
        readingSince,
        voiceFraction: voice.fraction,
        voiceFresh: voice.fresh,
        voiceEnded: voice.ended,
      })
    ) {
      this.state =
        this.state.index === this.plan.length - 1
          ? { ...this.state, elapsed, status: "complete", readingSince }
          : {
              index: this.state.index + 1,
              elapsed: 0,
              status: "playing",
              issue: "",
              readingSince: null,
            };
      return this.state;
    }
    // A safety limit pauses instead of silently discarding hidden essential content.
    if (
      elapsed >= step.completion.timeoutMs &&
      (!voice.fresh ||
        voice.ended ||
        voice.fraction >= step.completion.voiceEnd)
    ) {
      this.state = {
        ...this.state,
        elapsed,
        status: "blocked",
        readingSince,
        issue:
          "A apresentação foi pausada para preservar este conteúdo. Retome ou explore o quadro.",
      };
      return this.state;
    }
    this.state = { ...this.state, elapsed, readingSince };
    return this.state;
  }
  pause() {
    if (this.state.status === "playing")
      this.state = { ...this.state, status: "paused" };
  }
  resume() {
    if (this.state.status === "complete") return;
    const elapsed =
      this.state.status === "blocked"
        ? Math.min(this.state.elapsed, this.plan[this.state.index].minimumMs)
        : this.state.elapsed;
    this.state = { ...this.state, elapsed, status: "playing", issue: "" };
  }
  replay() {
    this.state = {
      index: 0,
      elapsed: 0,
      status: "playing",
      issue: "",
      readingSince: null,
    };
  }
  jump(index: number) {
    this.state = {
      index: Math.min(this.plan.length - 1, Math.max(0, index)),
      elapsed: 0,
      status: "paused",
      issue: "",
      readingSince: null,
    };
  }
}
