import type { SpeechOutput } from "./voice-types";
import type { HoloScene } from "../holo/types";

/**
 * Speaks through the paired Windows VoiceStudio worker.
 * Requests are queued on the authenticated same-origin API; audio is polled
 * until complete and played in-browser. Abort cancels playback and polling.
 */
export class WorkerSpeechOutput implements SpeechOutput {
  private audio: HTMLAudioElement | null = null;
  private controller: AbortController | null = null;
  private objectUrl: string | null = null;
  private active = false;
  private generation = 0;

  isSpeaking() { return this.active; }

  cancel() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
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
      let blob: Blob | null = null;
      const deadline = Date.now() + 8 * 60 * 1000;
      while (Date.now() < deadline) {
        if (controller.signal.aborted || generation !== this.generation)
          throw new DOMException("Cancelado", "AbortError");
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 2000);
          const onAbort = () => {
            window.clearTimeout(timer);
            reject(new DOMException("Cancelado", "AbortError"));
          };
          controller.signal.addEventListener("abort", onAbort, { once: true });
        });
        const response = await fetch("/api/voice/worker?id=" + encodeURIComponent(job.id), {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        const type = response.headers.get("content-type") || "";
        if (response.ok && type.startsWith("audio/wav")) {
          blob = await response.blob();
          break;
        }
        const state = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(state.error || "Falha ao consultar a fala.");
        if (state.status === "failed")
          throw new Error("VoiceStudio falhou: " + (state.errorCode || "erro não identificado"));
      }
      if (!blob) throw new Error("Tempo limite aguardando o VoiceStudio.");
      if (controller.signal.aborted || generation !== this.generation)
        throw new DOMException("Cancelado", "AbortError");
      this.objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.objectUrl);
      this.audio = audio;
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          controller.signal.removeEventListener("abort", onAbort);
          error ? reject(error) : resolve();
        };
        const onAbort = () => finish(new DOMException("Cancelado", "AbortError"));
        controller.signal.addEventListener("abort", onAbort, { once: true });
        audio.onended = () => finish();
        audio.onerror = () => finish(new Error("Falha ao reproduzir o áudio oficial."));
        if (controller.signal.aborted) onAbort();
        else void audio.play().catch((error) => finish(error instanceof Error ? error : new Error("Reprodução bloqueada.")));
      });
    } finally {
      signal.removeEventListener("abort", abort);
      if (generation === this.generation) this.cancel();
    }
  }
}
