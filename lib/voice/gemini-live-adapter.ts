import { GoogleGenAI, type LiveServerMessage, type Session, type FunctionCall } from "@google/genai";
import { GeminiAudio } from "./gemini-audio";
import { GEMINI_JARVIS_TOOL } from "./gemini-config";
import type { VoiceSnapshot } from "./voice-controller";
import type { VoiceReply } from "./voice-types";
type Options = {
  command: (text: string, signal: AbortSignal) => Promise<VoiceReply>;
  onUser: (text: string) => void;
  onReply: (reply: VoiceReply) => VoiceReply | void;
  onState: (state: VoiceSnapshot) => void;
  onSpeechUnavailable: () => void;
  onSpeechAvailable?: () => void;
  volume: () => number;
  desktopAudioAllowed: () => boolean;
  navigate: (path: string) => void;
};
/** The only callable tool has NO arguments. Model-generated instructions cannot become an action. */
export class GeminiLiveVoiceAdapter {
  private session: Session | null = null;
  private audio = new GeminiAudio();
  private enabled = false;
  private epoch = 0;
  private connection = 0;
  private handle: string | undefined;
  // Stable for this adapter instance; reconnects reuse the same hourly admission.
  private readonly clientSessionId = crypto.randomUUID();
  private attempts = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private abort: AbortController | null = null;
  private provisioning: AbortController | null = null;
  private transcript = "";
  private transcriptReady = false;
  private pending: FunctionCall | null = null;
  private seen = new Set<string>();
  private outputAllowed = false;
  private ready = false;
  private audioStarted = false;
  private playing = false;
  private inputChunks = 0;
  private outputChunks = 0;
  private aec = false;
  private echoFrames = 0;
  private usedTurn = false;
  constructor(private options: Options) {
    this.audio.onEchoEvidence = (frames, aec) => { this.echoFrames = frames; this.aec = aec; };
    this.audio.onMicrophoneEnded = () => this.fail("O microfone foi desconectado. Reative a sessão.");
    this.audio.onDrained = () => { this.playing = false; if (this.enabled) this.emit("waiting", "Gemini Live ativo · entrada PCM16 / saída PCM24 · TTS bloqueado"); };
  }
  private emit(phase: VoiceSnapshot["phase"], message: string) {
    this.options.onState({ phase, message, enabled: this.enabled, microphoneActive: this.enabled && this.ready });
  }
  private later(fn: () => void, ms: number) {
    const timer = setTimeout(() => { this.timers.delete(timer); fn(); }, ms);
    this.timers.add(timer);
  }
  private clearTimers() { for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); }
  start() {
    if (this.enabled) return;
    if (!this.options.desktopAudioAllowed()) { this.fail("Esta experiência de áudio está disponível somente no computador. Use o teclado neste aparelho."); return; }
    this.enabled = true; this.attempts = 0;
    ++this.epoch;
    this.emit("resuming", "Gemini Live selecionado · verificando endpoint…");
    void this.connect();
  }
  private async connect() {
    const connection = ++this.connection;
    this.ready = false;
    this.provisioning = new AbortController();
    this.later(() => {
      if (this.enabled && connection === this.connection && !this.ready)
        this.fail("Tempo de conexão esgotado. Reative a sessão.");
    }, 20000);
    try {
      const response = await fetch("/api/voice/gemini-token", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: this.handle, clientSessionId: this.clientSessionId }), signal: this.provisioning.signal,
      });
      const token = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = typeof token.code === "string" && /^[A-Z0-9_]{1,60}$/.test(token.code) ? token.code : "ENDPOINT_ERROR";
        // Server owns this allowlisted/sanitized message, never raw Google/WS payloads.
        const known: Record<string, string> = {
          AUTH_REQUIRED: "Entre na área privada.", ORIGIN_DENIED: "Origem não autorizada.", PRODUCTION_BLOCKED: "Experimento bloqueado em produção.",
          LIVE_DISABLED: "JARVIS_GEMINI_LIVE_ENABLED ausente ou desativado.", KEY_MISSING: "GEMINI_API_KEY indisponível no deployment.",
          COST_NOT_APPROVED: "JARVIS_GEMINI_LIVE_PAID_ALLOWED ausente ou sem aprovação.", SESSION_BUDGET_INVALID: "Limite JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR inválido.",
          PERSISTENT_LIMIT_UNAVAILABLE: "Limite persistente indisponível.", SESSION_LIMIT: "Limite de sessões atingido.",
        };
        throw new Error(`Gemini Live · HTTP ${response.status} · ${code} · ${known[code] || "Falha ao preparar sessão; consulte o diagnóstico do servidor."} TTS alternativo bloqueado.`);
      }
      if (!this.enabled || connection !== this.connection) return;
      if (!token.token || Date.parse(token.newSessionExpiresAt) <= Date.now()) throw new Error("Credencial temporária expirada. Reative a sessão.");
      if (!this.audioStarted) {
        await this.audio.start(data => {
          if (!this.enabled || !this.ready) return;
          try { this.session?.sendRealtimeInput({ audio: { data, mimeType: "audio/pcm;rate=16000" } }); this.inputChunks++; }
          catch { this.reconnect(); }
        }).catch(() => { throw new Error("Gemini Live · microfone/AudioWorklet indisponível. Verifique permissões e use Chrome/Edge no computador."); });
        if (!this.enabled || connection !== this.connection) { this.audio.close(); return; }
        this.audioStarted = true;
      }
      const ai = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: "v1beta" } });
      const session = await ai.live.connect({
        model: token.model,
        config: { sessionResumption: this.handle ? { handle: this.handle } : {} },
        callbacks: {
          onmessage: message => { if (this.enabled && connection === this.connection) this.message(message); },
          onerror: () => { if (connection === this.connection) this.reconnect(); },
          onclose: () => { if (this.enabled && connection === this.connection) this.reconnect(); },
        },
      }).catch(() => { throw new Error("Gemini Live · falha no WebSocket Google. Verifique modelo, quota e token; TTS alternativo bloqueado."); });
      if (!this.enabled || connection !== this.connection) { session.close(); return; }
      this.session = session; this.ready = true;
      this.updateVolume(); this.emit("waiting", "Gemini Live ativo · entrada PCM16 / saída PCM24 · TTS bloqueado");
      this.later(() => { this.attempts = 0; }, 30000);
      this.later(() => this.reconnect(), Math.max(1000, Date.parse(token.expiresAt) - Date.now() - 30000));
    } catch (error) {
      if (this.enabled && connection === this.connection)
        this.fail(error instanceof Error ? error.message : "Não foi possível conectar Gemini Live.");
    }
  }
  private reconnect() {
    if (!this.enabled) return;
    this.connection++; this.ready = false; this.clearTimers(); this.abort?.abort();
    this.provisioning?.abort(); this.outputAllowed = false; this.pending = null; this.playing = false;
    this.audio.interrupt(); this.session?.close(); this.session = null;
    this.transcript = ""; this.transcriptReady = false;
    if (++this.attempts > 3) { this.fail("A sessão caiu repetidamente. Reative a escuta para tentar novamente."); return; }
    this.emit("resuming", "Reconectando Gemini Live…");
    this.later(() => { void this.connect(); }, 500 * 2 ** (this.attempts - 1));
  }
  private message(message: LiveServerMessage) {
    try {
      if (message.sessionResumptionUpdate?.resumable) this.handle = message.sessionResumptionUpdate.newHandle;
      if (message.goAway) { this.reconnect(); return; }
      const content = message.serverContent;
      if (content?.interrupted) {
        this.playing = false;
        this.audio.interrupt(); this.outputAllowed = false; this.abort?.abort(); this.pending = null;
        this.emit("command", "Interrupção detectada · ouvindo…");
      }
      if (message.toolCallCancellation?.ids?.length) {
        if (this.pending?.id && message.toolCallCancellation.ids.includes(this.pending.id)) this.pending = null;
        this.abort?.abort(); this.outputAllowed = false;
      }
      // Transcription alone must never interrupt playback; native Live VAD controls barge-in.
      if (content?.inputTranscription && !this.playing) {
        if (!this.transcript && content.inputTranscription.text) {
          this.usedTurn = false;
          this.emit("command", "Ouvindo…");
        }
        if (this.transcriptReady) { this.transcript = ""; this.transcriptReady = false; this.outputAllowed = false; }
        this.transcript += content.inputTranscription.text || "";
        this.transcriptReady = content.inputTranscription.finished === true;
        if (this.transcript.length > 1500) throw new Error("Fala muito longa. Use mensagens de até 1.500 caracteres.");
      }
      for (const call of message.toolCall?.functionCalls || []) {
        if (!call.id || this.seen.has(call.id)) continue;
        if (call.name !== GEMINI_JARVIS_TOOL || Object.keys(call.args || {}).length || this.pending || this.usedTurn)
          throw new Error("Chamada Gemini bloqueada: ferramenta ou argumentos não autorizados.");
        this.seen.add(call.id);
        if (this.seen.size > 1000) throw new Error("Limite da sessão experimental atingido.");
        this.pending = call;
        this.later(() => {
          if (this.pending?.id === call.id) this.fail("Transcrição incompleta. Reative a sessão ou use o teclado.");
        }, 10000);
      }
      if (this.pending && this.transcriptReady) void this.run();
      if (this.outputAllowed && !content?.interrupted) {
        for (const part of content?.modelTurn?.parts || []) {
          if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/pcm")) {
            this.playing = true;
            this.updateVolume(); this.audio.play(part.inlineData.data); this.outputChunks++; this.options.onSpeechAvailable?.();
            this.emit("speaking", `Gemini Live ativo · entrada PCM16 ${this.inputChunks} blocos · saída PCM24 ${this.outputChunks} blocos · AEC ${this.aec ? "confirmado" : "não confirmado"} · eco filtrado ${this.echoFrames} · TTS bloqueado`);
          }
        }
      }
    } catch (error) { this.fail(error instanceof Error ? error.message : "Erro na sessão Gemini."); }
  }
  private async run() {
    const call = this.pending; this.pending = null;
    const text = this.transcript.trim(); this.transcript = ""; this.transcriptReady = false;
    if (!call || !text) return;
    this.usedTurn = true;
    this.abort?.abort(); const abort = new AbortController(); this.abort = abort;
    const connection = this.connection;
    this.outputAllowed = false; this.audio.interrupt();
    this.options.onUser(text); this.emit("processing", "Consultando o núcleo Jarvis…");
    try {
      const reply = await this.options.command(text, abort.signal);
      if (abort.signal.aborted || connection !== this.connection || !this.enabled) return;
      this.options.onReply({ ...reply, speechPending: true });
      this.outputAllowed = true;
      this.session?.sendToolResponse({ functionResponses: [{ id: call.id, name: GEMINI_JARVIS_TOOL, response: { text: reply.text } }] });
      if (reply.navigate) { this.stop(); this.options.navigate(reply.navigate); }
    } catch {
      if (!abort.signal.aborted && connection === this.connection) this.fail("O núcleo Jarvis não respondeu. Nenhuma execução foi confirmada. Use o teclado ou reative a escuta.");
    }
  }
  /** Keyboard shares this session and the same Jarvis callback, not a second TTS. */
  sendText(text: string) {
    if (!this.enabled) return false;
    if (!this.ready) { this.emit("error", "Gemini Live não conectado. Reative a sessão; TTS alternativo bloqueado."); return false; }
    if (!text.trim()) return true;
    if (text.length > 1500) { this.fail("Use mensagens de até 1.500 caracteres."); return false; }
    this.abort?.abort(); this.audio.interrupt(); this.outputAllowed = false; this.playing = false;
    this.usedTurn = false; this.pending = null;
    this.transcript = text; this.transcriptReady = true;
    this.session?.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
    return true;
  }
  updateVolume() { this.audio.volume(this.options.volume()); }
  audioMuted() { this.updateVolume(); }
  suspendForExternal() { this.stop("Sessão Gemini encerrada durante outra operação."); }
  disableListening() { this.stop(); }
  stop(message = "Escuta Gemini desligada.") {
    this.enabled = false; this.epoch++; this.connection++; this.ready = false;
    this.clearTimers(); this.provisioning?.abort(); this.abort?.abort();
    try { this.session?.sendRealtimeInput({ audioStreamEnd: true }); } catch {}
    this.session?.close(); this.session = null; this.audio.close(); this.audioStarted = false; this.handle = undefined;
    this.transcript = ""; this.transcriptReady = false; this.pending = null; this.outputAllowed = false; this.playing = false; this.inputChunks = 0; this.outputChunks = 0; this.usedTurn = false; this.seen.clear();
    this.emit("off", message);
  }
  private fail(message: string) { this.options.onSpeechUnavailable(); this.stop(message); this.emit("error", message); }
}
