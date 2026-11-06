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
  private enabled = false; // User-controlled infinite listening toggle.
  private sessionActive = false; // Conversation transport survives when listening is paused.
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
  private transcriptTimer: ReturnType<typeof setTimeout> | null = null;
  private transcriptDeadline: ReturnType<typeof setTimeout> | null = null;
  private pending: FunctionCall | null = null;
  private seen = new Set<string>();
  private outputAllowed = false;
  private ready = false;
  private audioStarted = false;
  private playing = false;
  private processing = false;
  private inputChunks = 0;
  private outputChunks = 0;
  private aec = false;
  private echoFrames = 0;
  private usedTurn = false;
  constructor(private options: Options) {
    this.audio.onEchoEvidence = (frames, aec) => { this.echoFrames = frames; this.aec = aec; };
    this.audio.onMicrophoneEnded = () => {
      // Losing the browser microphone must never close the Gemini Live transport.
      this.audioStarted = false;
      if (this.sessionActive) this.emit("error", "Microfone interrompido · sessão Gemini preservada. Reative a captura pelo áudio infinito.");
    };
    this.audio.onDrained = () => {
      this.playing = false;
      if (!this.sessionActive) return;
      if (this.processing) { this.emit("processing", "Gemini Live · processando resposta"); return; }
      this.outputAllowed = false;
      this.emit(this.enabled ? "waiting" : "off", this.enabled ? "Gemini Live ativo · ouvindo continuamente" : "Em espera · microfone pausado, Gemini conectado");
    };
  }
  private emit(phase: VoiceSnapshot["phase"], message: string) {
    this.options.onState({ phase, message, enabled: this.enabled, microphoneActive: this.enabled && this.ready, connected: this.sessionActive && this.ready });
  }
  private later(fn: () => void, ms: number) {
    const timer = setTimeout(() => { this.timers.delete(timer); fn(); }, ms);
    this.timers.add(timer);
  }
  private clearTimers() { for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); }
  private clearTranscriptTimers() {
    if (this.transcriptTimer) clearTimeout(this.transcriptTimer);
    if (this.transcriptDeadline) clearTimeout(this.transcriptDeadline);
    this.transcriptTimer = null;
    this.transcriptDeadline = null;
  }
  /**
   * Gemini Live transcription fragments do not reliably carry a finished flag.
   * A model tool call marks the end of the user turn; debounce late fragments
   * instead of waiting indefinitely for a flag the service may omit.
   */
  private schedulePendingRun(delay = 450) {
    if (!this.pending) return;
    if (this.transcriptTimer) clearTimeout(this.transcriptTimer);
    this.transcriptTimer = setTimeout(() => {
      this.transcriptTimer = null;
      if (!this.pending) return;
      if (this.transcript.trim()) {
        this.clearTranscriptTimers();
        void this.run();
        return;
      }
      if (!this.transcriptDeadline) {
        this.transcriptDeadline = setTimeout(() => {
          this.transcriptDeadline = null;
          if (this.pending && !this.transcript.trim())
            this.fail("O Gemini não entregou a transcrição desta fala. Reative a sessão ou use o teclado.");
        }, 2500);
      }
    }, delay);
  }
  start() {
    if (this.enabled) {
      if (!this.sessionActive) {
        this.sessionActive = true;
        this.attempts = 0;
        this.emit("resuming", "Retomando a conexão Gemini sem desligar o áudio infinito…");
        void this.connect();
      } else if (this.ready && !this.audioStarted) void this.startCapture();
      return;
    }
    if (!this.options.desktopAudioAllowed()) { this.emit("off", "Esta experiência de áudio está disponível somente no computador. Use o teclado neste aparelho."); return; }
    // Browser autoplay policy requires the speaker context to be resumed from this user gesture.
    this.audio.unlockPlayback();
    this.enabled = true;
    this.attempts = 0;
    ++this.epoch;
    if (this.sessionActive) {
      if (this.ready) void this.startCapture();
      else this.emit("resuming", "Gemini Live continua conectando · escuta será retomada quando estiver pronto");
      return;
    }
    this.sessionActive = true;
    this.emit("resuming", "Gemini Live selecionado · verificando endpoint…");
    void this.connect();
  }
  private async startCapture() {
    if (!this.enabled || !this.sessionActive || !this.ready || this.audioStarted) return;
    const connection = this.connection;
    try {
      await this.audio.start(data => {
        if (!this.enabled || !this.sessionActive || !this.ready || connection !== this.connection) return;
        try { this.session?.sendRealtimeInput({ audio: { data, mimeType: "audio/pcm;rate=16000" } }); this.inputChunks++; }
        catch { this.reconnect(); }
      });
      if (!this.enabled || !this.sessionActive || !this.ready || connection !== this.connection) { this.audio.pauseCapture(); return; }
      this.audioStarted = true;
      this.emit("waiting", "Gemini Live conectado · escuta infinita ativa");
    } catch {
      if (this.sessionActive && connection === this.connection) {
        this.audio.pauseCapture();
        this.audioStarted = false;
        this.emit("error", "Microfone indisponível · escuta infinita permanece selecionada. Verifique a permissão e toque novamente em áudio infinito para tentar capturar.");
      }
    }
  }
  private async connect() {
    const connection = ++this.connection;
    this.ready = false;
    this.provisioning = new AbortController();
    this.later(() => {
      if (this.sessionActive && connection === this.connection && !this.ready)
        this.reconnect();
    }, 20000);
    try {
      const response = await fetch("/api/voice/gemini-token", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: this.handle, clientSessionId: this.clientSessionId, voiceName: (() => { try { return localStorage.getItem("jarvis.gemini.voice.v1") || "Orus"; } catch { return "Orus"; } })() }), signal: this.provisioning.signal,
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
      if (!this.sessionActive || connection !== this.connection) return;
      if (!token.token || Date.parse(token.newSessionExpiresAt) <= Date.now()) throw new Error("Credencial temporária expirada. Reative a sessão.");
      if (this.enabled && !this.audioStarted) {
        await this.audio.start(data => {
          if (!this.enabled || !this.sessionActive || !this.ready) return;
          try { this.session?.sendRealtimeInput({ audio: { data, mimeType: "audio/pcm;rate=16000" } }); this.inputChunks++; }
          catch { this.reconnect(); }
        }).catch(() => { throw new Error("Gemini Live · microfone/AudioWorklet indisponível. Verifique permissões e use Chrome/Edge no computador."); });
        if (!this.sessionActive || connection !== this.connection) { this.audio.pauseCapture(); return; }
        this.audioStarted = this.enabled;
        if (!this.enabled) this.audio.pauseCapture();
      }
      const ai = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: "v1beta" } });
      const session = await ai.live.connect({
        model: token.model,
        config: { sessionResumption: this.handle ? { handle: this.handle } : {} },
        callbacks: {
          onmessage: message => { if (this.sessionActive && connection === this.connection) this.message(message); },
          onerror: () => { if (connection === this.connection) this.reconnect(); },
          onclose: () => { if (this.sessionActive && connection === this.connection) this.reconnect(); },
        },
      }).catch(() => { throw new Error("Gemini Live · falha no WebSocket Google. Verifique modelo, quota e token; TTS alternativo bloqueado."); });
      if (!this.sessionActive || connection !== this.connection) { session.close(); return; }
      this.session = session; this.ready = true;
      this.updateVolume();
      if (this.enabled && !this.audioStarted) void this.startCapture();
      else this.emit(this.enabled ? "waiting" : "off", this.enabled ? "Gemini Live ativo · entrada PCM16 / saída PCM24 · TTS bloqueado" : "Gemini conectado · escuta infinita desligada");
      this.later(() => { this.attempts = 0; }, 30000);
      this.later(() => this.reconnect(), Math.max(1000, Date.parse(token.expiresAt) - Date.now() - 30000));
    } catch (error) {
      if (this.sessionActive && connection === this.connection)
        this.fail(error instanceof Error ? error.message : "Não foi possível conectar Gemini Live.");
    }
  }
  private reconnect() {
    if (!this.sessionActive) return;
    // The backend request may already have queued an approved write. Do not
    // cancel it just because the audio transport dropped during a reply.
    this.connection++; this.ready = false; this.clearTimers();
    this.provisioning?.abort(); this.outputAllowed = false; this.pending = null; this.playing = false;
    this.audio.interrupt();
    this.audio.pauseCapture();
    this.audioStarted = false;
    this.session?.close(); this.session = null;
    this.clearTranscriptTimers();
    this.transcript = ""; this.transcriptReady = false;
    if (++this.attempts > 5) { this.fail("A sessão caiu repetidamente. Reative a escuta para tentar novamente."); return; }
    this.emit("resuming", "Reconectando Gemini Live…");
    this.later(() => { void this.connect(); }, 500 * 2 ** (this.attempts - 1));
  }
  private message(message: LiveServerMessage) {
    try {
      if (message.sessionResumptionUpdate?.resumable) this.handle = message.sessionResumptionUpdate.newHandle;
      if (message.goAway) { this.reconnect(); return; }
      const content = message.serverContent;
      if (content?.interrupted) {
        this.playing = false; this.processing = false;
        this.audio.interrupt(); this.outputAllowed = false; this.abort?.abort(); this.pending = null;
        this.emit("command", "Interrupção detectada · ouvindo…");
      }
      if (message.toolCallCancellation?.ids?.length) {
        // A stale cancellation must not silence a newer reply or abort an unrelated command.
        // A pending tool call has not started an async command, so clear its debounce only.
        if (this.pending?.id && message.toolCallCancellation.ids.includes(this.pending.id)) {
          this.pending = null;
          this.clearTranscriptTimers();
          this.transcript = "";
          this.transcriptReady = false;
        }
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
        // If the tool call arrived before the final transcription fragment,
        // restart the short debounce whenever another fragment arrives.
        if (this.pending) this.schedulePendingRun(this.transcriptReady ? 120 : 450);
      }
      for (const call of message.toolCall?.functionCalls || []) {
        if (!call.id || this.seen.has(call.id)) continue;
        // Gemini may emit optional model-generated arguments even for an empty schema.
        // They are deliberately ignored: only the original user transcript is sent
        // to the Jarvis core, so generated arguments can never authorize an action.
        if (call.name !== GEMINI_JARVIS_TOOL || this.pending || this.usedTurn)
          throw new Error("Chamada Gemini bloqueada: ferramenta não autorizada ou turno duplicado.");
        this.seen.add(call.id);
        if (this.seen.size > 1000) throw new Error("Limite da sessão experimental atingido.");
        this.pending = call;
        // The tool call confirms Gemini has interpreted the user's turn.
        // Transcription events can arrive out of order, so allow a short grace
        // period for the final text fragment before calling the Jarvis core.
        this.schedulePendingRun(this.transcriptReady ? 120 : 800);
      }
      if (this.pending && this.transcriptReady) this.schedulePendingRun(120);
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
    this.clearTranscriptTimers();
    const text = this.transcript.trim(); this.transcript = ""; this.transcriptReady = false;
    if (!call || !text || !this.sessionActive) return;
    this.usedTurn = true;
    this.abort?.abort(); const abort = new AbortController(); this.abort = abort;
    const connection = this.connection;
    this.outputAllowed = false; this.audio.interrupt(); this.processing = true;
    this.options.onUser(text); this.emit("processing", "Consultando o núcleo Jarvis…");
    try {
      const reply = await this.options.command(text, abort.signal);
      if (abort.signal.aborted || !this.sessionActive) { this.processing = false; return; }
      if (connection !== this.connection) {
        // Stale Gemini tool-call IDs cannot be replayed into a new session, but
        // the confirmed Jarvis result must still be shown in the HUD.
        this.processing = false;
        this.options.onReply({ ...reply, speechPending: false });
        return;
      }
      this.processing = false;
      this.options.onReply({ ...reply, speechPending: true });
      this.outputAllowed = true;
      this.session?.sendToolResponse({ functionResponses: [{ id: call.id, name: GEMINI_JARVIS_TOOL, response: { text: reply.text } }] });
      if (reply.navigate) { this.stop(); this.options.navigate(reply.navigate); }
    } catch {
      this.processing = false;
      if (!abort.signal.aborted && connection === this.connection && this.sessionActive) {
        // A failed application request is not a failed audio transport. Finish
        // this tool call without retrying the command or replaying any writes.
        const text = "Não consegui confirmar a resposta do núcleo Jarvis para esta solicitação. Nenhuma execução foi confirmada. A sessão de voz permanece conectada; você pode fazer outra pergunta.";
        this.options.onReply({ text, speechPending: true });
        this.outputAllowed = true;
        try {
          this.session?.sendToolResponse({ functionResponses: [{ id: call.id, name: GEMINI_JARVIS_TOOL, response: { text } }] });
          this.emit("processing", "Consulta indisponível · sessão Gemini preservada");
        } catch { this.reconnect(); }
      }
    }
  }
  /** Keyboard shares this session and the same Jarvis callback, not a second TTS. */
  sendText(text: string) {
    if (!this.sessionActive) return false;
    if (!this.ready) { this.emit("resuming", "Gemini Live está reconectando. Aguarde a sessão ficar disponível."); return false; }
    if (!text.trim()) return true;
    if (text.length > 1500) { this.fail("Use mensagens de até 1.500 caracteres."); return false; }
    this.abort?.abort(); this.audio.interrupt(); this.outputAllowed = false; this.playing = false; this.processing = false;
    this.usedTurn = false; this.pending = null;
    this.transcript = text; this.transcriptReady = true;
    this.session?.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
    return true;
  }
  updateVolume() { this.audio.volume(this.options.volume()); }
  audioMuted() { this.updateVolume(); }
  // Gemini Live owns full-duplex VAD; external UI panels must not toggle off user listening.
  suspendForExternal() { /* Intentionally keep the session and microphone active. */ }
  disableListening() {
    if (!this.enabled) return;
    this.enabled = false;
    // Pause only microphone capture. Never close the Live session or abort an
    // in-flight Jarvis request / Gemini response when the user toggles listening off.
    this.audio.pauseCapture();
    this.audioStarted = false;
    // Explicitly finish a partially captured turn so Gemini does not wait for
    // more microphone frames after the user has disabled infinite listening.
    if (this.transcript.trim() || this.pending) {
      try { this.session?.sendRealtimeInput({ audioStreamEnd: true }); } catch {}
      if (this.pending) this.schedulePendingRun(120);
      this.emit(this.processing ? "processing" : "command", "Finalizando a fala recebida · sessão Gemini preservada");
      return;
    }
    this.emit(
      this.processing ? "processing" : this.playing || this.outputAllowed ? "speaking" : "off",
      this.sessionActive && this.ready
        ? "Microfone pausado · sessão Gemini preservada e pronta para responder por texto"
        : "Microfone pausado · mantendo a conexão Gemini",
    );
  }
  stop(message = "Sessão Gemini encerrada.") {
    this.enabled = false; this.sessionActive = false; this.epoch++; this.connection++; this.ready = false;
    this.clearTimers(); this.clearTranscriptTimers(); this.provisioning?.abort(); this.abort?.abort();
    try { this.session?.sendRealtimeInput({ audioStreamEnd: true }); } catch {}
    this.session?.close(); this.session = null; this.audio.close(); this.audioStarted = false; this.handle = undefined;
    this.transcript = ""; this.transcriptReady = false; this.pending = null; this.outputAllowed = false; this.playing = false; this.processing = false; this.inputChunks = 0; this.outputChunks = 0; this.usedTurn = false; this.seen.clear();
    this.emit("off", message);
  }
  private fail(message: string) {
    const keepSelected = this.enabled;
    this.options.onSpeechUnavailable();
    this.stop(message);
    // A transport failure must not change the user's infinite-listening choice.
    // No automatic paid retry beyond the existing connection budget.
    if (keepSelected) this.enabled = true;
    this.emit("error", message + (keepSelected ? " Áudio infinito continua selecionado; toque nele para reconectar." : ""));
  }
}
