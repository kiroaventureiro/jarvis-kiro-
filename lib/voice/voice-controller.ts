import type {
  RecognitionConstructor,
  RecognitionDriver,
  SpeechOutput,
  VoicePhase,
  VoiceReply,
} from "./voice-types";
import {
  parseWake,
  CommandDeduplicator,
  localVoiceReply,
} from "./wake-word-policy";
export type VoiceSnapshot = {
  phase: VoicePhase;
  enabled: boolean;
  microphoneActive: boolean;
  message: string;
};
type Options = {
  recognition: RecognitionConstructor | null;
  speech: SpeechOutput;
  continuous: () => boolean;
  muted: () => boolean;
  command: (text: string, signal: AbortSignal) => Promise<VoiceReply>;
  onUser: (text: string) => void;
  onReply: (reply: VoiceReply) => VoiceReply | void;
  onSpeechUnavailable?: () => void;
  onState: (state: VoiceSnapshot) => void;
  navigate?: (path: string) => void;
  now?: () => number;
  delay?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear?: (timer: ReturnType<typeof setTimeout>) => void;
};
const fatal = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "language-not-supported",
  "bad-grammar",
]);
export class VoiceController {
  private skipSpeech = false;
  private speechPending = false;
  private enabled = false;
  private busy = false;
  private rec: RecognitionDriver | null = null;
  private abort: AbortController | null = null;
  private epoch = 0;
  private retries = 0;
  private starts: number[] = [];
  private armedUntil = 0;
  private phase: VoicePhase = "off";
  private mic = false;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private dedupe = new CommandDeduplicator();
  constructor(private options: Options) {}
  private now() {
    return (this.options.now || Date.now)();
  }
  private emit(phase: VoicePhase, message: string) {
    this.phase = phase;
    this.options.onState({
      phase,
      enabled: this.enabled,
      microphoneActive: this.mic,
      message,
    });
  }
  private later(callback: () => void, ms: number) {
    const epoch = this.epoch;
    const timer = (this.options.delay || setTimeout)(() => {
      this.timers.delete(timer);
      if (epoch === this.epoch) callback();
    }, ms);
    this.timers.add(timer);
  }
  private clearTimers() {
    for (const timer of this.timers)
      (this.options.clear || clearTimeout)(timer);
    this.timers.clear();
  }
  private pause() {
    const rec = this.rec;
    this.rec = null;
    this.mic = false;
    if (rec) {
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      rec.onstart = null;
      rec.onspeechstart = null;
      try {
        rec.abort ? rec.abort() : rec.stop();
      } catch {}
    }
  }
  audioMuted() {
    if (this.phase === "speaking") {
      this.skipSpeech = true;
      this.options.speech.cancel();
    }
  }
  start() {
    if (this.enabled) return;
    if (!this.options.recognition) {
      this.emit(
        "error",
        "Reconhecimento de fala indisponível. Use o teclado ou a sessão de voz manual.",
      );
      return;
    }
    this.epoch++;
    this.enabled = true;
    this.busy = false;
    this.retries = 0;
    this.starts = [];
    this.armedUntil = 0;
    this.dedupe = new CommandDeduplicator();
    this.listen();
  }
  stop(message = "Escuta desligada.") {
    if (this.speechPending) this.options.onSpeechUnavailable?.();
    this.speechPending = false;
    this.enabled = false;
    this.epoch++;
    this.clearTimers();
    this.abort?.abort();
    this.abort = null;
    this.busy = false;
    this.pause();
    this.options.speech.cancel();
    this.emit("off", message);
  }
  private fail(message: string) {
    this.stop(message);
    this.emit("error", message);
  }
  private listen() {
    if (!this.enabled || this.busy || this.rec) return;
    this.starts = this.starts.filter((at) => this.now() - at < 60000);
    if (this.starts.length >= 10) {
      this.fail(
        "O navegador encerrou a escuta repetidamente. Reative quando estiver pronto.",
      );
      return;
    }
    this.starts.push(this.now());
    const Constructor = this.options.recognition;
    if (!Constructor) return;
    let rec: RecognitionDriver;
    try {
      rec = new Constructor();
    } catch {
      this.fail(
        "O navegador não conseguiu preparar o reconhecimento. Use o teclado e tente novamente.",
      );
      return;
    }
    this.rec = rec;
    rec.lang = "pt-BR";
    rec.continuous = this.options.continuous();
    rec.interimResults = false;
    rec.onstart = () => {
      if (this.rec !== rec || !this.enabled) return;
      this.mic = true;
      this.emit(
        this.now() < this.armedUntil ? "command" : "waiting",
        this.now() < this.armedUntil
          ? "Pode dizer o próximo comando."
          : "Microfone ativo · aguardando Jarvis.",
      );
    };
    rec.onspeechstart = () => {
      if (this.rec === rec && this.enabled && !this.busy)
        this.emit("command", "Ouvindo…");
    };
    rec.onresult = (event) => {
      if (this.rec !== rec || !this.enabled || this.busy) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const text = result[0]?.transcript?.trim() || "";
        if (!text) continue;
        this.retries = 0;
        const parsed = parseWake(text, this.now() < this.armedUntil);
        if (!parsed.accepted) {
          this.emit("waiting", "Microfone ativo · aguardando Jarvis.");
          continue;
        }
        if (!this.dedupe.accept(parsed.command, this.now())) continue;
        this.armedUntil = this.now() + 60000;
        void this.run(parsed.command);
        break;
      }
    };
    rec.onerror = (event) => {
      if (this.rec !== rec || !this.enabled) return;
      if (fatal.has(event.error)) {
        this.fail(
          event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "Permissão de microfone negada. Libere o acesso no navegador e reative a escuta."
            : "Microfone ou idioma indisponível. Use texto e confira as configurações.",
        );
        return;
      }
      this.recover(
        event.error === "network"
          ? "Falha de rede no reconhecimento."
          : "O reconhecimento foi interrompido.",
      );
    };
    rec.onend = () => {
      if (this.rec !== rec || !this.enabled || this.busy) return;
      if (!this.options.continuous()) {
        this.stop("Escuta manual encerrada. Toque para tentar novamente.");
        return;
      }
      this.recover("O navegador encerrou o reconhecimento.");
    };
    this.emit("resuming", "Iniciando reconhecimento…");
    try {
      rec.start();
    } catch {
      this.fail(
        "Não foi possível iniciar o reconhecimento. Reative a escuta para tentar novamente.",
      );
    }
  }
  private recover(message: string) {
    this.pause();
    this.retries++;
    if (this.retries > 3) {
      this.fail(message + " As tentativas automáticas foram encerradas.");
      return;
    }
    this.emit("resuming", message + " Retomando (" + this.retries + "/3)…");
    this.later(() => this.listen(), Math.min(1000 * this.retries, 3000));
  }
  private async run(command: string) {
    if (this.busy || !this.enabled) return;
    this.busy = true;
    this.clearTimers();
    this.pause();
    const epoch = this.epoch,
      abort = new AbortController();
    this.abort = abort;
    this.emit("processing", "Processando comando…");
    this.options.onUser(command);
    try {
      const local = localVoiceReply(command);
      const reply: VoiceReply = local
        ? { ...local, provider: "local" }
        : await this.options.command(command, abort.signal);
      if (epoch !== this.epoch || !this.enabled) return;
      const candidate = this.options.onReply(reply);
      const prepared =
        candidate &&
        typeof candidate === "object" &&
        typeof candidate.text === "string"
          ? candidate
          : reply;
      if (!this.options.muted()) {
        this.emit("speaking", "Jarvis respondendo · reconhecimento pausado.");
        this.skipSpeech = false;
        this.speechPending = true;
        try {
          await this.options.speech.speak(prepared.text, abort.signal, {
            scene: prepared.visual,
          });
        } catch (error) {
          const stopped =
            error instanceof DOMException && error.name === "AbortError";
          if (epoch === this.epoch && !stopped)
            this.options.onSpeechUnavailable?.();
          if (!this.skipSpeech && !stopped) throw error;
        } finally {
          if (epoch === this.epoch) this.speechPending = false;
        }
      } else {
        this.options.onSpeechUnavailable?.();
      }
      if (epoch !== this.epoch || !this.enabled) return;
      this.busy = false;
      this.abort = null;
      if (reply.navigate) {
        this.stop();
        this.options.navigate?.(reply.navigate);
        return;
      }
      if (!this.options.continuous()) {
        this.stop("Interação concluída. Toque para ouvir novamente.");
        return;
      }
      this.armedUntil = this.now() + 60000;
      this.emit("resuming", "Retomando a escuta…");
      this.later(() => {
        this.listen();
        this.later(() => {
          if (this.enabled && !this.busy && this.now() >= this.armedUntil)
            this.emit("waiting", "Microfone ativo · aguardando Jarvis.");
        }, 60000);
      }, 450);
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.fail(
        error instanceof Error
          ? error.message
          : "Não foi possível responder. Reative a escuta para tentar novamente.",
      );
    }
  }
}
