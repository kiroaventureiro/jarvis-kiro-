import { emitSpeechProgress } from "../holo/speech-progress";
import type { SpeechOutput, VoicePreferences } from "./voice-types";
import { readVoicePreferences, selectVoice } from "./voice-preferences";
export interface SpeechAdapter {
  getVoices(): SpeechSynthesisVoice[];
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  addEventListener?(type: string, listener: EventListener): void;
  removeEventListener?(type: string, listener: EventListener): void;
}
export function speechChunks(text: string) {
  const clean = text
    .replace(/https?:\/\/\S+/g, "link disponível na tela")
    .replace(/[\*#_`]/g, "")
    .trim();
  const chunks: string[] = [];
  let rest = clean.slice(0, 12000);
  while (rest) {
    let length = Math.min(240, rest.length);
    if (length < rest.length) {
      const boundary = rest.lastIndexOf(" ", length);
      if (boundary > 100) length = boundary;
    }
    chunks.push(rest.slice(0, length));
    rest = rest.slice(length).trim();
  }
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
    this.serial++;
    this.cancelCurrent?.();
    this.cancelCurrent = null;
    this.adapter()?.cancel();
  }
  async speak(text: string, signal: AbortSignal) {
    this.cancel();
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
          phase: error ? (signal.aborted ? "cancel" : "error") : "end",
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
        timeout = setTimeout(() => {
          finish(
            new Error(
              "A voz não concluiu a reprodução. Reative a escuta para tentar novamente.",
            ),
          );
          api.cancel();
        }, 30000);
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
