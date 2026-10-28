"use client";
import { useEffect, useRef, useState } from "react";
import type { HoloScene, HoloLocalMedia } from "../../../lib/holo/types";
import { HoloPanel, HoloModuleView } from "./HoloModules";
import { HoloPlaybackContext } from "./HoloPlaybackContext";
import HoloAutomaticContent from "./HoloAutomaticContent";
import { useDemonstration } from "./useDemonstration";
import { useHoloAutoFlow } from "./useHoloAutoFlow";
import { DEFAULT_PRESENTATION_SPACE } from "../../../lib/holo/content-planner";
const SUPPORT_PLAYBACK = {
  playing: false,
  instant: true,
  automatic: true,
  elapsed: 0,
  bodyStart: 0,
};
export default function CinematicPresentation({
  scene,
  local,
  onExplore,
  onStop,
  showNarration = false,
  externalAudioActive = false,
}: {
  scene: HoloScene;
  local: HoloLocalMedia[];
  onExplore: () => void;
  onStop: () => void;
  showNarration?: boolean;
  externalAudioActive?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    primaryRef = useRef<HTMLDivElement>(null),
    optionsRef = useRef<HTMLDetailsElement>(null),
    [space, setSpace] = useState(DEFAULT_PRESENTATION_SPACE),
    [reduced, setReduced] = useState(false),
    [textOpen, setTextOpen] = useState(false),
    [keepOpen, setKeepOpen] = useState(false),
    [closing, setClosing] = useState(false),
    [exportHeld, setExportHeld] = useState(false);
  const director = useDemonstration(scene, space),
    step = director.step,
    instant = director.instant || reduced;
  useHoloAutoFlow({
    root: primaryRef,
    stepId: step?.id || "",
    playing: director.playing,
    instant,
    onEvidence: director.reportFlow,
  });
  useEffect(() => {
    try {
      setKeepOpen(localStorage.getItem("jk-holo-keep") === "true");
    } catch {}
  }, []);
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.sceneId === scene.id) setExportHeld(!!d.hold);
    };
    window.addEventListener("jk-holo-export-hold", handler);
    return () => window.removeEventListener("jk-holo-export-hold", handler);
  }, [scene.id]);
  useEffect(() => {
    if (
      !director.finished ||
      keepOpen ||
      textOpen ||
      exportHeld ||
      externalAudioActive ||
      director.narration.phase === "speaking"
    )
      return;
    const fade = setTimeout(() => setClosing(true), 1800),
      close = setTimeout(onStop, 2600);
    return () => {
      clearTimeout(fade);
      clearTimeout(close);
      setClosing(false);
    };
  }, [
    director.finished,
    director.narration.phase,
    keepOpen,
    textOpen,
    exportHeld,
    externalAudioActive,
    onStop,
  ]);
  useEffect(() => {
    if (!root.current) return;
    const element = root.current,
      resize = new ResizeObserver(() => {
        const rect = element.getBoundingClientRect();
        setSpace((old) =>
          Math.abs(old.width - rect.width) < 3 &&
          Math.abs(old.height - rect.height) < 3
            ? old
            : {
                width: Math.max(180, Math.round(rect.width)),
                height: Math.max(100, Math.round(rect.height)),
              },
        );
      });
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("jk-core-focus", {
        detail: { center: step?.focus === "center" },
      }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("jk-core-focus", { detail: { center: false } }),
      );
    };
  }, [step?.focus]);
  if (!step) return null;
  const support = scene.modules.find((m) => m.id === step.supportId);
  return (
    <div
      ref={root}
      className="cinema-root holo-experience-v2"
      data-closing={closing}
      data-narration-phase={director.narration.phase}
      data-spatial={!["compare", "connections"].includes(step.content.kind)}
      data-surface={
        step.content.kind === "report" && !!step.content.body
          ? "reading"
          : "projection"
      }
      data-focus={step.focus}
      data-playing={director.playing}
      data-complete={director.finished}
      data-sync={director.sync ? "speech" : "guided"}
      data-motion={instant ? "static" : "animated"}
      data-active-hologram={step.id}
      data-tone={step.metricTone}
      data-kind={step.content.kind}
      data-mentioned={
        !!director.spokenTerm &&
        step.content.title
          .toLowerCase()
          .includes(director.spokenTerm.toLowerCase())
      }
    >
      <div className="cinema-director">
        <span className="cinema-state">
          {director.issue
            ? "Conteúdo preservado"
            : director.finished
              ? "Relatório disponível"
              : director.playing
                ? director.sync
                  ? "Acompanhando a fala"
                  : "Construindo a explicação"
                : "Demonstração pausada"}
        </span>
        <div className="cinema-essential-controls">
          <button
            onClick={
              director.playing
                ? director.pause
                : director.finished
                  ? director.replay
                  : () => {
                      if (optionsRef.current) optionsRef.current.open = false;
                      director.resume();
                    }
            }
            aria-label={
              director.playing
                ? "Pausar demonstração"
                : director.finished
                  ? "Rever demonstração"
                  : "Continuar demonstração"
            }
          >
            {director.playing ? "Ⅱ" : director.finished ? "↻" : "▶"}
          </button>
          <button onClick={onStop} aria-label="Interromper demonstração visual">
            ×
          </button>
          <details
            ref={optionsRef}
            className="cinema-options"
            onToggle={(e) => {
              if (e.currentTarget.open) director.pause();
            }}
          >
            <summary>Opções</summary>
            <div className="glass">
              <label>
                Ritmo
                <select
                  value={director.speed}
                  onChange={(e) => director.setSpeed(Number(e.target.value))}
                >
                  <option value={0.75}>Calmo</option>
                  <option value={1}>Natural</option>
                  <option value={1.5}>Ágil</option>
                </select>
              </label>
              <label className="cinema-motion-choice">
                <input
                  type="checkbox"
                  checked={director.instant}
                  onChange={(e) => director.setNoAnimation(e.target.checked)}
                />
                Sem animação
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={keepOpen}
                  onChange={(e) => {
                    setKeepOpen(e.target.checked);
                    try {
                      localStorage.setItem(
                        "jk-holo-keep",
                        String(e.target.checked),
                      );
                    } catch {}
                  }}
                />
                Manter resultado aberto
              </label>
              <button onClick={onExplore}>Explorar quadros</button>
            </div>
          </details>
        </div>
      </div>
      {director.narration.phase === "error" ? (
        <div className="cinema-voice-recovery glass" role="status">
          <p>{director.narration.message}</p>
          <button onClick={director.retryVoice}>Retomar voz</button>
          <button onClick={director.continueSilently}>Continuar sem voz</button>
        </div>
      ) : null}
      {director.issue ? (
        <p className="cinema-flow-notice" role="status">
          {director.issue}
        </p>
      ) : null}
      <HoloPlaybackContext.Provider
        value={{
          playing: director.playing,
          instant,
          automatic: true,
          elapsed: director.elapsed,
          bodyStart: step.reveal.bodyStart,
          subtitleStart: step.reveal.subtitleStart,
          highlights: step.highlights,
        }}
      >
        <div
          ref={primaryRef}
          className={"cinema-primary placement-" + step.focus}
          key={step.id}
          data-content-type={step.content.kind}
          data-summary={step.summarized}
          onClickCapture={(event) => {
            if ((event.target as Element).closest("button,a,input,summary"))
              director.pause();
          }}
        >
          <HoloPanel
            id={scene.id + "-" + step.id}
            title={step.content.title}
            kind={step.content.kind}
            note={step.summarized ? "Síntese visual" : undefined}
            onClose={onStop}
          >
            <HoloAutomaticContent
              step={step}
              local={local}
              progress={instant ? 1 : director.progress}
            />
          </HoloPanel>
          {step.summarized ? (
            <p className="cinema-summary-note">
              Síntese visual · conteúdo integral nas exportações
            </p>
          ) : null}
        </div>
      </HoloPlaybackContext.Provider>
      {support && support.id !== step.moduleId ? (
        <HoloPlaybackContext.Provider value={SUPPORT_PLAYBACK}>
          <div
            className="cinema-support"
            key={step.id + "-support"}
            aria-label="Contexto de apoio"
          >
            <HoloPanel
              id={scene.id + "-support"}
              title={support.title}
              kind={support.kind}
              onClose={director.pause}
            >
              {support.kind === "map" ? (
                <HoloAutomaticContent
                  step={{ ...step, content: support }}
                  local={local}
                  progress={1}
                />
              ) : (
                <HoloModuleView module={support} local={local} />
              )}
            </HoloPanel>
          </div>
        </HoloPlaybackContext.Provider>
      ) : null}
      {scene.narration ? (
        <div className="cinema-text-access">
          <button
            aria-expanded={textOpen}
            onClick={() => {
              setTextOpen(!textOpen);
              if (!textOpen) director.pause();
            }}
          >
            {textOpen ? "Recolher texto" : "Ler resposta em texto"}
          </button>
          {showNarration && !textOpen ? (
            <small>Texto completo disponível</small>
          ) : null}
          {textOpen ? (
            <div className="glass cinema-full-text" tabIndex={0}>
              {scene.narration}
            </div>
          ) : null}
        </div>
      ) : null}
      {scene.sources?.length ? (
        <details
          className="cinema-sources"
          onToggle={(e) => {
            if (e.currentTarget.open) director.pause();
          }}
        >
          <summary>Fontes, datas e verificação</summary>
          <div>
            {scene.sources.map((source, i) => (
              <article key={i}>
                <a href={source.href} target="_blank" rel="noreferrer">
                  {source.label} ↗
                </a>
                <small>
                  {source.status === "ok"
                    ? "Consulta válida"
                    : source.status === "mismatch"
                      ? "Divergência"
                      : "Indisponível"}{" "}
                  · {new Date(source.checkedAt).toLocaleString("pt-BR")}
                </small>
                <p>{source.note}</p>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
