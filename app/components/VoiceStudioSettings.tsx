"use client";
import { useEffect, useRef, useState } from "react";
import type { StudioStatus } from "../../lib/voice/voicestudio";
export default function VoiceStudioSettings() {
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
    if (!file || !/\\.(wav|mp3|ogg)$/i.test(file.name) || file.size > 15_000_000) {
      if (file) setError("Selecione um áudio WAV, MP3 ou OGG de até 15 MB.");
      return;
    }
    setError("");
    const url = URL.createObjectURL(file);
    localPreviewRef.current = url;
    setLocalPreviewUrl(url);
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
      <p>
        O JK na Vercel precisa de um serviço privado acessível por HTTPS. O
        endereço localhost do servidor hospedado não aponta para seu computador.
        A configuração é feita no servidor, sem chaves no navegador.
      </p>
      <div className="glass notice">
        <h3>Prévia local da voz oficial</h3>
        <p>Selecione o arquivo WAV gerado no VoiceStudio para ouvir a voz dentro do Jarvis. O arquivo fica somente neste navegador: não é enviado ao servidor e não altera sua voz atual.</p>
        <input
          type="file"
          accept=".wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg"
          aria-label="Selecionar áudio local da voz oficial"
          onChange={(event) => selectLocalPreview(event.currentTarget.files?.[0])}
        />
        {localPreviewUrl && <audio controls src={localPreviewUrl} preload="none" />}
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
