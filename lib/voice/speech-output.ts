import { spokenExplanation } from "../cognitive/narration";
import { narrationCoordinator } from "../holo/narration";
import type { HoloScene } from "../holo/types";
import { emitSpeechProgress } from "../holo/speech-progress";
import type { SpeechOutput, VoicePreferences } from "./voice-types";
import { readVoicePreferences, selectVoice } from "./voice-preferences";
export interface SpeechAdapter {
  getVoices(): SpeechSynthesisVoice[];
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  pause?(): void;
  resume?(): void;
  addEventListener?(type: string, listener: EventListener): void;
  removeEventListener?(type: string, listener: EventListener): void;
}
export function speechChunks(text: string) {
  const clean = spokenExplanation(text)
    .replace(/https?:\/\/\S+/g, "link disponível na tela")
    .replace(/[\*#_`]/g, "")
    .trim();
  const sentences =
    typeof Intl.Segmenter === "function"
      ? [
          ...new Intl.Segmenter("pt-BR", { granularity: "sentence" }).segment(
            clean,
          ),
        ].map((x) => x.segment)
      : clean.split(/(?<=[.!?])\s+/u);
  const chunks: string[] = [];
  let pending = "";
  for (const sentence of sentences) {
    if (pending.length + sentence.length <= 640) {
      pending += sentence;
      continue;
    }
    if (pending.trim()) chunks.push(pending.trim());
    pending = "";
    if (sentence.length <= 640) {
      pending = sentence;
      continue;
    }
    for (const unit of sentence.match(/\S+\s*|\s+/gu) || []) {
      if (pending.length + unit.length > 640 && pending) {
        chunks.push(pending.trim());
        pending = "";
      }
      pending += unit;
    }
  }
  if (pending.trim()) chunks.push(pending.trim());
  return chunks;
}
export class BrowserSpeechOutput implements SpeechOutput {
  private serial = 0;
  private cancelCurrent: (() => void) | null = null;
  constructor(
    private adapter: () => SpeechAdapter | null,
    private create: (text: string) => SpeechSynthesisUtterance,
    private preferences: () => VoicePreferences = readVoicePreferences,
  ) {}
  cancel() {
    narrationCoordinator.cancel();
    this.cancelAudio();
  }
  private cancelAudio() {
    this.serial++;
    this.cancelCurrent?.();
    this.cancelCurrent = null;
    this.adapter()?.cancel();
  }
  async speak(
    text: string,
    signal: AbortSignal,
    options?: { scene?: HoloScene },
  ) {
    this.cancel();
    if (options?.scene)
      return narrationCoordinator.begin(options.scene, text, signal, {
        speak: (segment, abort) => this.speakText(segment, abort),
        cancel: () => this.cancelAudio(),
        pause: () => {
          const api = this.adapter();
          if (!api?.pause) return false;
          api.pause();
          return true;
        },
        resume: () => this.adapter()?.resume?.(),
      });
    return this.speakText(text, signal);
  }
  private async speakText(text: string, signal: AbortSignal) {
    this.cancelAudio();
    const serial = this.serial;
    const api = this.adapter();
    if (!api)
      throw new Error(
        "Síntese de voz indisponível. A resposta continua no HUD.",
      );
    const prefs = this.preferences();
    if (!api.getVoices().length && !signal.aborted) {
      await new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const done = () => {
          clearTimeout(timer);
          api.removeEventListener?.("voiceschanged", done);
          signal.removeEventListener("abort", done);
          resolve();
        };
        timer = setTimeout(done, 800);
        api.addEventListener?.("voiceschanged", done);
        signal.addEventListener("abort", done, { once: true });
      });
    }
    if (signal.aborted || serial !== this.serial)
      throw new DOMException("Cancelado", "AbortError");
    const voice = selectVoice(api.getVoices(), prefs);
    if (!voice)
      throw new Error(
        "Nenhuma voz pt-BR disponível. Selecione uma voz nas configurações.",
      );
    if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
    const parts = speechChunks(text);
    const textLength = parts.reduce((n, p) => n + p.length + 1, 0);
    let charOffset = 0;
    if (!parts.length) return;
    await new Promise<void>((resolve, reject) => {
      let index = 0,
        finished = false;
      let utterance: SpeechSynthesisUtterance | null = null;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        if (timeout) clearTimeout(timeout);
        signal.removeEventListener("abort", cancel);
        if (utterance) {
          utterance.onend = null;
          utterance.onerror = null;
          utterance.onstart = null;
          utterance.onboundary = null;
        }
        this.cancelCurrent = null;
        emitSpeechProgress({
          phase: error
            ? signal.aborted || error.name === "AbortError"
              ? "cancel"
              : "error"
            : "end",
          fraction: error ? Math.min(1, charOffset / textLength) : 1,
          textLength,
          charIndex: error ? charOffset : textLength,
        });
        error ? reject(error) : resolve();
      };
      const cancel = () => {
        finish(new DOMException("Cancelado", "AbortError"));
        api.cancel();
      };
      this.cancelCurrent = cancel;
      signal.addEventListener("abort", cancel, { once: true });
      const next = () => {
        if (finished) return;
        if (signal.aborted) {
          cancel();
          return;
        }
        if (index >= parts.length) {
          finish();
          return;
        }
        utterance = this.create(parts[index++]);
        const offset = charOffset;
        utterance.onstart = () =>
          emitSpeechProgress({
            phase: "start",
            fraction: Math.min(1, offset / textLength),
            textLength,
            charIndex: offset,
          });
        utterance.onboundary = (event) => {
          const position = Math.min(
            textLength,
            offset + Math.max(0, event.charIndex),
          );
          emitSpeechProgress({
            phase: "boundary",
            fraction: position / textLength,
            textLength,
            charIndex: position,
          });
        };
        utterance.lang = "pt-BR";
        utterance.voice = voice;
        utterance.rate = prefs.rate;
        utterance.pitch = prefs.pitch;
        utterance.volume = prefs.volume;
        utterance.onend = () => {
          if (timeout) clearTimeout(timeout);
          charOffset += parts[index - 1].length + 1;
          next();
        };
        utterance.onerror = () =>
          finish(
            new Error(
              "A reprodução de voz falhou. A resposta está no HUD; reative a escuta quando desejar.",
            ),
          );
        timeout = setTimeout(
          () => {
            finish(
              new Error(
                "A voz não concluiu a reprodução. Reative a escuta para tentar novamente.",
              ),
            );
            api.cancel();
          },
          Math.max(
            30000,
            Math.min(90000, (utterance.text.length * 130) / prefs.rate),
          ),
        );
        try {
          api.speak(utterance);
        } catch {
          finish(
            new Error(
              "O navegador bloqueou a fala. Use a prévia nas configurações para verificar a voz.",
            ),
          );
        }
      };
      next();
    });
  }
}
let manager: BrowserSpeechOutput | null = null;
export function getVoiceManager() {
  if (!manager)
    manager = new BrowserSpeechOutput(
      () =>
        typeof window !== "undefined" && "speechSynthesis" in window
          ? window.speechSynthesis
          : null,
      (text) => new SpeechSynthesisUtterance(text),
    );
  return manager;
}
