import type { SpeechOutput } from "./voice-types";

/**
 * Pluggable neural audio playback. Calls only a same-origin, authenticated
 * endpoint; the server owns the provider credentials and cost controls.
 * This adapter is inert until explicitly selected by the user.
 */
export class NeuralSpeechOutput implements SpeechOutput {
  private audio: HTMLAudioElement | null = null;
  private controller: AbortController | null = null;
  private objectUrl: string | null = null;
  private active = false;
  private generation = 0;

  constructor(
    private endpoint: string,
    private fallback: SpeechOutput,
  ) {
    if (!endpoint.startsWith("/") || endpoint.startsWith("//"))
      throw new Error("Neural voice endpoint must be same-origin");
  }

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
    this.fallback.cancel();
    this.active = false;
  }

  async speak(text: string, signal: AbortSignal) {
    this.cancel();
    if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
    this.active = true;
    const generation = this.generation;
    const controller = new AbortController();
    let playbackStarted = false;
    this.controller = controller;
    const abort = () => this.cancel();
    signal.addEventListener("abort", abort, { once: true });
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Neural voice not available");
      const type = response.headers.get("content-type") || "";
      if (!type.startsWith("audio/")) throw new Error("Invalid voice response");
      const bytes = await response.blob();
      if (signal.aborted || controller.signal.aborted || generation !== this.generation)
        throw new DOMException("Cancelado", "AbortError");
      this.objectUrl = URL.createObjectURL(bytes);
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
        audio.onerror = () => finish(new Error("Audio playback failed"));
        if (controller.signal.aborted) onAbort();
        else void audio.play().then(() => { playbackStarted = true; }).catch(error => finish(error));
      });
    } catch (error) {
      if (signal.aborted || controller.signal.aborted || generation !== this.generation)
        throw new DOMException("Cancelado", "AbortError");
      // Do not repeat an answer if neural audio may already have been heard.
      // Browser fallback is safe only before successful neural playback.
      if (playbackStarted) throw error;
      await this.fallback.speak(text, signal);
    } finally {
      signal.removeEventListener("abort", abort);
      if (generation === this.generation) this.cancel();
    }
  }
}
