"use client";
import { useEffect, useRef, useState } from "react";
import type { StudioStatus } from "../../lib/voice/voicestudio";
export default function VoiceStudioSettings() {
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
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
