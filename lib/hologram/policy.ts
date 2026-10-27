import type { AssistantState } from "../jarvis-realtime";
import type { VoicePhase } from "../voice/voice-types";
export type CorePhase =
  | "idle"
  | "waiting"
  | "listening"
  | "processing"
  | "responding"
  | "error";
export type GraphicsPreference = "auto" | "eco";
export type AudioVisualMode = "representative" | "input-level" | "output-level";
export const GRAPHICS_KEY = "jarvis.graphics.v1";
export function corePhase(
  state: AssistantState,
  voice: VoicePhase,
  busy = false,
  recording = false,
): CorePhase {
  if (state === "error" || voice === "error") return "error";
  if (
    busy ||
    state === "processing" ||
    state === "connecting" ||
    voice === "processing" ||
    voice === "resuming"
  )
    return "processing";
  if (recording || state === "listening" || voice === "command")
    return "listening";
  if (state === "responding" || voice === "speaking") return "responding";
  if (voice === "waiting") return "waiting";
  return "idle";
}
let transientPreference: GraphicsPreference = "auto";
export function readGraphicsPreference(): GraphicsPreference {
  try {
    const saved = localStorage.getItem(GRAPHICS_KEY);
    return saved === "eco" || saved === "auto" ? saved : transientPreference;
  } catch {
    return transientPreference;
  }
}
export function setGraphicsPreference(value: GraphicsPreference) {
  transientPreference = value;
  try {
    localStorage.setItem(GRAPHICS_KEY, value);
  } catch {
    /* Still apply for this page. */
  }
  window.dispatchEvent(new CustomEvent("jarvis-graphics", { detail: value }));
}
export function graphicsProfile(
  preference: GraphicsPreference,
  width: number,
  dpr: number,
  cores = 8,
  memory = 8,
) {
  const low = preference === "eco" || width < 600 || cores <= 4 || memory <= 4;
  return {
    low,
    fps: low ? 24 : 40,
    dpr: Math.min(Math.max(dpr || 1, 0.5), low ? 1 : 1.5),
    particles: low ? 80 : 150,
  };
}
export function canvasSize(width: number, height: number, dpr: number) {
  const scale = Math.min(
    dpr,
    Math.sqrt(1_400_000 / Math.max(1, width * height)),
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    dpr: scale,
  };
}
export function phaseEnergy(
  phase: CorePhase,
  time: number,
  amplitude: number | null,
) {
  const wave = (Math.sin(time * 1.1) + 1) * 0.5;
  if (phase === "error") return { energy: 0.35, speed: 0.25 };
  if (phase === "processing") return { energy: 1.15, speed: 2.8 };
  if (phase === "listening")
    return {
      energy:
        0.85 +
        (amplitude === null
          ? 0.13 * wave
          : Math.min(1, Math.max(0, amplitude)) * 0.9),
      speed: 1.1,
    };
  if (phase === "responding")
    return {
      energy:
        1 +
        (amplitude === null
          ? 0.22 * (0.5 + 0.5 * Math.sin(time * 5) * Math.sin(time * 2.1))
          : Math.min(1, Math.max(0, amplitude)) * 0.85),
      speed: 1.4,
    };
  return {
    energy: (phase === "waiting" ? 1.02 : 0.9) + 0.1 * wave,
    speed: phase === "waiting" ? 0.85 : 0.55,
  };
}
/** Downshift only after sustained slow foreground frames; no React renders per frame. */
export class AdaptiveResolution {
  private slow = 0;
  private severe = 0;
  fallback = false;
  constructor(public dpr: number) {}
  observe(interval: number, target: number) {
    this.severe =
      interval > 110 && interval < 500
        ? this.severe + 1
        : Math.max(0, this.severe - 1);
    if (this.severe >= 8 && this.dpr > 0.75) {
      this.dpr = 0.75;
      this.severe = 0;
      this.slow = 0;
      return true;
    }
    if (this.severe >= 12 && this.dpr <= 0.75) this.fallback = true;
    this.slow =
      interval > target * 2.3 && interval < 500
        ? this.slow + 1
        : Math.max(0, this.slow - 1);
    if (this.slow < 24 || this.dpr <= 0.75) return false;
    this.slow = 0;
    this.dpr = Math.max(0.75, this.dpr - 0.25);
    return true;
  }
}
