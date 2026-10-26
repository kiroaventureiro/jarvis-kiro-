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
  onReply: (reply: VoiceReply) => void;
  onState: (state: VoiceSnapshot) => void;
  beforeStart: () => void;
  registerStop: (stop: () => void) => void;
  muted: boolean;
  blocked: boolean;
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
      continuous: () => !ios.current && readVoicePreferences().continuous,
      muted: () => callback.current.muted,
      command: (text, signal) => callback.current.onMessage(text, signal),
      onUser: (text) => callback.current.onUser(text),
      onReply: (reply) => callback.current.onReply(reply),
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
      if (document.hidden)
        controller.stop("Escuta desligada porque a página ficou oculta.");
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", visibility);
      controller.stop();
      engine.current = null;
    };
  }, [router]);
  useEffect(() => {
    if (props.blocked) {
      engine.current?.stop("Escuta desligada durante outra operação.");
      setConsent(false);
    }
  }, [props.blocked]);
  useEffect(() => {
    if (props.muted) engine.current?.audioMuted();
  }, [props.muted]);
  function activate() {
    if (snapshot.enabled) {
      engine.current?.stop();
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
            : "Ativar escuta por Jarvis"
        }
        aria-pressed={snapshot.enabled}
        title="Escuta por palavra de ativação"
        className={"icon-button " + (snapshot.enabled ? "active" : "")}
        data-voice-phase={snapshot.phase}
      >
        {snapshot.enabled ? "◉" : "◎"}
      </button>
      {snapshot.message ? (
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
            pelo Jarvis. Somente comandos após “Jarvis” são encaminhados à
            conversa; cumprimentos e navegação são locais.
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
