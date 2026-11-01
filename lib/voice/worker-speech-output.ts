import type { SpeechOutput } from "./voice-types";
import type { HoloScene } from "../holo/types";

/**
 * Unlock Web Audio on the user's first real interaction. The VoiceStudio job
 * can take several seconds, so calling HTMLMediaElement.play() only after the
 * remote job completes may be rejected by Chrome's autoplay policy.
 */
let playbackContext: AudioContext | null = null;
let unlockInstalled = false;

function unlockPlayback() {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  try {
    playbackContext ??= new AudioContext();
    if (playbackContext.state === "suspended")
      void playbackContext.resume().catch(() => {});
  } catch {
    // The speech request will surface a clear playback error if unavailable.
  }
}

function installPlaybackUnlock() {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  for (const event of ["pointerdown", "keydown", "touchstart"] as const)
    window.addEventListener(event, unlockPlayback, { capture: true, passive: true });
}

/**
 * Speaks through the paired Windows VoiceStudio worker.
 * Requests are queued on the authenticated same-origin API; audio is polled
 * until complete and decoded into the already-unlocked browser audio context.
 */
export class WorkerSpeechOutput implements SpeechOutput {
  private source: AudioBufferSourceNode | null = null;
  private controller: AbortController | null = null;
  private active = false;
  private generation = 0;

  constructor() {
    installPlaybackUnlock();
  }

  isSpeaking() { return this.active; }

  cancel() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
    if (this.source) {
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
    }
    this.active = false;
  }

  async speak(text: string, signal: AbortSignal, _options?: { scene?: HoloScene }) {
    this.cancel();
    if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    const abort = () => { if (generation === this.generation) this.cancel(); };
    signal.addEventListener("abort", abort, { once: true });
    this.active = true;
    try {
      const queued = await fetch("/api/voice/worker", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        cache: "no-store",
        signal: controller.signal,
      });
      const job = await queued.json().catch(() => ({}));
      if (!queued.ok || typeof job.id !== "string")
        throw new Error(job.error || "Não foi possível enviar a fala ao VoiceStudio.");
      let audioBytes: ArrayBuffer | null = null;
      // Local VoiceStudio may synthesize for up to 650 seconds; leave time
      // for worker upload, status polling, and WAV delivery.
      const deadline = Date.now() + 12 * 60 * 1000;
      while (Date.now() < deadline) {
        if (controller.signal.aborted || generation !== this.generation)
          throw new DOMException("Cancelado", "AbortError");
        await new Promise<void>((resolve, reject) => {
          const finish = (error?: Error) => {
            window.clearTimeout(timer);
            controller.signal.removeEventListener("abort", onAbort);
            error ? reject(error) : resolve();
          };
          const timer = window.setTimeout(() => finish(), 2000);
          const onAbort = () =>
            finish(new DOMException("Cancelado", "AbortError"));
          if (controller.signal.aborted) onAbort();
          else controller.signal.addEventListener("abort", onAbort, { once: true });
        });
        const response = await fetch("/api/voice/worker?id=" + encodeURIComponent(job.id), {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        const type = response.headers.get("content-type") || "";
        if (response.ok && type.startsWith("audio/wav")) {
          audioBytes = await response.arrayBuffer();
          break;
        }
        const state = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(state.error || "Falha ao consultar a fala.");
        if (state.status === "failed")
          throw new Error("VoiceStudio falhou: " + (state.errorCode || "erro não identificado"));
      }
      if (!audioBytes) throw new Error("Tempo limite aguardando o VoiceStudio.");
      if (controller.signal.aborted || generation !== this.generation)
        throw new DOMException("Cancelado", "AbortError");

      // The context is primed synchronously by pointer/keyboard interaction
      // before the network round-trip, avoiding Chrome's delayed-playback block.
      unlockPlayback();
      const context = playbackContext;
      if (!context) throw new Error("Áudio do navegador indisponível.");
      if (context.state === "suspended") await context.resume();
      if (context.state !== "running")
        throw new Error("O navegador bloqueou o áudio. Clique uma vez na página e tente novamente.");
      const buffer = await context.decodeAudioData(audioBytes.slice(0));
      if (controller.signal.aborted || generation !== this.generation)
        throw new DOMException("Cancelado", "AbortError");
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      this.source = source;
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          controller.signal.removeEventListener("abort", onAbort);
          source.onended = null;
          error ? reject(error) : resolve();
        };
        const onAbort = () => finish(new DOMException("Cancelado", "AbortError"));
        controller.signal.addEventListener("abort", onAbort, { once: true });
        source.onended = () => finish();
        if (controller.signal.aborted) onAbort();
        else {
          try { source.start(0); }
          catch (error) {
            finish(error instanceof Error ? error : new Error("Falha ao iniciar o áudio oficial."));
          }
        }
      });
    } finally {
      signal.removeEventListener("abort", abort);
      if (generation === this.generation) this.cancel();
    }
  }
}
