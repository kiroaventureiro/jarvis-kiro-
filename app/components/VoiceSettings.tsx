"use client";
import { useEffect, useRef, useState } from "react";
import {
  brazilianVoices,
  DEFAULT_VOICE_PREFERENCES,
  readVoicePreferences,
  saveVoicePreferences,
  selectVoice,
} from "../../lib/voice/voice-preferences";
import type { VoicePreferences } from "../../lib/voice/voice-types";
import { getVoiceManager } from "../../lib/voice/speech-output";
export default function VoiceSettings() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [prefs, setPrefs] = useState<VoicePreferences>({
      ...DEFAULT_VOICE_PREFERENCES,
    }),
    [status, setStatus] = useState(""),
    [previewing, setPreviewing] = useState(false),
    [provider, setProvider] = useState<string>(
      "Consulte a disponibilidade autenticada do provedor.",
    );
  const preview = useRef<AbortController | null>(null);
  useEffect(() => {
    setPrefs(readVoicePreferences());
    if (!("speechSynthesis" in window)) {
      setStatus("Síntese de fala indisponível neste navegador.");
      return;
    }
    const update = () =>
      setVoices(brazilianVoices(window.speechSynthesis.getVoices()));
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", update);
      preview.current?.abort();
    };
  }, []);
  function update(value: Partial<VoicePreferences>) {
    const next = { ...prefs, ...value };
    setPrefs(next);
    const saved = saveVoicePreferences(next);
    setStatus(
      saved
        ? "Preferências salvas neste navegador."
        : "Armazenamento indisponível; preferências mantidas apenas nesta sessão.",
    );
  }
  async function speak() {
    preview.current?.abort();
    const signal = new AbortController();
    preview.current = signal;
    setPreviewing(true);
    try {
      await getVoiceManager().speak(
        "Bom dia! Sou o Jarvis Kiro. Estou à disposição. O que vamos fazer hoje?",
        signal.signal,
      );
      setStatus(
        "Prévia concluída. Confirme se a voz corresponde à identidade desejada.",
      );
    } catch (error) {
      if (!signal.signal.aborted)
        setStatus(
          error instanceof Error
            ? error.message
            : "Não foi possível reproduzir a prévia.",
        );
    } finally {
      setPreviewing(false);
    }
  }
  async function inspect() {
    try {
      const response = await fetch("/api/director/abacus", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sessão necessária.");
      setProvider(
        "Abacus RouteLLM: " +
          (data.paidCallsAllowed
            ? "autorizada pelo servidor"
            : "uso pago bloqueado") +
          ". Limite: " +
          (data.callsPerHour || 0) +
          " chamadas/hora. Contagem nesta instância: " +
          (data.usage?.calls || 0) +
          ". Créditos da conta: não consultados.",
      );
    } catch (error) {
      setProvider(
        error instanceof Error ? error.message : "Provedor indisponível.",
      );
    }
  }
  const selected = selectVoice(voices, prefs);
  const confirmed = selected && prefs.maleConfirmedURI === selected.voiceURI;
  return (
    <section className="voice-settings glass notice">
      <h2>Identidade vocal do Jarvis</h2>
      <p>
        Voz masculina adulta, pt-BR, timbre médio-grave e ritmo tranquilo. A voz
        exata depende das opções instaladas neste dispositivo; a preferência não
        é sincronizada entre aparelhos.
      </p>
      <div className="form-grid">
        <label>
          Voz em português brasileiro
          <select
            aria-label="Voz em português brasileiro"
            value={prefs.voiceURI}
            onChange={(e) => update({ voiceURI: e.target.value })}
          >
            <option value="">Seleção automática pt-BR</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name}
                {voice.localService ? " · serviço local informado" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Velocidade ({prefs.rate.toFixed(2)})
          <input
            aria-label="Velocidade da voz"
            type="range"
            min=".7"
            max="1.3"
            step=".05"
            value={prefs.rate}
            onChange={(e) => update({ rate: Number(e.target.value) })}
          />
        </label>
        <label>
          Tom ({prefs.pitch.toFixed(2)})
          <input
            aria-label="Tom da voz"
            type="range"
            min=".6"
            max="1.2"
            step=".05"
            value={prefs.pitch}
            onChange={(e) => update({ pitch: Number(e.target.value) })}
          />
        </label>
        <label>
          Volume ({Math.round(prefs.volume * 100)}%)
          <input
            aria-label="Volume da voz"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={prefs.volume}
            onChange={(e) => update({ volume: Number(e.target.value) })}
          />
        </label>
      </div>
      <label className="voice-checkbox">
        <input
          type="checkbox"
          checked={!!confirmed}
          disabled={!selected}
          onChange={(e) =>
            update({
              maleConfirmedURI:
                e.target.checked && selected ? selected.voiceURI : "",
            })
          }
        />
        Após ouvir a prévia, confirmo que esta voz é masculina e adequada ao
        Jarvis.
      </label>
      <p className="intro">
        {!voices.length
          ? "Nenhuma voz pt-BR foi disponibilizada pelo navegador. O HUD e o teclado continuam disponíveis."
          : confirmed
            ? "Voz masculina confirmada por você neste dispositivo."
            : "O navegador não informa gênero de forma padronizada. Usando uma voz pt-BR compatível, sem confirmação de identidade masculina; ouça a prévia e escolha manualmente."}
      </p>
      <label className="voice-checkbox">
        <input
          type="checkbox"
          checked={prefs.continuous}
          onChange={(e) => update({ continuous: e.target.checked })}
        />
        Retomar a escuta após as respostas, quando o navegador permitir.
      </label>
      <div className="form-actions">
        <button
          type="button"
          disabled={!voices.length || previewing}
          onClick={speak}
        >
          Ouvir prévia da voz
        </button>
        <button
          type="button"
          className="outline"
          onClick={() => {
            preview.current?.abort();
            setPreviewing(false);
            setStatus("Prévia interrompida.");
          }}
        >
          Interromper prévia
        </button>
      </div>
      <p role="status">{status}</p>
      <p className="intro">
        A seleção acima controla a síntese do navegador. A sessão neural OpenAI
        preservada usa sua própria configuração vocal, separada, e permanece
        sujeita à autorização de custo do servidor.
      </p>
      <h3>Privacidade e compatibilidade</h3>
      <p>
        A escuta só começa ao autorizar na home. O reconhecimento do navegador
        pode usar processamento remoto do fornecedor; não é necessariamente
        local ou privado. A página interrompe a escuta ao ficar oculta. No
        iPhone, é usado o modo manual conservador. Não funciona com navegador
        fechado ou aparelho bloqueado.
      </p>
      <p>
        O núcleo usa animação representativa da fala, sem medir a amplitude do
        áudio. Chamados, cumprimentos e abertura de páginas são resolvidos
        localmente. Outros pedidos usam apenas o provedor autorizado.
      </p>
      <h3>Provedor e limites</h3>
      <p>
        Fala e reconhecimento usam as funções disponíveis no navegador, sem
        contratar um serviço neural. A API Abacus pode consumir créditos; a
        assinatura ChatLLM não implica uso ilimitado da API. Não há fallback
        pago automático.
      </p>
      <button type="button" onClick={inspect}>
        Consultar autorização e limites
      </button>
      <p role="status">{provider}</p>
      <p className="intro">
        A contagem de chamadas é temporária, por instância do servidor; não é um
        teto financeiro distribuído nem leitura do saldo de créditos. O agente
        Windows de ativação local ainda não está instalado ou habilitado.
      </p>
    </section>
  );
}
