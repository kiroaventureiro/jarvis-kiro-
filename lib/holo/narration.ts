import type { HoloScene, HoloModule } from "./types";
import type { DemonstrationStep } from "./presentation";
export type NarrationPhase =
  | "idle"
  | "preparing"
  | "speaking"
  | "waiting"
  | "paused"
  | "error"
  | "silent"
  | "complete"
  | "cancelled";
export type NarrationState = {
  sceneId: string;
  stepId: string;
  phase: NarrationPhase;
  message: string;
};
export type NarrationSpeaker = {
  speak: (text: string, signal: AbortSignal) => Promise<void>;
  cancel: () => void;
  pause?: () => boolean;
  resume?: () => void;
};
export const NARRATION_IDLE: NarrationState = {
  sceneId: "",
  stepId: "",
  phase: "idle",
  message: "",
};
export function visualExplanation(m: HoloModule): string {
  switch (m.kind) {
    case "text":
      return m.text;
    case "map":
      return m.caption;
    case "report":
      return [m.summary, ...m.items.map((x) => x.label + ". " + x.detail)]
        .filter(Boolean)
        .join(" ");
    case "timeline":
      return m.events
        .map((x) => x.when + ". " + x.label + ". " + x.detail)
        .join(" ");
    case "compare":
      return m.columns
        .map((x) => x.label + ". " + x.points.join(". "))
        .join(" ");
    case "connections":
      return m.items.map((x) => x.label + ". " + x.detail).join(" ");
    case "metrics":
      return m.values
        .map(
          (x) =>
            x.label + ": " + x.value.toLocaleString("pt-BR") + " " + m.unit,
        )
        .join(". ");
    case "media":
      return m.items
        .map(
          (x) =>
            x.label +
            ". " +
            (x.caption || "Referência visual, consulte o crédito."),
        )
        .join(" ");
  }
}
const words = (s: string) =>
  new Set(
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]{4,}/g) || [],
  );
