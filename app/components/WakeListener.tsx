"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  VoiceController,
  type VoiceSnapshot,
} from "../../lib/voice/voice-controller";
import { getVoiceManager } from "../../lib/voice/speech-output";
import { readVoicePreferences } from "../../lib/voice/voice-preferences";
import type {
  RecognitionConstructor,
  VoiceReply,
} from "../../lib/voice/voice-types";
type Props = {
  onMessage: (text: string, signal: AbortSignal) => Promise<VoiceReply>;
  onUser: (text: string) => void;
  onReply: (reply: VoiceReply) => VoiceReply | void;
  onSpeechUnavailable: () => void;
  onState: (state: VoiceSnapshot) => void;
  beforeStart: () => void;
  registerStop: (stop: () => void) => void;
  muted: boolean;
  blocked: boolean;
  externalBusy?: boolean;
};
export default function WakeListener(props: Props) {
  const router = useRouter();
  const callback = useRef(props);
  callback.current = props;
  const engine = useRef<VoiceController | null>(null);
  const [snapshot, setSnapshot] = useState<VoiceSnapshot>({
      phase: "off",
      enabled: false,
      microphoneActive: false,
      message: "",
    }),
    [consent, setConsent] = useState(false),
    [authorized, setAuthorized] = useState(false);
  const ios = useRef(false);
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
    const controller = new VoiceController({
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
    props.registerStop(() => controller.stop());
    const visibility = () => {
      if (document.hidden) {
        controller.stop("Escuta desligada porque a página ficou oculta.");
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", visibility);
      controller.stop();
      engine.current = null;
    };
  }, [router]);
  // Do not infer a user interruption from raw microphone volume while speaking.
  // Playback echo can otherwise cancel the assistant before its first word ends.
  // Manual stop and mute controls remain available.
  useEffect(() => {
    if (props.blocked) {
      engine.current?.stop("Escuta desligada durante outra operação.");
      setConsent(false);
    }
  }, [props.blocked]);
  useEffect(() => {
    if (props.muted) engine.current?.audioMuted();
  }, [props.muted]);
  useEffect(() => {
    if (props.externalBusy) engine.current?.suspendForExternal();
  }, [props.externalBusy]);
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
        title="Escuta de voz"
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
          <h2 id="voice-consent-title">Ativar escuta do Jarvis?</h2>
          <p>
            O navegador terá acesso ao microfone e poderá usar o serviço remoto
            de reconhecimento do fornecedor. Nada é gravado de forma persistente
            pelo Jarvis. Com a escuta ativada, você pode falar naturalmente,
            sem precisar dizer uma palavra de ativação.
          </p>
          <p>
            {ios.current
              ? "Neste iPhone, cada interação usa escuta manual."
              : "A escuta pode ser retomada enquanto esta página estiver ativa. Você pode desligá-la a qualquer momento."}{" "}
            Provedores pagos continuam sujeitos à autorização e ao limite
            configurados no servidor.
          </p>
          <div className="form-actions">
            <button type="button" onClick={allow}>
              Ativar escuta
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
