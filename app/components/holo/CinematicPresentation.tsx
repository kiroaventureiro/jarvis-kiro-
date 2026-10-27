"use client";
import { useEffect, useState } from "react";
import type { HoloScene, HoloLocalMedia } from "../../../lib/holo/types";
import {
  HoloPanel,
  HoloModuleView,
  HoloTextStream,
  HoloPlaybackContext,
} from "./HoloModules";
import { useDemonstration } from "./useDemonstration";
export default function CinematicPresentation({
  scene,
  local,
  onExplore,
  showNarration = false,
}: {
  showNarration?: boolean;
  scene: HoloScene;
  local: HoloLocalMedia[];
  onExplore: () => void;
}) {
  const director = useDemonstration(scene),
    step = director.step,
    [textOpen, setTextOpen] = useState(showNarration);
  useEffect(() => setTextOpen(showNarration), [showNarration]);
  const primary = scene.modules.find((m) => m.id === step?.moduleId),
    support = scene.modules.find((m) => m.id === step?.supportId);
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
  if (!step || !primary) return null;
  return (
    <HoloPlaybackContext.Provider
      value={{
        playing: director.playing,
        instant: director.manual || director.finished,
      }}
    >
      <div
        className="cinema-root"
        data-focus={step.focus}
        data-playing={director.playing}
        data-complete={director.finished}
        data-sync={director.sync ? "speech" : "guided"}
      >
        <div className="cinema-director">
          <span className="cinema-state">
            {director.finished
              ? "Relatório pronto"
              : director.playing
                ? director.sync
                  ? "Acompanhando a fala"
                  : "Demonstração em andamento"
                : "Demonstração pausada"}
          </span>
          <div className="cinema-controls">
            <button
              onClick={() => director.jump(Math.max(0, director.index - 1))}
              aria-label="Cena anterior"
              disabled={director.index === 0}
            >
              ‹
            </button>
            <button
              onClick={
                director.playing
                  ? director.pause
                  : director.finished
                    ? director.replay
                    : director.resume
              }
              aria-label={
                director.playing
                  ? "Pausar demonstração"
                  : director.finished
                    ? "Reiniciar demonstração"
                    : "Continuar demonstração"
              }
            >
              {director.playing ? "Ⅱ" : director.finished ? "↻" : "▶"}
            </button>
            <button
              onClick={() =>
                director.jump(
                  Math.min(director.plan.length - 1, director.index + 1),
                )
              }
              aria-label="Próxima cena"
              disabled={director.index >= director.plan.length - 1}
            >
              ›
            </button>
            <label>
              Ritmo
              <select
                value={director.speed}
                onChange={(e) => director.setSpeed(Number(e.target.value))}
              >
                <option value={0.75}>Calmo</option>
                <option value={1}>Natural</option>
                <option value={1.5}>Rápido</option>
              </select>
            </label>
            <button onClick={onExplore}>Explorar quadros</button>
          </div>
          <div
            className="cinema-track"
            role="progressbar"
            aria-label="Progresso da demonstração"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              (director.elapsed / (director.duration || 1)) * 100,
            )}
          >
            <i
              style={{
                width:
                  (director.elapsed / (director.duration || 1)) * 100 + "%",
              }}
            />
          </div>
        </div>
        <div className="cinema-caption" key={step.id + "-caption"}>
          <span>
            {String(director.index + 1).padStart(2, "0")} /{" "}
            {String(director.plan.length).padStart(2, "0")}
          </span>
          <HoloTextStream text={step.cue} />
        </div>
        <div className={"cinema-primary placement-" + step.focus} key={step.id}>
          <HoloPanel
            id={scene.id + "-" + step.id}
            title={primary.title}
            kind={primary.kind}
            onClose={() =>
              director.jump(
                Math.min(director.plan.length - 1, director.index + 1),
              )
            }
          >
            <HoloModuleView
              module={primary}
              local={local}
              progress={
                director.manual || director.finished ? 1 : director.progress
              }
              point={step.point}
            />
          </HoloPanel>
        </div>
        {support && support.id !== primary.id ? (
          <div className="cinema-support" key={step.id + "-support"}>
            <HoloPanel
              id={scene.id + "-support"}
              title={support.title}
              kind={support.kind}
              onClose={() => director.pause()}
            >
              <HoloModuleView module={support} local={local} progress={1} />
            </HoloPanel>
          </div>
        ) : null}
        <div
          className="cinema-scene-index"
          aria-label="Sequência da demonstração"
        >
          {director.plan.map((s, i) => (
            <button
              key={s.id}
              aria-current={i === director.index ? "step" : undefined}
              onClick={() => director.jump(i)}
              title={s.cue}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {scene.narration ? (
          <div className="cinema-text-access">
            <button
              aria-expanded={textOpen}
              onClick={() => setTextOpen(!textOpen)}
            >
              {textOpen ? "Recolher texto" : "Ler resposta em texto"}
            </button>
            {textOpen ? (
              <div className="glass cinema-full-text" tabIndex={0}>
                {scene.narration}
              </div>
            ) : null}
          </div>
        ) : null}
        {scene.sources?.length ? (
          <details className="cinema-sources">
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
    </HoloPlaybackContext.Provider>
  );
}
