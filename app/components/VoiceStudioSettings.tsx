"use client";
import { useEffect, useRef, useState } from "react";
import type { StudioStatus } from "../../lib/voice/voicestudio";
export default function VoiceStudioSettings() {
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [queueMessage, setQueueMessage] = useState("");
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const localPreviewRef = useRef<string | null>(null);
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => {
    current.current?.abort();
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
  }, []);
  function selectLocalPreview(file?: File) {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = null;
    setLocalPreviewUrl(null);
    if (!file || !/\.(wav|mp3|ogg)$/i.test(file.name) || file.size > 15_000_000) {
      if (file) setError("Selecione um áudio WAV, MP3 ou OGG de até 15 MB.");
      return;
    }
    setError("");
    const url = URL.createObjectURL(file);
    localPreviewRef.current = url;
    setLocalPreviewUrl(url);
  }
  async function createPairing() {
    setPairingBusy(true);
    setError("");
    setPairingCode("");
    try {
      const r = await fetch("/api/voice/worker", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_pairing" }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Não foi possível gerar o código.");
      setPairingCode(data.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pareamento indisponível.");
    } finally { setPairingBusy(false); }
  }
  async function queueTest() {
    setPairingBusy(true);
    setQueueMessage("");
    try {
      const r = await fetch("/api/voice/worker", {
        method: "PUT", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Jarvis Kiro conectado. A voz oficial está pronta para o teste." }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Não foi possível enviar o teste.");
      setQueueMessage("Teste enviado. Aguardando o VoiceStudio gerar a fala…");
      for (let attempt = 0; attempt < 90; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const audioResponse = await fetch("/api/voice/worker?id=" + encodeURIComponent(data.id), {
          credentials: "same-origin", cache: "no-store",
        });
        const contentType = audioResponse.headers.get("content-type") || "";
        if (audioResponse.ok && contentType.startsWith("audio/wav")) {
          const blob = await audioResponse.blob();
          if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
          const url = URL.createObjectURL(blob);
          localPreviewRef.current = url;
          setLocalPreviewUrl(url);
          setQueueMessage("Voz oficial gerada e recebida. Use o player abaixo para ouvir.");
          return;
        }
        const state = await audioResponse.json().catch(() => ({}));
        if (state.status === "failed") throw Error("VoiceStudio falhou: " + (state.errorCode || "erro não identificado"));
        if (!audioResponse.ok) throw Error(state.error || "Falha ao receber o áudio.");
      }
      throw Error("O VoiceStudio ainda não concluiu em três minutos. O worker continua disponível para novo teste.");
    } catch (e) {
      setQueueMessage(e instanceof Error ? e.message : "Fila indisponível.");
    } finally { setPairingBusy(false); }
  }
  async function inspect() {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/voice/studio", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
      });
      const data = await r.json();
      if (!r.ok)
        throw Error("Entre como proprietário para verificar o VoiceStudio.");
      if (!controller.signal.aborted) setStatus(data);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Consulta indisponível.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="glass notice">
      <h2>VoiceStudio · voz local opcional</h2>
      <p>
        Consulte o serviço configurado para este ambiente. O teste lê
        capacidades e conta perfis salvos; não baixa modelos, não grava o
        microfone e não gera áudio.
      </p>
      <button type="button" onClick={inspect} disabled={busy}>
        {busy ? "Verificando…" : "Testar conexão VoiceStudio"}
      </button>
      <div role="status" aria-live="polite">
        {error || status?.note}
        {status?.state === "read_verified" && (
          <p>
            Perfis salvos: {status.savedProfiles}. Geração de voz ainda não
            validada.
          </p>
        )}
      </div>
      <div className="glass notice">
        <h3>Parear o VoiceStudio deste computador</h3>
        <p>Gere um código temporário, válido por cinco minutos. Depois, use-o no PowerShell para autorizar este computador.</p>
        <button type="button" onClick={createPairing} disabled={pairingBusy}>
          {pairingBusy ? "Aguarde…" : "Gerar código de pareamento"}
        </button>
        {pairingCode && (
          <div role="status" aria-live="polite">
            <p><strong>Código de pareamento</strong></p>
            <p style={{ fontSize: 28, letterSpacing: 5, fontWeight: 700 }}>{pairingCode}</p>
            <button type="button" onClick={() => navigator.clipboard.writeText(pairingCode)}>
              Copiar código
            </button>
            <p>Digite este código no comando de pareamento do PowerShell antes que expire.</p>
            <button type="button" onClick={queueTest} disabled={pairingBusy}>
              {pairingBusy ? "Aguardando VoiceStudio…" : "Testar geração e retorno da voz"}
            </button>
          </div>
        )}
        {queueMessage && <p role="status" aria-live="polite">{queueMessage}</p>}
      </div>
      <p>
        O JK na Vercel precisa de um serviço privado acessível por HTTPS. O
        endereço localhost do servidor hospedado não aponta para seu computador.
        A configuração é feita no servidor, sem chaves no navegador.
      </p>
      <div className="glass notice">
        <h3>Prévia local da voz oficial</h3>
        <p>O áudio recebido do VoiceStudio aparecerá aqui para reprodução. Você também pode selecionar um arquivo local para uma prévia manual.</p>
        <input
          type="file"
          accept=".wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg"
          aria-label="Selecionar áudio local da voz oficial"
          onChange={(event) => selectLocalPreview(event.currentTarget.files?.[0])}
        />
        {localPreviewUrl && (
          <div className="voice-local-preview">
            <p role="status">Áudio local carregado. Reproduza abaixo.</p>
            <audio controls src={localPreviewUrl} preload="metadata" style={{ display: "block", width: "100%", maxWidth: 560 }} />
          </div>
        )}
      </div>
      <a
        href="https://github.com/debpalash/VoiceStudio"
        target="_blank"
        rel="noreferrer"
      >
        Conhecer o VoiceStudio
      </a>
    </section>
  );
}
