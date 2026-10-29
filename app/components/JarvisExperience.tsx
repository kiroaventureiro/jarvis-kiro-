"use client";
import { narrationCoordinator } from "../../lib/holo/narration";
import { complementaryScene } from "../../lib/holo/complementary";
import {
  abacusAccountQuestion,
  readAbacusVoiceSharing,
} from "../../lib/abacus/voice-sharing";
import { abacusEvidenceScene } from "../../lib/abacus/voice-evidence";
import { conversationAction } from "../../lib/holo/conversation-actions";
import HoloResponseHUD from "./holo/HoloResponseHUD";
import { JarvisGeneratedImage } from "./JarvisGeneratedImage";
import { desktopDownloadsSupported } from "../../lib/downloads/automatic";
import { conversationalDownloadIntent } from "../../lib/downloads/conversation";
import { JarvisResultPanel } from "../../components/jarvis-result-panel";
import type { JarvisUnifiedResult } from "../../lib/orchestration/unified-result";
import { useHoloSession } from "./holo/HoloSession";
import {
  composeScene,
  attachmentScene,
  operationalScene,
} from "../../lib/holo/orchestrator";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { connectorResultLink } from "../../lib/connectors/result";
import JarvisNavigation from "./JarvisNavigation";
import HolographicCore from "./HolographicCore";
import HologramBackdrop from "./HologramBackdrop";
import { corePhase, type AudioVisualMode } from "../../lib/hologram/policy";
import AttachmentHUD from "./AttachmentHUD";
import WakeListener from "./WakeListener";
import { createOperationalVoiceTool } from "../../lib/operational/realtime-tool";
import { requestAbacus } from "../../lib/abacus/client";
import {
  historyConsent,
  setHistoryConsent,
  saveDeviceHistory,
  loadDeviceHistory,
} from "../../lib/device-history";
import {
  appendSpokenReply,
  speechUnavailable,
  visibleResponses,
} from "../../lib/response-presentation";
import { getVoiceManager } from "../../lib/voice/speech-output";
import { readVoicePreferences, saveVoicePreferences } from "../../lib/voice/voice-preferences";
import { voiceAction } from "../../lib/voice/local-intents";
import { capabilityQuestion } from "../../lib/orchestration/capability-intent";
import type { VoiceSnapshot } from "../../lib/voice/voice-controller";
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
  const [desktopDownloadCapable, setDesktopDownloadCapable] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{id:string;file:File}|null>(null);
  useEffect(()=>{
    setDesktopDownloadCapable(desktopDownloadsSupported(navigator.userAgent,window.matchMedia("(pointer: coarse)").matches));
  },[]);
  const [generatedImages, setGeneratedImages] = useState<Array<{messageId:string;file:File;label:string;autoDownloadOnArrival:boolean}>>([]);
  const [unifiedResults, setUnifiedResults] = useState<Array<{ messageId: string; result: JarvisUnifiedResult }>>([]);
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceSnapshot>({
    phase: "off",
    enabled: false,
    microphoneActive: false,
    message: "",
  });
  const [audioVisual, setAudioVisual] =
    useState<AudioVisualMode>("representative");
  const [remoteAudio, setRemoteAudio] = useState<MediaStream | null>(null);
  const holoSession = useHoloSession();
  const [centerDemonstration, setCenterDemonstration] = useState(false);
  useEffect(() => {
    const focus = (event: Event) =>
      setCenterDemonstration(!!(event as CustomEvent).detail?.center);
    window.addEventListener("jk-core-focus", focus);
    return () => window.removeEventListener("jk-core-focus", focus);
  }, []);
  useEffect(
    () =>
      narrationCoordinator.subscribe(() => {
        if (narrationCoordinator.state.phase !== "error") return;
        setMessages((items) => {
          const last = items.filter((x) => x.role === "assistant").at(-1);
          return last ? speechUnavailable(items, new Set([last.id])) : items;
        });
      }),
    [],
  );
  const lastUserText = useRef("");
  const conversationHistory = useRef(messages);
  useEffect(() => {
    conversationHistory.current = messages;
  }, [messages]);
  const operationalProjection = useRef(false);
  const operationalVisual = useRef<ReturnType<typeof composeScene>>(null);
  const visualFiles = useRef<
    Array<{ id: string; name: string; image: boolean; file: File }>
  >([]);
  const mediaPicker = useRef<HTMLInputElement>(null);
  const [retainHistory, setRetainHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  useEffect(() => {
    const consent = historyConsent();
    setRetainHistory(consent);
    if (consent)
      setMessages((items) => (items.length ? items : loadDeviceHistory()));
    setHistoryLoaded(true);
  }, []);
  useEffect(() => {
    if (historyLoaded && retainHistory)
      saveDeviceHistory(
        messages.map(({ id, role, text }) => ({ id, role, text })),
      );
  }, [messages, retainHistory, historyLoaded]);
  const [typingRequest, setTypingRequest] = useState(false);
  const [desktopVoice, setDesktopVoice] = useState(false);
  const browserReplyId = useRef<string | null>(null);
  const realtimeReplyIds = useRef(new Set<string>());
  const realtimeSpeechAvailable = useRef(true);
  const [voiceConsumption, setVoiceConsumption] = useState<{
    inputTokens: number;
    outputTokens: number;
    responses: number;
  } | null>(null);
  useEffect(() => {
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const mobile =
      /Android|iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const update = () => setDesktopVoice(!mobile && pointer.matches);
    update();
    pointer.addEventListener("change", update);
    return () => pointer.removeEventListener("change", update);
  }, []);
  const unavailableRealtime = useCallback(() => {
    realtimeSpeechAvailable.current = false;
    const ids = new Set(realtimeReplyIds.current);
    setMessages((items) => speechUnavailable(items, ids));
  }, []);
  const [wakeHandoff, setWakeHandoff] = useState(false);
  const wakeWasActive = useRef(false);
  const wakeStop = useRef<() => void>(() => {});
  const typingAbort = useRef<AbortController | null>(null);
  const fileSpeech = useRef<AbortController | null>(null);
  const registerWakeStop = useCallback((stop: () => void) => {
    wakeStop.current = stop;
  }, []);
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
    typingAbort.current?.abort();
    fileSpeech.current?.abort();
    fileSpeech.current = null;
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
    setRemoteAudio(null);
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
  useEffect(() => {
    if (wakeHandoff && connected && state === "idle" && voiceSnapshot.enabled) {
      setWakeHandoff(false);
      stop();
    }
  }, [wakeHandoff, connected, state, voiceSnapshot.enabled, stop]);
  const fail = useCallback(
    (message: string) => {
      unavailableRealtime();
      cleanup();
      setConnected(false);
      setMic(false);
      setError(message);
      setState("error");
    },
    [cleanup, unavailableRealtime],
  );
  const workspace = useFileWorkspace({
    stopVoice: stop,
    onUser: (id, text) =>
      setMessages((items) => [...items, { id, role: "user", text }]),
    onDelta: (id, text) =>
      setMessages((items) =>
        desktopVoice && !muteRef.current && readVoicePreferences().volume > 0
          ? appendSpokenReply(items, id, text, false, true)
          : appendTranscript(items, id, "assistant", text),
      ),
    onComplete: (id, text) => {
      setMessages((items) =>
        desktopVoice && !muteRef.current && readVoicePreferences().volume > 0
          ? appendSpokenReply(items, id, text, true, true)
          : appendTranscript(items, id, "assistant", text, true),
      );
      analysisContext.current = text.slice(0, 12000);
      holoSession.rememberMedia(
        visualFiles.current
          .filter((f) => f.image)
          .map((f) => ({ id: f.id, label: f.name, file: f.file })),
      );
      const rawVisual = attachmentScene(text, visualFiles.current);
      const visual = desktopVoice
        ? complementaryScene(rawVisual, text)
        : rawVisual;
      holoSession.present(visual);
      if (
        desktopVoice &&
        !muteRef.current &&
        readVoicePreferences().volume > 0
      ) {
        fileSpeech.current?.abort();
        const controller = new AbortController();
        fileSpeech.current = controller;
        setState("responding");
        void getVoiceManager()
          .speak(text, controller.signal, { scene: visual || undefined })
          .catch(() => {
            if (!controller.signal.aborted)
              setMessages((items) => speechUnavailable(items, new Set([id])));
          })
          .finally(() => {
            if (fileSpeech.current === controller) {
              fileSpeech.current = null;
              setState("idle");
            }
          });
      }
    },
    onState: (next) => {
      if (!fileSpeech.current) setState(next);
    },
    history: () => messages.map(({ role, text }) => ({ role, text })),
  });
  useEffect(() => {
    visualFiles.current = workspace.files.map((f) => ({
      id: f.id,
      name: f.file.name,
      image: !!f.preview,
      file: f.file,
    }));
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
      realtimeSpeechAvailable.current = true;
      realtimeReplyIds.current = new Set();
      const pc = new RTCPeerConnection();
      peer.current = pc;
      const el = document.createElement("audio");
      el.autoplay = true;
      el.muted = muteRef.current;
      audio.current = el;
      el.onerror = () => {
        if (attempt === generation.current) unavailableRealtime();
      };
      pc.ontrack = (e) => {
        el.srcObject = e.streams[0];
        setRemoteAudio(e.streams[0] || null);
        el.play().catch(() => {
          if (attempt === generation.current) {
            unavailableRealtime();
            setError(
              "O navegador bloqueou o áudio. Use o controle de áudio para reproduzir.",
            );
          }
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
      const statusTool = createOperationalVoiceTool({
        question: () => lastUserText.current,
        history: () =>
          conversationHistory.current
            .slice(-8)
            .map(({ role, text }) => ({ role, content: text })),
        signal: controller.signal,
        isCurrent: () => attempt === generation.current,
        allowPrivateAbacus: () =>
          readAbacusVoiceSharing() &&
          abacusAccountQuestion(lastUserText.current),
        onVisual: (value) => {
          const reply = value as { visual?: unknown };
          if (reply?.visual) {
            operationalProjection.current = true;
            const visual = composeScene(lastUserText.current, {
              text: "",
              visual: reply.visual,
            });
            if (visual) {
              operationalVisual.current = visual;
              holoSession.present(
                desktopVoice
                  ? complementaryScene(visual, visual.narration || "")
                  : visual,
              );
            }
          }
        },
        onSnapshot: (snapshot) => {
          operationalProjection.current = true;
          const data = snapshot as { abacus?: unknown };
          const visual = /abacus|routellm|chatllm/i.test(lastUserText.current)
            ? abacusEvidenceScene(data.abacus)
            : operationalScene(snapshot);
          if (visual) {
            operationalVisual.current = visual;
            holoSession.present(visual);
          }
        },
        send: (event) => {
          if (dc.readyState === "open") dc.send(JSON.stringify(event));
        },
      });
      dc.onmessage = (message) => {
        if (attempt !== generation.current) return;
        let event: RealtimeEvent;
        try {
          event = JSON.parse(message.data);
        } catch {
          return;
        }
        if (
          event.type === "response.done" &&
          event.response?.usage &&
          data.usageSessionId
        ) {
          const usage = event.response.usage;
          void fetch("/api/voice/usage", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: data.usageSessionId,
              responseId: event.response.id || event.response_id,
              inputTokens: usage.input_tokens || 0,
              outputTokens: usage.output_tokens || 0,
            }),
          })
            .then(async (r) => {
              if (r.ok && attempt === generation.current)
                setVoiceConsumption((await r.json()).stats);
            })
            .catch(() => {});
        }
        if (event.type === "input_audio_buffer.speech_started") {
          playing.current = false;
          statusTool.resetTurn();
          operationalProjection.current = false;
          operationalVisual.current = null;
          holoSession.close();
        }
        if (
          event.type === "response.done" &&
          event.response?.status === "completed" &&
          event.response?.output?.some((item) => item.type === "function_call")
        ) {
          setState("processing");
          void statusTool.handle(event).catch(() => {
            if (attempt === generation.current) {
              setError(
                "Não foi possível atualizar o estado operacional. Nenhuma conexão foi presumida.",
              );
              setState("error");
            }
          });
          return;
        }
        if (event.type === "response.created") {
          responseFinished.current = false;
          playing.current = false;
          realtimeReplyIds.current = new Set();
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
          unavailableRealtime();
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
        ) {
          const spoken = event.type.includes("audio_transcript");
          realtimeReplyIds.current.add(id);
          setMessages((items) =>
            spoken || (realtimeSpeechAvailable.current && !muteRef.current)
              ? appendSpokenReply(
                  items,
                  id,
                  event.delta!,
                  false,
                  realtimeSpeechAvailable.current && !muteRef.current,
                )
              : appendTranscript(items, id, "assistant", event.delta!),
          );
        }
        if (
          [
            "response.output_audio_transcript.done",
            "response.audio_transcript.done",
          ].includes(event.type) &&
          typeof event.transcript === "string"
        ) {
          realtimeReplyIds.current.add(id);
          const visual = composeScene(lastUserText.current, {
            text: event.transcript!,
          });
          if (visual && !operationalProjection.current)
            holoSession.present(
              desktopVoice
                ? complementaryScene(visual, event.transcript!)
                : visual,
            );
          if (operationalProjection.current && operationalVisual.current) {
            const scene = {
              ...operationalVisual.current,
              narration: event.transcript!,
            };
            holoSession.present(
              desktopVoice
                ? complementaryScene(scene, event.transcript!)
                : scene,
            );
          }
          setMessages((items) =>
            appendSpokenReply(
              items,
              id,
              event.transcript!,
              true,
              realtimeSpeechAvailable.current && !muteRef.current,
            ),
          );
        }
        if (
          event.type ===
            "conversation.item.input_audio_transcription.completed" &&
          event.transcript
        )
          lastUserText.current = event.transcript;
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
          if (!audio.current?.srcObject) unavailableRealtime();
          if (event.response?.status === "failed") {
            unavailableRealtime();
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
    wakeStop.current();
    if (fileSpeech.current) {
      fileSpeech.current.abort();
      fileSpeech.current = null;
      setState("idle");
    }
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
  function selfControlReply(text:string) {
    const action=voiceAction(text);
    if(action==="none")return null;
    let reply="";
    if(action==="volume_up"||action==="volume_down"){
      const prefs=readVoicePreferences();
      const next=Math.max(0,Math.min(1,Math.round((prefs.volume+(action==="volume_up"?0.15:-0.15))*100)/100));
      saveVoicePreferences({...prefs,volume:next});
      if(audio.current)audio.current.volume=next;
      reply="Volume ajustado para "+Math.round(next*100)+" por cento.";
    } else if(action==="keyboard"){
      setTyping(true);
      reply="Campo de escrita aberto.";
    } else if(action==="files"){
      setTyping(true);
      reply="Preparei a opção de anexar arquivos. Para selecionar um arquivo local, o navegador pode exigir um clique.";
    } else {
      getVoiceManager().cancel();
      reply="Interrompi a fala atual.";
    }
    return {text:reply,model:"jk-local-action",provider:"local_operational" as const,usage:null,visual:undefined};
  }
  function localConversationReply(text: string) {
    const selfControl=selfControlReply(text);
    if(selfControl)return selfControl;
    const action = conversationAction(text);
    if (!action) return null;
    if (action.kind === "external")
      return {
        text: "Salvar, enviar ou compartilhar exige um serviço realmente conectado, destino e aprovação do plano. Nenhuma dessas ações foi executada. Consulte a Central de Conexões.",
        model: "jk-local-action",
        provider: "local_operational" as const,
        usage: null,
        visual: undefined,
      };
    const prior = holoSession.scenes[0];
    if (!prior)
      return {
        text: "Ainda não há um resultado para exportar. Primeiro peça uma explicação ou análise.",
        model: "jk-local-action",
        provider: "local_operational" as const,
        usage: null,
        visual: undefined,
      };
    holoSession.requestExport(prior.id, action.format);
    return {
      text:
        "Vou preparar o " +
        action.format.toUpperCase() +
        " do resultado. Quando estiver pronto, use o botão Baixar. O arquivo fica neste navegador; não será enviado a outro serviço.",
      model: "jk-local-action",
      provider: "local_operational" as const,
      usage: null,
      visual: undefined,
    };
  }
  async function conversationalCapabilityReply(text:string) {
    const topic=capabilityQuestion(text);
    if(!topic)return null;
    try {
      const response=await fetch("/api/director/capabilities",{cache:"no-store",credentials:"same-origin"});
      if(!response.ok)return null;
      const data=await response.json();
      let answer="";
      if(topic==="codex")answer=data.codex?.execution==="not_connected"
        ?"O Codex pode preparar tarefas, mas o executor autenticado ainda não está conectado. Não iniciei nenhuma execução."
        :"A integração Codex informou o estado "+String(data.codex?.execution||"indefinido")+".";
      if(topic==="navi")answer=data.navi?.available
        ?"A ponte Navi está configurada e autorizada no servidor. Isto não confirma uma chamada realizada."
        :"A ponte Navi ainda não está pronta. Verifique configuração, habilitação e autorização de cobrança da OpenAI API.";
      if(topic==="companion")answer=data.companion?.desktopConnected
        ?"O companion informa conexão desktop; operações específicas ainda precisam de autorização."
        :"O aplicativo local do Jarvis ainda não está conectado ao computador.";
      return {text:answer,model:"jk-capabilities",provider:"local_operational" as const,usage:null,visual:undefined};
    } catch { return null; }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || ["connecting", "processing"].includes(state)) return;
    const downloadIntent = conversationalDownloadIntent(text, !!pendingDownload && desktopDownloadCapable);
    if (downloadIntent !== "other" && pendingDownload) {
      const {id, file} = pendingDownload;
      setPendingDownload(null);
      setDraft("");
      if (downloadIntent !== "decline") {
        const url = URL.createObjectURL(file);
        try {
          const link = document.createElement("a");
          link.href = url;
          link.download = "jarvis-imagem-" + id.slice(0,8) + (file.type==="image/png"?".png":file.type==="image/jpeg"?".jpg":".webp");
          document.body.appendChild(link);
          link.click();
          link.remove();
        } finally { window.setTimeout(() => URL.revokeObjectURL(url), 30000); }
      }
      const response = downloadIntent === "decline"
        ? "Certo, não vou baixar esta imagem."
        : "Solicitei o download ao navegador. Ele pode solicitar sua permissão.";
      setMessages(items => [...items,
        {id:crypto.randomUUID(),role:"user",text},
        {id:crypto.randomUUID(),role:"assistant",text:response}
      ]);
      return;
    }
    if (workspace.files.length) {
      if (workspace.recording) return;
      holoSession.close();
      const success = await workspace.analyze(text);
      if (success) setDraft("");
      return;
    }
    if (connected || peer.current) stop();
    fileSpeech.current?.abort();
    fileSpeech.current = null;
    typingAbort.current?.abort();
    const requestController = new AbortController();
    typingAbort.current = requestController;
    setTypingRequest(true);
    // Typed messages use the server-side RouteLLM adapter. Voice remains a separate session.
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setMessages((items) => [...items, { id: userId, role: "user", text }]);
    setDraft("");
    setError("");
    setState("processing");
    lastUserText.current = text;
    holoSession.close();
    try {
      const voiceFirst =
        desktopVoice && !muteRef.current && readVoicePreferences().volume > 0;
      const local = localConversationReply(text) || await conversationalCapabilityReply(text);
      let generatedForThisResponse=false;
      const result =
        local ||
        (await requestAbacus(text, {
          onGeneratedMedia: (items) => {
            holoSession.rememberMedia(items);
            const image=items.find(item=>["image/png","image/jpeg","image/webp"].includes(item.file.type) && item.file.size <= 8_000_000);
            if (image && !requestController.signal.aborted) {
              setGeneratedImages(previous=>[...previous.slice(-7),{messageId:assistantId,file:image.file,label:image.label,autoDownloadOnArrival:false}]);
              if (desktopDownloadCapable) { generatedForThisResponse=true; setPendingDownload({id:assistantId,file:image.file}); }
            }
          },
          history: messages.map(({ role, text }) => ({ role, content: text })),
          signal: requestController.signal,
          onDelta: (partial) => {
            if (requestController.signal.aborted) return;
            setMessages((items) =>
              voiceFirst
                ? appendSpokenReply(items, assistantId, partial, true)
                : appendTranscript(
                    items,
                    assistantId,
                    "assistant",
                    partial,
                    true,
                  ),
            );
          },
        }));
      if (requestController.signal.aborted) return;
      if (generatedForThisResponse) result.text += "\n\nQuer que eu baixe esta imagem no seu computador?";
      setUnifiedResults(previous => [...previous.slice(-31), {
        messageId: assistantId,
        result: {
          requestId: assistantId,
          source: "other",
          status: "completed",
          messages: [result.text],
          artifacts: [],
          provenance: {provider: result.provider || "jarvis"},
        },
      }]);
      const rawVisual = local ? null : composeScene(text, result);
      const visual = desktopVoice
        ? complementaryScene(rawVisual, result.text)
        : rawVisual;
      if (visual) holoSession.present(visual);
      if (
        desktopVoice &&
        !muteRef.current &&
        readVoicePreferences().volume > 0
      ) {
        setMessages((items) =>
          appendSpokenReply(items, assistantId, result.text as string, true),
        );
        setState("responding");
        try {
          await getVoiceManager().speak(
            result.text as string,
            requestController.signal,
            { scene: visual || undefined },
          );
        } catch (error) {
          if (
            !(error instanceof DOMException && error.name === "AbortError") &&
            !requestController.signal.aborted
          )
            setMessages((items) =>
              speechUnavailable(items, new Set([assistantId])),
            );
        }
      } else {
        setMessages((items) =>
          speechUnavailable(
            appendTranscript(
              items,
              assistantId,
              "assistant",
              result.text,
              true,
            ),
            new Set([assistantId]),
          ),
        );
      }
      if (!requestController.signal.aborted) setState("idle");
    } catch (err) {
      setMessages((items) => items.filter((item) => item.id !== assistantId));
      if (!requestController.signal.aborted) {
        setError(
          err instanceof Error ? err.message : "Falha na resposta da Abacus",
        );
        setState("error");
      }
    } finally {
      if (typingAbort.current === requestController) {
        typingAbort.current = null;
        setTypingRequest(false);
      }
    }
  }
  function toggleAudio() {
    const next = !muted;
    muteRef.current = next;
    setMuted(next);
    if (next && (typingAbort.current || fileSpeech.current))
      getVoiceManager().cancel();
    if (audio.current) {
      audio.current.muted = next;
      if (!next)
        audio.current.play().catch(() => {
          unavailableRealtime();
          setError("Não foi possível reproduzir o áudio.");
        });
    }
  }
  const visibleMessages = visibleResponses(messages, desktopVoice, muted);
  const responses = visibleMessages.filter((item) => item.role === "assistant");
  const last = responses[responses.length - 1];
  const shown = history ? visibleMessages : last ? [last] : [];
  return (
    <main
      className={
        "jarvis-stage jarvis-desktop-focus " +
        (hidden ? "is-hidden " : "") +
        (holoSession.current ? "has-holo " : "") +
        (workspace.files.length ? "has-attachments " : "") +
        (dragging ? "is-dragging" : "")
      }
      data-state={state}
      data-holo-scene={holoSession.current?.mode || "none"}
      data-holo-state={
        state === "error"
          ? "error"
          : workspace.busy
            ? "executing"
            : state === "responding"
              ? "responding"
              : state === "processing"
                ? "thinking"
                : state === "listening"
                  ? "listening"
                  : holoSession.current?.modules.some((m) => m.kind === "media")
                    ? "media"
                    : "idle"
      }
      data-voice-phase={voiceSnapshot.phase}
      data-audio-visual={audioVisual}
      data-speech-presentation={desktopVoice ? "voice-first" : "transcript"}
      onDragEnter={dragEnter}
      onDragOver={dragOver}
      onDragLeave={dragLeave}
      onDrop={dropFiles}
      onPaste={pasteFiles}
      onPlayCapture={(event) => {
        if (event.target instanceof HTMLVideoElement) {
          wakeStop.current();
          stop();
        }
      }}
      aria-label="Jarvis: solte arquivos em qualquer parte da tela"
    >
      <h1 className="sr-only">Jarvis Kiro, assistente pessoal</h1>
      <HologramBackdrop />
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
        <HolographicCore
          phase={corePhase(
            workspace.phase === "error" ? "error" : state,
            voiceSnapshot.phase,
            workspace.busy,
            workspace.recording,
          )}
          hidden={hidden || centerDemonstration}
          inputStream={mic ? media.current : null}
          outputStream={remoteAudio}
          muted={muted}
          onVisualMode={setAudioVisual}
        />
        <div className="state-indicator" role="status" aria-live="polite">
          <span className={"signal " + (connected ? "online" : "")} />
          {workspace.phase === "error"
            ? "Análise não concluída"
            : workspace.recording
              ? "Ouvindo orientação"
              : voiceSnapshot.enabled
                ? voiceSnapshot.phase === "waiting"
                  ? "Aguardando Jarvis"
                  : voiceSnapshot.phase === "command"
                    ? "Ouvindo comando"
                    : labels[state]
                : labels[state]}
          <span className="connection-label">
            {workspace.busy
              ? "Arquivos em análise"
              : workspace.files.length
                ? "Modo arquivos"
                : voiceSnapshot.enabled
                  ? voiceSnapshot.microphoneActive
                    ? "Microfone ativo"
                    : "Reconhecimento pausado"
                  : connected
                    ? mic
                      ? "Microfone ativo"
                      : "Microfone desligado"
                    : ""}
          </span>
        </div>
      </section>
      <HoloResponseHUD
        externalAudioActive={connected && state === "responding"}
        showNarration={
          !!last && (!desktopVoice || muted || last.speechAvailable === false)
        }
        local={workspace.files
          .filter((f) => !!f.preview)
          .map((f) => ({
            id: f.id,
            label: f.file.name,
            url: f.preview!,
            type: "image" as const,
          }))}
      />
      {state === "processing" || workspace.busy ? (
        <div className="holo-task-state" role="status">
          <span />{" "}
          {workspace.busy ? "Analisando arquivos" : "Organizando resposta"} ·
          aguarde o resultado
        </div>
      ) : null}
      {shown.length && !holoSession.current ? (
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
                {item.role === "assistant" && unifiedResults.some(entry => entry.messageId === item.id)
                  ? <>{unifiedResults.filter(entry => entry.messageId === item.id).map(entry => <JarvisResultPanel key={entry.messageId} result={entry.result} />)}{generatedImages.filter(image=>image.messageId === item.id).map(image=><JarvisGeneratedImage key={image.messageId} id={image.messageId} file={image.file} label={image.label} autoDownload={image.autoDownloadOnArrival} />)}</>
                  : <p>{item.text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")}</p>}
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
      <div className="jarvis-dock-hotzone" aria-hidden="true" />
      <div className="interaction-dock">
        <details className="dock-preferences">
          <summary aria-label="Preferências da conversa">Preferências</summary>
          {voiceConsumption ? (
            <p aria-live="polite">
              Consumo relatado: {voiceConsumption.inputTokens} tokens de entrada
              · {voiceConsumption.outputTokens} de saída ·{" "}
              {voiceConsumption.responses} respostas. Registro persistente; não
              é a fatura do provedor.
            </p>
          ) : null}
          <div className="glass">
            <button
              className="subtle-button"
              type="button"
              onClick={() => {
                const next = !retainHistory;
                setHistoryConsent(next);
                setRetainHistory(next);
              }}
              aria-pressed={retainHistory}
              title="Armazenamento local não criptografado. Desativar apaga a cópia local."
            >
              {retainHistory
                ? "Não guardar neste dispositivo"
                : "Guardar neste dispositivo"}
            </button>
          </div>
        </details>
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
                ["connecting", "processing"].includes(state)
              }
              aria-label="Enviar mensagem"
            >
              ↑
            </button>
          </form>
        ) : null}
        <div className="dock-controls glass">
          <WakeListener
            muted={muted}
            blocked={workspace.files.length > 0 || state === "connecting"}
            externalBusy={typingRequest || connected}
            registerStop={registerWakeStop}
            beforeStart={() => {
              if (connected) setWakeHandoff(true);
              setError("");
            }}
            onUser={(spoken) => {
              browserReplyId.current = null;
              lastUserText.current = spoken;
              holoSession.close();
              setMessages((items) => [
                ...items,
                { id: crypto.randomUUID(), role: "user", text: spoken },
              ]);
            }}
            onReply={(reply) => {
              const visual =
                reply.provider === "local_action"
                  ? null
                  : composeScene(lastUserText.current, reply);
              const projection = desktopVoice
                ? complementaryScene(visual, reply.text)
                : visual;
              if (projection) holoSession.present(projection);
              const prepared = { ...reply, visual: projection || undefined };
              const id = crypto.randomUUID();
              browserReplyId.current = id;
              setMessages((items) =>
                appendSpokenReply(
                  items,
                  id,
                  reply.text,
                  true,
                  !muteRef.current,
                ),
              );
              return prepared;
            }}
            onSpeechUnavailable={() => {
              const id = browserReplyId.current;
              if (id)
                setMessages((items) => speechUnavailable(items, new Set([id])));
            }}
            onState={(snapshot) => {
              const wasActive = wakeWasActive.current;
              wakeWasActive.current = snapshot.enabled;
              setVoiceSnapshot(snapshot);
              if (!snapshot.enabled) setWakeHandoff(false);
              if (typingAbort.current || fileSpeech.current || connected)
                return;
              if (snapshot.phase === "off" && !wasActive) return;
              setState(
                snapshot.phase === "processing"
                  ? "processing"
                  : snapshot.phase === "speaking"
                    ? "responding"
                    : snapshot.phase === "command"
                      ? "listening"
                      : snapshot.phase === "error"
                        ? "error"
                        : "idle",
              );
            }}
            onMessage={async (spoken, signal) => {
              const local = localConversationReply(spoken) || await conversationalCapabilityReply(spoken);
              if (local) return { ...local, provider: "local_action" };
              if (spoken.length > 1500)
                throw new Error(
                  "O comando é longo demais. Use uma mensagem de até 1.500 caracteres.",
                );
              const data = await requestAbacus(spoken, {
                onGeneratedMedia: holoSession.rememberMedia,
                history: messages.map(({ role, text }) => ({
                  role,
                  content: text,
                })),
                signal,
              });
              return {
                text: data.text,
                provider: data.provider || "abacus",
                result: connectorResultLink(data.result) || undefined,
                visual: data.visual,
              };
            }}
          />
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
            title={
              workspace.files.length
                ? "Orientação por voz sobre os arquivos"
                : "Conversa neural · requer autorização de custo"
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
          <input
            ref={mediaPicker}
            className="sr-only"
            hidden
            type="file"
            multiple
            tabIndex={-1}
            aria-label="Escolher arquivos para análise"
            onChange={(e) => {
              workspace.ingest(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Escolher mídia ou documento"
            disabled={workspace.busy}
            onClick={() => mediaPicker.current?.click()}
          >
            ▧
          </button>
          <Link
            className="icon-button"
            href="/conexoes"
            aria-label="Abrir conexões e ferramentas"
          >
            ⚙
          </Link>
          {holoSession.scenes.length &&
          !holoSession.current &&
          !connected &&
          state !== "connecting" ? (
            <button
              type="button"
              className="icon-button"
              aria-label="Reabrir último resultado holográfico"
              onClick={() => holoSession.select(holoSession.scenes[0].id)}
            >
              ▦
            </button>
          ) : null}
          <button
            className="icon-button"
            onClick={toggleAudio}
            title={muted ? "Ativar saída de voz" : "Silenciar saída de voz"}
            aria-label={muted ? "Ativar áudio" : "Silenciar áudio"}
            aria-pressed={muted}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M4 9h4l5-4v14l-5-4H4z" />
              {muted ? (
                <path d="m17 9 5 6m0-6-5 6" />
              ) : (
                <path d="M17 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14" />
              )}
            </svg>
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
