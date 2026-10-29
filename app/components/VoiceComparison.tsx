"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserSpeechOutput } from "../../lib/voice/speech-output";
import type { VoicePreferences } from "../../lib/voice/voice-types";
const SAMPLE =
  "Bom dia. Vamos acompanhar esta análise com clareza. No mapa, observe a região destacada. Ao terminar, posso preparar um relatório completo para você.";
export default function VoiceComparison({
  voices,
  prefs,
  onSelect,
}: {
  voices: SpeechSynthesisVoice[];
  prefs: VoicePreferences;
  onSelect: (value: Partial<VoicePreferences>) => void;
}) {
  const abort = useRef<AbortController | null>(null),
    [playing, setPlaying] = useState(""),
    [status, setStatus] = useState("");
  useEffect(() => () => abort.current?.abort(), []);
  async function preview(voice: SpeechSynthesisVoice, rate: number) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const id = voice.voiceURI + rate;
    setPlaying(id);
    setStatus(
      "Reproduzindo amostra do navegador, sem chamada de TTS paga do JK.",
    );
    const speaker = new BrowserSpeechOutput(
      () => window.speechSynthesis,
      (text) => new SpeechSynthesisUtterance(text),
      () => ({ ...prefs, voiceURI: voice.voiceURI, rate, pitch: 1 }),
    );
    try {
      await speaker.speak(SAMPLE, controller.signal);
      if (!controller.signal.aborted)
        setStatus(
          "Amostra concluída. Compare naturalidade, pronúncia e ritmo antes de escolher.",
        );
    } catch (e) {
      if (!controller.signal.aborted)
        setStatus(e instanceof Error ? e.message : "Prévia indisponível.");
    } finally {
      if (abort.current === controller) {
        setPlaying("");
        abort.current = null;
      }
    }
  }
  return (
    <details className="voice-comparison">
      <summary>Comparar vozes e opções de evolução</summary>
      <p>
        As amostras abaixo são reais do seu navegador. O tom nativo (1,0) evita
        distorção artificial; a escolha só é salva ao clicar em Usar. O gênero
        não é inferido pelo nome.
      </p>
      {voices.slice(0, 4).map((v) => (
        <article className="voice-candidate" key={v.voiceURI}>
          <strong>{v.name}</strong>
          <small>
            {v.localService
              ? "Serviço local informado pelo navegador"
              : "Serviço do fornecedor do navegador"}{" "}
            · pt-BR
          </small>
          <div>
            <button disabled={!!playing} onClick={() => void preview(v, 1)}>
              Ouvir {v.name} · natural
            </button>
            <button disabled={!!playing} onClick={() => void preview(v, 0.95)}>
              Ouvir {v.name} · calmo
            </button>
            <button
              onClick={() =>
                onSelect({
                  voiceURI: v.voiceURI,
                  rate: 1,
                  pitch: 1,
                  maleConfirmedURI: "",
                })
              }
            >
              Usar {v.name}
            </button>
          </div>
        </article>
      ))}
      {!voices.length ? (
        <p>Nenhuma voz pt-BR disponível neste dispositivo para comparação.</p>
      ) : null}
      <button
        onClick={() => {
          abort.current?.abort();
          setPlaying("");
          setStatus("Comparação interrompida.");
        }}
      >
        Interromper comparação
      </button>
      <p role="status">{status}</p>
      <table>
        <caption>
          Alternativas futuras · consulta documental em 27/10/2026 · nenhuma
          ativada
        </caption>
        <thead>
          <tr>
            <th>Opção</th>
            <th>Qualidade e latência</th>
            <th>Custo e dados</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Voz do navegador</th>
            <td>
              Amostras acima. Varia por aparelho; sem garantia de mesma voz no
              celular. Eventos de palavra dependem do mecanismo.
            </td>
            <td>
              Sem cobrança de API de voz pelo JK. Pode usar serviço remoto do
              fornecedor.
            </td>
          </tr>
          <tr>
            <th>Azure Neural pt-BR</th>
            <td>
              Antonio, Donato e outras vozes masculinas documentadas. Avaliação
              auditiva e latência ainda não medidas nesta conta.
            </td>
            <td>
              F0 anuncia 0,5 milhão de caracteres/mês; S0 depende da região. API
              de síntese em tempo real não retém texto segundo o fornecedor.{" "}
              <a
                href="https://azure.microsoft.com/en-us/pricing/details/speech/"
                target="_blank"
                rel="noreferrer"
              >
                Preços ↗
              </a>{" "}
              ·{" "}
              <a
                href="https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts"
                target="_blank"
                rel="noreferrer"
              >
                Vozes e demonstrações oficiais ↗
              </a>
            </td>
          </tr>
          <tr>
            <th>Google Chirp 3 HD</th>
            <td>
              Streaming documentado e vozes pt-BR. Naturalidade, pronúncia e
              latência precisam de amostra autorizada.
            </td>
            <td>
              US$30/milhão de caracteres após a franquia publicada de 1 milhão.
              Exige faturamento; elegibilidade não consultada. Google informa
              não registrar texto/áudio Cloud TTS.{" "}
              <a
                href="https://cloud.google.com/text-to-speech/pricing?hl=en"
                target="_blank"
                rel="noreferrer"
              >
                Preços ↗
              </a>
            </td>
          </tr>
          <tr>
            <th>Conversa neural em tempo real</th>
            <td>
              Sessão OpenAI existente preservada. Interrupção de áudio depende
              do fluxo Realtime; roteiro por cena é usado pela voz do navegador.
            </td>
            <td>
              Entrada e saída de áudio/texto têm custos próprios; transcrição
              pode ter cobrança separada. Nenhuma sessão foi aberta para
              comparação.{" "}
              <a
                href="https://developers.openai.com/api/docs/guides/voice-latency-cost?voice-api=realtime"
                target="_blank"
                rel="noreferrer"
              >
                Custos e arquitetura ↗
              </a>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Serviços em nuvem exigem autorização específica, orçamento e
        demonstração antes da escolha. Os limites gratuitos publicados não
        significam serviço habilitado ou gratuito para esta conta.
      </p>
    </details>
  );
}