export function narrationScript(
  scene: HoloScene,
  plan: DemonstrationStep[],
  text: string,
) {
  const full = (
    scene.narration && scene.narration.length > text.length
      ? scene.narration
      : text
  ).trim();
  const sentences =
    typeof Intl.Segmenter === "function"
      ? [
          ...new Intl.Segmenter("pt-BR", { granularity: "sentence" }).segment(
            full,
          ),
        ]
          .map((x) => x.segment.trim())
          .filter(Boolean)
      : full.split(/(?<=[.!?])\s+(?=[\p{Lu}])/u);
  const assigned = plan.map(() => [] as string[]),
    keys = plan.map((s) =>
      words(s.content.title + " " + visualExplanation(s.content)),
    );
  for (let i = 0; i < sentences.length; i++) {
    const ws = words(sentences[i]);
    let best = -1,
      score = 0;
    keys.forEach((k, j) => {
      const overlap = [...ws].filter((w) => k.has(w)).length;
      if (overlap > score) {
        score = overlap;
        best = j;
      }
    });
    if (plan.length)
      assigned[
        best >= 0
          ? best
          : Math.min(
              plan.length - 1,
              Math.floor((i * plan.length) / Math.max(1, sentences.length)),
            )
      ].push(sentences[i]);
  }
  return plan.map((step, i) => {
    const explanation = visualExplanation(step.content),
      supplied = assigned[i].join(" "),
      normalized = supplied.toLocaleLowerCase("pt-BR");
    return {
      id: step.id,
      text: [
        step.content.title + ".",
        supplied,
        explanation &&
        !normalized.includes(explanation.toLocaleLowerCase("pt-BR"))
          ? explanation
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  });
}
type Run = {
  scene: HoloScene;
  text: string;
  signal: AbortSignal;
  speaker: NarrationSpeaker;
  resolve: () => void;
  reject: (e: Error) => void;
  abort: () => void;
  spoken: Set<string>;
  generation: number;
  silent: boolean;
  nativePaused?: boolean;
  pausedPhase?: NarrationPhase;
  timer?: ReturnType<typeof setTimeout>;
};
export class NarrationCoordinator {
  state: NarrationState = { ...NARRATION_IDLE };
  private run: Run | null = null;
  private views = new Map<
    string,
    { plan: DemonstrationStep[]; stepId: string }
  >();
  private listeners = new Set<() => void>();
  private lastOfferAt = 0;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private emit(patch: Partial<NarrationState>) {
    this.state = { ...this.state, ...patch };
    for (const f of this.listeners) f();
  }
  register(sceneId: string, plan: DemonstrationStep[], stepId: string) {
    this.views.set(sceneId, { plan, stepId });
    if (this.views.size > 8) this.views.delete(this.views.keys().next().value!);
    if (this.run?.scene.id === sceneId) this.activate(sceneId, stepId);
  }
  detach(sceneId: string) {
    this.views.delete(sceneId);
    queueMicrotask(() => {
      if (!this.views.has(sceneId)) this.cancel(sceneId);
    });
  }
  begin(
    scene: HoloScene,
    text: string,
    signal: AbortSignal,
    speaker: NarrationSpeaker,
  ): Promise<void> {
    this.cancel();
    if (signal.aborted)
      return Promise.reject(new DOMException("Cancelado", "AbortError"));
    return new Promise((resolve, reject) => {
      const abort = () => this.cancel(scene.id);
      this.run = {
        scene,
        text,
        signal,
        speaker,
        resolve,
        reject,
        abort,
        spoken: new Set(),
        generation: 0,
        silent: false,
      };
      signal.addEventListener("abort", abort, { once: true });
      this.emit({
        sceneId: scene.id,
        stepId: "",
        phase: "preparing",
        message: "",
      });
      this.run.timer = setTimeout(() => {
        if (this.run?.scene.id === scene.id && this.state.phase === "preparing")
          this.fail(
            "Não foi possível vincular a voz à demonstração. Retome a voz ou continue sem áudio.",
          );
      }, 2500);
      const view = this.views.get(scene.id);
      if (view) this.activate(scene.id, view.stepId);
    });
  }
  activate(sceneId: string, stepId: string) {
    const run = this.run,
      view = this.views.get(sceneId);
    if (!run || run.scene.id !== sceneId || !view || run.signal.aborted) return;
    if (this.state.phase === "error" || this.state.phase === "paused") return;
    if (run.silent) {
      this.emit({ stepId, phase: "silent" });
      return;
    }
    if (
      this.state.stepId === stepId &&
      ["speaking", "waiting"].includes(this.state.phase)
    )
      return;
    if (run.spoken.has(stepId)) {
      this.emit({ stepId, phase: "waiting" });
      return;
    }
    const chapter = narrationScript(run.scene, view.plan, run.text).find(
      (x) => x.id === stepId,
    );
    if (!chapter) return;
    if (run.timer) clearTimeout(run.timer);
    const generation = ++run.generation;
    this.emit({ stepId, phase: "speaking", message: "" });
    void run.speaker.speak(chapter.text, run.signal).then(
      () => {
        if (this.run !== run || run.generation !== generation) return;
        run.spoken.add(stepId);
        this.emit({ phase: "waiting" });
      },
      (e) => {
        if (this.run !== run || run.generation !== generation) return;
        this.fail(
          e instanceof Error && e.name !== "AbortError"
            ? e.message
            : "A fala foi interrompida. Retome ou continue sem áudio.",
        );
      },
    );
  }
  private fail(message: string) {
    if (this.run) this.emit({ phase: "error", message });
  }
  retry() {
    const run = this.run;
    if (!run || run.signal.aborted) return;
    run.generation++;
    run.speaker.cancel();
    const step = this.state.stepId;
    this.emit({ phase: "preparing", stepId: "" });
    this.activate(
      run.scene.id,
      step || this.views.get(run.scene.id)?.stepId || "",
    );
  }
  silence() {
    const run = this.run;
    if (!run) return;
    run.silent = true;
    run.generation++;
    run.speaker.cancel();
    this.emit({ phase: "silent", message: "Continuando sem voz." });
  }
  pause(sceneId: string) {
    const run = this.run;
    if (
      !run ||
      run.scene.id !== sceneId ||
      !["speaking", "waiting", "silent"].includes(this.state.phase)
    )
      return;
    const wasSpeaking = this.state.phase === "speaking";
    run.pausedPhase = this.state.phase;
    run.nativePaused = wasSpeaking && !!run.speaker.pause?.();
    if (wasSpeaking && !run.nativePaused) {
      run.generation++;
      run.speaker.cancel();
    }
    this.emit({ phase: "paused" });
  }
  resume(sceneId: string) {
    const run = this.run;
    if (!run || run.scene.id !== sceneId || this.state.phase !== "paused")
      return;
    if (run.nativePaused) {
      run.nativePaused = false;
      run.speaker.resume?.();
      this.emit({
        phase: run.pausedPhase === "speaking" ? "speaking" : "waiting",
      });
      return;
    }
    const id = this.state.stepId;
    this.emit({ phase: "preparing", stepId: "" });
    this.activate(sceneId, id);
  }
  finish(sceneId: string) {
    const run = this.run;
    if (
      !run ||
      run.scene.id !== sceneId ||
      !["waiting", "silent"].includes(this.state.phase)
    )
      return;
    const complete = () => {
      if (this.run !== run) return;
      this.clear(run);
      this.emit({ phase: "complete" });
      run.resolve();
    };
    if (
      !run.silent &&
      ["technical", "analysis"].includes(run.scene.mode) &&
      run.text.length > 700 &&
      Date.now() - this.lastOfferAt > 300000
    ) {
      this.lastOfferAt = Date.now();
      const generation = ++run.generation;
      this.emit({ phase: "speaking" });
      void run.speaker
        .speak(
          "Se desejar, posso preparar um PDF completo desta análise.",
          run.signal,
        )
        .then(
          () => {
            if (this.run === run && generation === run.generation) complete();
          },
          () => {
            if (this.run === run && generation === run.generation) complete();
          },
        );
    } else complete();
  }
  cancel(sceneId?: string) {
    const run = this.run;
    if (!run || (sceneId && run.scene.id !== sceneId)) return;
    run.generation++;
    this.clear(run);
    run.speaker.cancel();
    this.emit({ phase: "cancelled" });
    run.reject(new DOMException("Cancelado", "AbortError"));
  }
  private clear(run: Run) {
    if (run.timer) clearTimeout(run.timer);
    run.signal.removeEventListener("abort", run.abort);
    if (this.run === run) this.run = null;
  }
}
export const narrationCoordinator = new NarrationCoordinator();
