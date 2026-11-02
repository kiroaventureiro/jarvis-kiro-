"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  VoiceController,
  type VoiceSnapshot,
} from "../../lib/voice/voice-controller";
import { getVoiceManager, cancelLegacyAudio } from "../../lib/voice/speech-output";
import { claimGeminiAudio } from "../../lib/voice/audio-owner";
import { GeminiLiveVoiceAdapter } from "../../lib/voice/gemini-live-adapter";
import { VOICE_PREF_EVENT } from "../../lib/voice/voice-preferences";
import { createBargeInMonitor } from "../../lib/voice/barge-in-monitor";
import { readVoicePreferences } from "../../lib/voice/voice-preferences";
import type {
  RecognitionConstructor,
  VoiceReply,
} from "../../lib/voice/voice-types";
type Props = {
  geminiRequested?: boolean;
  registerActivate?: (activate: (() => void) | null) => void;
  registerLiveText?: (send: ((text: string) => boolean) | null) => void;
  onMessage: (text: string, signal: AbortSignal) => Promise<VoiceReply>;
  onUser: (text: string) => void;
  onReply: (reply: VoiceReply) => VoiceReply | void;
  onSpeechUnavailable: () => void;
  onSpeechAvailable?: () => void;
  onState: (state: VoiceSnapshot) => void;
  beforeStart: () => void;
  registerStop: (stop: () => void) => void;
  muted: boolean;
  desktopAudio?: boolean;
  blocked: boolean;
  externalBusy?: boolean;
};
export default function WakeListener(props: Props) {
  const router = useRouter();
  const callback = useRef(props);
  callback.current = props;
  const engine = useRef<VoiceController | GeminiLiveVoiceAdapter | null>(null);
  const bargeIn = useRef<ReturnType<typeof createBargeInMonitor> | null>(null);
  const [snapshot, setSnapshot] = useState<VoiceSnapshot>({
      phase: "off",
      enabled: false,
      microphoneActive: false,
      message: "",
    }),
    [consent, setConsent] = useState(false),
    [authorized, setAuthorized] = useState(false);
  const ios = useRef(false);
  const [diagnostic, setDiagnostic] = useState("");
  // Gemini Live must always present its own explicit opt-in before the
  // browser's separate microphone permission prompt.
  useEffect(() => {
    if (props.geminiRequested && !authorized) setConsent(true);
  }, [props.geminiRequested, authorized]);
  async function diagnose() {
    try {
      const response = await fetch("/api/voice/gemini-token", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json();
      const code = typeof data.code === "string" && /^[A-Z0-9_]{1,60}$/.test(data.code) ? data.code : "ENDPOINT_ERROR";
      setDiagnostic(`Gemini Live · HTTP ${response.status} · ${code} · teste sem custo, sem token, sem microfone`);
    } catch { setDiagnostic("Gemini Live · falha de rede no diagnóstico."); }
  }
  useEffect(() => {
    let mounted = true;
    window.speechSynthesis?.getVoices();
    const api = window as Window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    ios.current =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // Explicit opt-in, with independent authentication/feature/cost gates on the server.
    const experimental = props.geminiRequested === true;
    const releaseAudio = experimental ? claimGeminiAudio() : () => {};
    if (experimental) cancelLegacyAudio();
    const shared = {
      command: (text: string, signal: AbortSignal) => callback.current.onMessage(text, signal),
      onUser: (text: string) => callback.current.onUser(text),
      onReply: (reply: VoiceReply) => callback.current.onReply(reply),
      onSpeechUnavailable: () => callback.current.onSpeechUnavailable(),
      onState: (state: VoiceSnapshot) => {
        if (mounted) { setSnapshot(state); callback.current.onState(state); }
      },
      navigate: (path: string) => router.push(path),
    };
    const controller = experimental ? new GeminiLiveVoiceAdapter({
      ...shared,
      onSpeechAvailable: () => callback.current.onSpeechAvailable?.(),
      desktopAudioAllowed: () => callback.current.desktopAudio === true,
      volume: () => callback.current.muted ? 0 : readVoicePreferences().volume,
    }) : new VoiceController({
      recognition: api.SpeechRecognition || api.webkitSpeechRecognition || null,
      speech: getVoiceManager(),
      externalSpeechActive: () =>
        !!callback.current.externalBusy || getVoiceManager().isSpeaking(),
      continuous: () => !ios.current && readVoicePreferences().continuous,
      muted: () =>
        callback.current.muted || readVoicePreferences().volume === 0,
      command: (text, signal) => callback.current.onMessage(text, signal),
      onUser: (text) => callback.current.onUser(text),
      onReply: (reply) => callback.current.onReply(reply),
      onSpeechUnavailable: () => callback.current.onSpeechUnavailable(),
      onState: (state) => {
        if (mounted) {
          setSnapshot(state);
          callback.current.onState(state);
        }
      },
      navigate: (path) => router.push(path),
    });
    engine.current = controller;
    if (controller instanceof VoiceController)
      bargeIn.current = createBargeInMonitor(() => controller.interruptForUserSpeech());
    else {
      // Gemini already receives continuous, echo-filtered PCM and owns VAD.
      // An energy-only second microphone can mistake speaker output for barge-in.
      callback.current.registerLiveText?.(text => controller.sendText(text));
    }
    const preferences = () => { if (controller instanceof GeminiLiveVoiceAdapter) controller.updateVolume(); };
    window.addEventListener(VOICE_PREF_EVENT, preferences);
    props.registerStop(() => controller.stop());
    // Hiding a preferences panel or switching document visibility must not
    // own the lifetime of the user's explicitly enabled Gemini session.
    return () => {
      mounted = false;
      callback.current.registerLiveText?.(null);
      window.removeEventListener(VOICE_PREF_EVENT, preferences);
      bargeIn.current?.stop();
      bargeIn.current = null;
      controller.stop();
      releaseAudio();
      engine.current = null;
    };
  }, [router, props.geminiRequested]);
  useEffect(() => {
    if (snapshot.phase === "speaking" && snapshot.enabled && !props.blocked) {
      void bargeIn.current?.start();
    } else {
      bargeIn.current?.stop();
    }
    return () => bargeIn.current?.stop();
  }, [snapshot.phase, snapshot.enabled, props.blocked]);
  useEffect(() => {
    if (props.blocked) {
      // File/preference surfaces may disable the control, but only the user
      // may turn off the explicitly enabled Gemini infinite-listening session.
      if (engine.current instanceof VoiceController)
        engine.current.stop("Escuta desligada durante outra operação.");
      setConsent(false);
    }
  }, [props.blocked]);
  useEffect(() => {
    if (props.muted || engine.current instanceof GeminiLiveVoiceAdapter) engine.current?.audioMuted();
  }, [props.muted]);
  useEffect(() => {
    if (props.externalBusy) engine.current?.suspendForExternal();
  }, [props.externalBusy]);
  useEffect(() => {
    props.registerActivate?.(activate);
    return () => props.registerActivate?.(null);
  });
  function activate() {
    if (snapshot.enabled) {
      engine.current?.disableListening();
      return;
    }
    if (!authorized) {
      setConsent(true);
      return;
    }
    callback.current.beforeStart();
    engine.current?.start();
  }
  function allow() {
    setConsent(false);
    setAuthorized(true);
    callback.current.beforeStart();
    engine.current?.start();
  }
  return (
    <>
      <button
        type="button"
        onClick={activate}
        disabled={props.blocked}
        aria-label={
          snapshot.enabled
            ? "Desligar escuta contínua"
            : "Ativar escuta de voz"
        }
        aria-pressed={snapshot.enabled}
        title={props.geminiRequested ? "Gemini Live · escuta e voz nativa" : "Escuta de voz"}
        className={"icon-button " + (snapshot.enabled ? "active" : "")}
        data-voice-phase={snapshot.phase}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M6 5C3 9 3 15 6 19M18 5c3 4 3 10 0 14M9 8c-2 2-2 6 0 8M15 8c2 2 2 6 0 8" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      </button>
      {snapshot.message &&
      (snapshot.microphoneActive ||
        snapshot.phase === "error" ||
        /oculta|indisponível|permiss|negad/i.test(snapshot.message)) ? (
        <span className="wake-status" role="status" aria-live="polite">
          {snapshot.message}
          {snapshot.microphoneActive ? " · microfone ativo" : ""}
        </span>
      ) : null}
      {consent ? (
        <section
          className="voice-consent glass"
          role="dialog"
          aria-modal="false"
          aria-labelledby="voice-consent-title"
        >
          <h2 id="voice-consent-title">{props.geminiRequested ? "Autorizar Gemini Live do Jarvis?" : "Ativar escuta do Jarvis?"}</h2>
          <p>
            {props.geminiRequested
              ? "O Jarvis abrirá uma sessão de conversação por voz com o Gemini Live. O áudio do microfone será enviado ao serviço do Google para reconhecimento e resposta falada. O Jarvis não grava o áudio de forma persistente."
              : "O navegador terá acesso ao microfone e poderá usar o serviço remoto de reconhecimento do fornecedor. Nada é gravado de forma persistente pelo Jarvis. Com a escuta ativada, você pode falar naturalmente, sem precisar dizer uma palavra de ativação."}
          </p>
          <p>
            {ios.current
              ? "Neste iPhone, cada interação usa escuta manual."
              : "A escuta pode ser retomada enquanto esta página estiver ativa. Você pode desligá-la a qualquer momento."}{" "}
            Provedores pagos continuam sujeitos à autorização e ao limite
            configurados no servidor.
          </p>
          {props.geminiRequested ? <>
            <button type="button" onClick={() => { void diagnose(); }}>Verificar endpoint Gemini sem consumo</button>
            {diagnostic ? <p role="status">{diagnostic}</p> : null}
          </> : null}
          <div className="form-actions">
            <button type="button" onClick={allow}>
              {props.geminiRequested ? "Autorizar Gemini Live e microfone" : "Ativar escuta"}
            </button>
            <button type="button" onClick={() => setConsent(false)}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
