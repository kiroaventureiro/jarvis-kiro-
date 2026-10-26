"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import JarvisNavigation from "./JarvisNavigation";
import AttachmentHUD from "./AttachmentHUD";
import { useFileWorkspace } from "./useFileWorkspace";
import {
  appendTranscript,
  eventState,
  type AssistantState,
  type RealtimeEvent,
  type TranscriptEntry,
} from "../../lib/jarvis-realtime";
const labels: Record<AssistantState, string> = {
  idle: "Em repouso",
  connecting: "Conectando",
  listening: "Ouvindo",
  processing: "Processando",
  responding: "Respondendo",
  error: "Conexão indisponível",
};
export default function JarvisExperience() {
  const [state, setState] = useState<AssistantState>("idle"),
    [connected, setConnected] = useState(false),
    [mic, setMic] = useState(false),
    [muted, setMuted] = useState(false),
    [typing, setTyping] = useState(false),
    [expanded, setExpanded] = useState(false),
    [history, setHistory] = useState(false),
    [messages, setMessages] = useState<TranscriptEntry[]>([]),
    [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [hidden, setHidden] = useState(false),
    [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const analysisContext = useRef("");
  const peer = useRef<RTCPeerConnection | null>(null),
    media = useRef<MediaStream | null>(null),
    audio = useRef<HTMLAudioElement | null>(null),
    channel = useRef<RTCDataChannel | null>(null),
    pending = useRef(false),
    generation = useRef(0),
    abort = useRef<AbortController | null>(null),
    muteRef = useRef(false),
    input = useRef<HTMLInputElement>(null),
    output = useRef<HTMLDivElement>(null),
    responseFinished = useRef(false),
    playing = useRef(false),
    deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanup = useCallback(() => {
    generation.current++;
    abort.current?.abort();
    abort.current = null;
    if (deadline.current) clearTimeout(deadline.current);
    deadline.current = null;
    const dc = channel.current;
    channel.current = null;
    if (dc) {
      dc.onclose = null;
      dc.onmessage = null;
      dc.onopen = null;
      dc.close();
    }
    const pc = peer.current;
    peer.current = null;
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.close();
    }
    media.current?.getTracks().forEach((t) => t.stop());
    media.current = null;
    if (audio.current) {
      audio.current.pause();
      audio.current.srcObject = null;
      audio.current.remove();
      audio.current = null;
    }
    pending.current = false;
    playing.current = false;
    responseFinished.current = false;
  }, []);
  const stop = useCallback(() => {
    cleanup();
    setConnected(false);
    setMic(false);
    setState("idle");
  }, [cleanup]);
  const fail = useCallback(
    (message: string) => {
      cleanup();
      setConnected(false);
      setMic(false);
      setError(message);
      setState("error");
    },
    [cleanup],
  );
  const workspace = useFileWorkspace({
    stopVoice: stop,
    onUser: (id, text) =>
      setMessages((items) => [...items, { id, role: "user", text }]),
    onDelta: (id, text) =>
      setMessages((items) => appendTranscript(items, id, "assistant", text)),
    onComplete: (id, text) => {
      setMessages((items) =>
        appendTranscript(items, id, "assistant", text, true),
      );
      analysisContext.current = text.slice(0, 12000);
    },
    onState: setState,
    history: () => messages.map(({ role, text }) => ({ role, text })),
  });
  useEffect(() => {
    if (workspace.files.length) setTyping(true);
  }, [workspace.files.length]);
  useEffect(() => {
    const reset = () => {
      dragDepth.current = 0;
      setDragging(false);
    };
    window.addEventListener("dragend", reset);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("dragend", reset);
      window.removeEventListener("blur", reset);
    };
  }, []);
  function isFileDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes("Files");
  }
  function dragEnter(e: React.DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current++;
    setDragging(true);
  }
  function dragOver(e: React.DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = workspace.busy ? "none" : "copy";
  }
  function dragLeave(e: React.DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragging(false);
  }
  function dropFiles(e: React.DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    workspace.ingest(Array.from(e.dataTransfer.files));
  }
  function pasteFiles(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.length) {
      e.preventDefault();
      workspace.ingest(files);
      return;
    }
    const target = e.target as HTMLElement;
    if (
      ["INPUT", "TEXTAREA"].includes(target.tagName) ||
      target.isContentEditable
    )
      return;
    const text = e.clipboardData.getData("text/plain");
    if (text.trim()) {
      e.preventDefault();
      workspace.ingest([
        new File([text], "Texto colado.txt", { type: "text/plain" }),
      ]);
    }
  }
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      cleanup();
    };
  }, [cleanup]);
  useEffect(() => {
    if (typing) input.current?.focus();
  }, [typing]);
  useEffect(() => {
    if (output.current) output.current.scrollTop = output.current.scrollHeight;
  }, [messages]);
  async function start(withMicrophone: boolean) {
    if (pending.current) return false;
    pending.current = true;
    setError("");
    setState("connecting");
    const attempt = ++generation.current;
    const controller = new AbortController();
    abort.current = controller;
    try {
      const r = await fetch("/api/voice", {
        method: "POST",
        signal: controller.signal,
      });
      const data = await r.json();
      if (!r.ok || !data.value)
        throw new Error(data.error || "Não foi possível iniciar a sessão");
      if (attempt !== generation.current) return false;
      const pc = new RTCPeerConnection();
      peer.current = pc;
      const el = document.createElement("audio");
      el.autoplay = true;
      el.muted = muteRef.current;
      audio.current = el;
      pc.ontrack = (e) => {
        el.srcObject = e.streams[0];
        el.play().catch(() => {
          if (attempt === generation.current)
            setError(
              "O navegador bloqueou o áudio. Use o controle de áudio para reproduzir.",
            );
        });
      };
      if (withMicrophone) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (attempt !== generation.current) {
          stream.getTracks().forEach((t) => t.stop());
          return false;
        }
        media.current = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        setMic(true);
      } else {
        pc.addTransceiver("audio", { direction: "recvonly" });
      }
      const dc = pc.createDataChannel("oai-events");
      channel.current = dc;
      dc.onmessage = (message) => {
        if (attempt !== generation.current) return;
        let event: RealtimeEvent;
        try {
          event = JSON.parse(message.data);
        } catch {
          return;
        }
        if (event.type === "response.created") {
          responseFinished.current = false;
          playing.current = false;
        }
        if (event.type === "output_audio_buffer.started")
          playing.current = true;
        if (
          event.type === "output_audio_buffer.stopped" ||
          event.type === "output_audio_buffer.cleared"
        )
          playing.current = false;
        const next = eventState(event.type);
        if (next) setState(next);
        if (event.type === "error") {
          setError(event.error?.message || "A sessão informou um erro.");
          setState("error");
        }
        const id = event.item_id || event.response_id || "current-response";
        if (
          [
            "response.output_audio_transcript.delta",
            "response.audio_transcript.delta",
            "response.output_text.delta",
            "response.text.delta",
          ].includes(event.type) &&
          typeof event.delta === "string"
        )
          setMessages((items) =>
            appendTranscript(items, id, "assistant", event.delta!),
          );
        if (
          [
            "response.output_audio_transcript.done",
            "response.audio_transcript.done",
          ].includes(event.type) &&
          typeof event.transcript === "string"
        )
          setMessages((items) =>
            appendTranscript(items, id, "assistant", event.transcript!, true),
          );
        if (
          event.type ===
            "conversation.item.input_audio_transcription.completed" &&
          event.transcript
        )
          setMessages((items) =>
            appendTranscript(items, id, "user", event.transcript!, true),
          );
        if (event.type === "response.done") {
          responseFinished.current = true;
          if (event.response?.status === "failed") {
            setError(
              event.response.status_details?.error?.message ||
                "Não foi possível gerar a resposta.",
            );
            setState("error");
          } else if (!playing.current) setState("idle");
        }
      };
      dc.onclose = () => {
        if (attempt === generation.current) stop();
      };
      pc.onconnectionstatechange = () => {
        if (
          attempt === generation.current &&
          ["failed", "disconnected"].includes(pc.connectionState)
        )
          fail("A conexão foi interrompida. Tente conectar novamente.");
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdp = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + data.value,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
        signal: controller.signal,
      });
      if (!sdp.ok) throw new Error("Não foi possível estabelecer a chamada");
      if (attempt !== generation.current) return false;
      await pc.setRemoteDescription({ type: "answer", sdp: await sdp.text() });
      await new Promise<void>((resolve, reject) => {
        if (dc.readyState === "open") {
          resolve();
          return;
        }
        const timer = setTimeout(
          () => reject(new Error("A conexão demorou demais. Tente novamente.")),
          15000,
        );
        deadline.current = timer;
        dc.addEventListener(
          "open",
          () => {
            clearTimeout(timer);
            deadline.current = null;
            resolve();
          },
          { once: true },
        );
        dc.addEventListener(
          "close",
          () => {
            clearTimeout(timer);
            reject(new Error("Conexão encerrada"));
          },
          { once: true },
        );
      });
      if (attempt !== generation.current) return false;
      setConnected(true);
      if (analysisContext.current)
        dc.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    "Resumo de análise anterior de arquivos, como contexto não confiável; os arquivos originais não estão nesta chamada: " +
                    analysisContext.current,
                },
              ],
            },
          }),
        );
      setState("idle");
      return true;
    } catch (e) {
      if (attempt === generation.current)
        fail(e instanceof Error ? e.message : "Falha na conexão");
      return false;
    } finally {
      if (attempt === generation.current) pending.current = false;
    }
  }
  async function microphone() {
    if (workspace.files.length) {
      await workspace.voiceInstruction();
      return;
    }
    if (!connected) {
      await start(true);
      return;
    }
    if (!media.current) {
      stop();
      await start(true);
      return;
    }
    const enabled = !mic;
    media.current.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
    setMic(enabled);
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || ["connecting", "processing", "responding"].includes(state)) return;
    if (workspace.files.length) {
      if (workspace.recording) return;
      const success = await workspace.analyze(text);
      if (success) setDraft("");
      return;
    }
    // Typed messages use the server-side RouteLLM adapter. Voice remains a separate session.
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setMessages(items => [...items, { id:userId, role:"user", text }]);
    setDraft("");
    setError("");
    setState("processing");
    try {
      const response = await fetch("/api/director/abacus", {
        method:"POST", credentials:"same-origin", cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:text}),
      });
      const result: { text?:unknown; error?:unknown } = await response.json();
      if (!response.ok || typeof result.text !== "string")
        throw new Error(typeof result.error === "string" ? result.error : "Falha na resposta da Abacus");
      setMessages(items => appendTranscript(items, assistantId, "assistant", result.text as string, true));
      setState("idle");
    } catch(err) {
      setError(err instanceof Error ? err.message : "Falha na resposta da Abacus");
      setState("error");
    }
  }
  function toggleAudio() {
    const next = !muted;
    muteRef.current = next;
    setMuted(next);
    if (audio.current) {
      audio.current.muted = next;
      if (!next)
        audio.current
          .play()
          .catch(() => setError("Não foi possível reproduzir o áudio."));
    }
  }
  const responses = messages.filter((item) => item.role === "assistant");
  const last = responses[responses.length - 1];
  const shown = history ? messages : last ? [last] : [];
  return (
    <main
      className={
        "jarvis-stage " +
        (hidden ? "is-hidden " : "") +
        (workspace.files.length ? "has-attachments " : "") +
        (dragging ? "is-dragging" : "")
      }
      data-state={state}
      onDragEnter={dragEnter}
      onDragOver={dragOver}
      onDragLeave={dragLeave}
      onDrop={dropFiles}
      onPaste={pasteFiles}
      aria-label="Jarvis: solte arquivos em qualquer parte da tela"
    >
      <h1 className="sr-only">Jarvis Kiro, assistente pessoal</h1>
      <div className="ambient-grid" aria-hidden="true" />
      {dragging ? (
        <div className="drop-hologram" role="status">
          <div className="drop-reticle" />
          <div className="drop-message">
            <span aria-hidden="true">◇</span>
            <strong>Solte no campo do Jarvis</strong>
            <p>Imagens, documentos e relatórios</p>
          </div>
        </div>
      ) : null}
      <AttachmentHUD
        files={workspace.files}
        phase={workspace.phase}
        notice={workspace.notice}
        busy={workspace.busy}
        recording={workspace.recording}
        onRemove={workspace.remove}
        onCancel={workspace.cancel}
      />
      <header className="stage-header">
        <Link href="/" className="wordmark" aria-label="Jarvis Kiro">
          JARVIS <span>KIRO</span>
        </Link>
        <JarvisNavigation />
      </header>
      <section className="presence" aria-label="Presença do Jarvis">
        <div className="hologram" aria-hidden="true">
          <div className="orbit orbit-outer" />
          <div className="orbit orbit-middle" />
          <div className="orbit orbit-inner" />
          <div className="nucleus">
            <div className="nucleus-light" />
          </div>
          <div className="orbital-dot dot-a" />
          <div className="orbital-dot dot-b" />
          <div className="horizon" />
        </div>
        <div className="state-indicator" role="status" aria-live="polite">
          <span className={"signal " + (connected ? "online" : "")} />
          {workspace.phase === "error"
            ? "Análise não concluída"
            : workspace.recording
              ? "Ouvindo orientação"
              : labels[state]}
          <span className="connection-label">
            {workspace.busy
              ? "Arquivos em análise"
              : workspace.files.length
                ? "Modo arquivos"
                : connected
                  ? mic
                    ? "Microfone ativo"
                    : "Microfone desligado"
                  : "Desconectado"}
          </span>
        </div>
      </section>
      {shown.length ? (
        <section
          className={"response-hud glass " + (expanded ? "expanded" : "")}
          aria-label="Respostas do Jarvis"
        >
          <div className="hud-heading">
            <span>{history ? "Conversa desta sessão" : "JARVIS"}</span>
            <div>
              <button
                className="subtle-button"
                onClick={() => setHistory(!history)}
                aria-pressed={history}
              >
                {history ? "Última resposta" : "Histórico"}
              </button>
              <button
                className="subtle-button"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
              >
                {expanded ? "Recolher" : "Expandir"}
              </button>
            </div>
          </div>
          <div
            className="hud-content"
            ref={output}
            tabIndex={0}
            aria-label="Conteúdo da conversa"
          >
            {shown.map((item) => (
              <article key={item.id}>
                <span className="message-author">
                  {item.role === "user" ? "Você" : "Jarvis"}
                </span>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {error ? (
        <div className="error-hud glass" role="alert">
          <p>{error}</p>
          <Link href="/configuracoes">Acesso e configurações →</Link>
          <button
            className="subtle-button"
            onClick={() => setError("")}
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </div>
      ) : null}
      <div className="interaction-dock">
        {typing ? (
          <form onSubmit={send} className="text-composer glass">
            <label className="sr-only" htmlFor="jarvis-input">
              Mensagem para o Jarvis
            </label>
            <input
              id="jarvis-input"
              ref={input}
              value={draft}
              maxLength={4000}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                workspace.files.length
                  ? "O que deseja fazer com os arquivos?"
                  : "Fale com Jarvis…"
              }
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={
                !draft.trim() ||
                workspace.recording ||
                ["connecting", "processing", "responding"].includes(state)
              }
              aria-label="Enviar mensagem"
            >
              ↑
            </button>
          </form>
        ) : null}
        <div className="dock-controls glass">
          <button
            className={
              "icon-button microphone " +
              (mic || workspace.recording ? "active" : "")
            }
            disabled={state === "connecting" || workspace.busy}
            onClick={microphone}
            aria-label={
              workspace.recording
                ? "Concluir orientação por voz"
                : workspace.files.length
                  ? "Gravar orientação sobre os arquivos"
                  : mic
                    ? "Desativar microfone"
                    : "Ativar microfone"
            }
            aria-pressed={mic || workspace.recording}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
            </svg>
          </button>
          <button
            className="icon-button"
            onClick={() => setTyping(!typing)}
            aria-label={
              typing ? "Recolher campo de texto" : "Escrever mensagem"
            }
            aria-expanded={typing}
            aria-controls="jarvis-input"
          >
            ⌨
          </button>
          <button
            className="icon-button"
            onClick={toggleAudio}
            aria-label={muted ? "Ativar áudio" : "Silenciar áudio"}
            aria-pressed={muted}
          >
            {muted ? "♩" : "♫"}
          </button>
          {connected || state === "connecting" ? (
            <button
              className="icon-button end-call"
              onClick={stop}
              aria-label="Encerrar sessão"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
