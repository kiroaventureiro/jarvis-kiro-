"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceManager } from "../../lib/voice/speech-output";
import { readVoicePreferences } from "../../lib/voice/voice-preferences";

export default function ArrivalBriefing({
  muted,
  busy,
  onReady,
}: {
  muted: boolean;
  busy: boolean;
  onReady: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState("Boletim disponível");
  const current = useRef({ muted, busy });
  current.current = { muted, busy };
  const speech = useRef<AbortController | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const clearHide = useCallback(() => {
    if (hide.current) clearTimeout(hide.current);
    hide.current = null;
  }, []);
  const collapseAfter = useCallback(
    (ms: number) => {
      clearHide();
      hide.current = setTimeout(() => {
        if (alive.current) setOpen(false);
      }, ms);
    },
    [clearHide],
  );
  const play = useCallback(
    async (value: string) => {
      if (
        !value ||
        current.current.muted ||
        current.current.busy ||
        document.hidden ||
        readVoicePreferences().volume <= 0
      ) {
        setNotice("Ouça quando a conversa estiver livre e o som ativado");
        return;
      }
      speech.current?.abort();
      const controller = new AbortController();
      speech.current = controller;
      clearHide();
      setOpen(true);
      setSpeaking(true);
      setNotice("Anunciando boletim");
      try {
        await getVoiceManager().speak(value, controller.signal);
        if (alive.current && !controller.signal.aborted)
          setNotice("Boletim anunciado");
      } catch {
        if (alive.current && !controller.signal.aborted)
          setNotice("Áudio indisponível ou bloqueado. Use Ouvir ou Ler.");
      } finally {
        if (alive.current && speech.current === controller) {
          speech.current = null;
          setSpeaking(false);
          collapseAfter(1800);
        }
      }
    },
    [clearHide, collapseAfter],
  );
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void fetch("/api/director/arrival-briefing", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (
          controller.signal.aborted ||
          !data ||
          typeof data !== "object" ||
          !("text" in data) ||
          typeof data.text !== "string" ||
          !data.text.trim()
        )
          return;
        const value = data.text.slice(0, 3500);
        setText(value);
        // Never play the arrival bulletin without explicit user request.
        setOpen(false);
        onReady(value);
        setNotice("Boletim disponível sob solicitação.");
      })
      .catch(() => {
        /* No fabricated bulletin or intrusive error for a failed/auth-required request. */
      });
    return () => {
      alive.current = false;
      controller.abort();
      speech.current?.abort();
      clearHide();
    };
  }, [onReady, play, collapseAfter, clearHide]);
  useEffect(() => {
    const interrupt = () => {
      speech.current?.abort();
      getVoiceManager().cancel();
      setSpeaking(false);
      setNotice("Boletim interrompido");
    };
    if (muted || busy) interrupt();
    const visibility = () => {
      if (document.hidden) interrupt();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("jk-arrival-stop", interrupt);
    return () => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("jk-arrival-stop", interrupt); };
  }, [muted, busy]);
  useEffect(() => {
    const replay = () => {
      setOpen(true);
      collapseAfter(16000);
    };
    window.addEventListener("jk-arrival-reveal", replay);
    return () => window.removeEventListener("jk-arrival-reveal", replay);
  }, [collapseAfter]);
  if (!text) return null;
  return (
    <aside
      className={"arrival-briefing " + (open ? "is-open" : "is-collapsed")}
      aria-label="Boletim do Jarvis"
      data-speaking={speaking}
    >
      {open ? (
        <>
          <div className="arrival-heading">
            <strong>Boletim do Jarvis</strong>
            <button
              className="subtle-button"
              onClick={() => {
                window.dispatchEvent(new Event("jk-arrival-stop"));
                clearHide();
                setOpen(false);
              }}
              aria-label="Recolher boletim"
            >
              ×
            </button>
          </div>
          <p role="status">{notice}</p>
          <div className="arrival-actions">
            {speaking ? <button onClick={() => window.dispatchEvent(new Event("jk-arrival-stop"))}>Parar boletim</button> : null}
            <button
              onClick={() => void play(text)}
              disabled={
                muted || busy || speaking || readVoicePreferences().volume <= 0
              }
            >
              {speaking ? "Anunciando…" : "Ouvir"}
            </button>
            <details
              onToggle={(e) => {
                if (e.currentTarget.open) clearHide();
                else if (!speaking) collapseAfter(16000);
              }}
            >
              <summary>Ler boletim</summary>
              <p>{text}</p>
            </details>
          </div>
        </>
      ) : (
        <button
          className="arrival-replay"
          onClick={() => {
            setOpen(true);
            collapseAfter(16000);
          }}
        >
          Boletim <span aria-hidden="true">↗</span>
        </button>
      )}
    </aside>
  );
}
