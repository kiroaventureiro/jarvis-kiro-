"use client";
import { memo, useState, useRef, useEffect } from "react";
import geography from "../../../config/holo-brazil-map.json";
import HoloTypewriter from "./HoloTypewriter";
import type { HoloModule } from "../../../lib/holo/types";
type Of<K extends HoloModule["kind"]> = Extract<HoloModule, { kind: K }>;
function HoloMap({
  module: m,
  automatic = false,
}: {
  module: Of<"map">;
  automatic?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null),
    [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null),
    [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!automatic || !m.focusRegions?.length) return;
    const boxes = m.focusRegions.flatMap((id) => {
      const node = svgRef.current?.querySelector<SVGGraphicsElement>(
        '[data-region="' + id + '"]',
      );
      return node ? [node.getBBox()] : [];
    });
    if (!boxes.length) return;
    const x = Math.min(...boxes.map((b) => b.x)),
      y = Math.min(...boxes.map((b) => b.y)),
      right = Math.max(...boxes.map((b) => b.x + b.width)),
      bottom = Math.max(...boxes.map((b) => b.y + b.height)),
      scale = Math.max(
        1,
        Math.min(3, Math.min(260 / (right - x || 1), 250 / (bottom - y || 1))),
      );
    setZoom(scale);
    setOffset({
      x: scale * (165 - (x + right) / 2),
      y: scale * (167 - (y + bottom) / 2),
    });
  }, [automatic, m.focusRegions]);
  const region = geography.regions.find((r) => r.id === selected);
  return (
    <div
      className={"holo-map" + (automatic ? " is-automatic-map" : "")}
      data-context-region={m.focusLabel || "Brasil"}
    >
      <div className="holo-map-viewport">
        <svg
          ref={svgRef}
          viewBox={geography.viewBox}
          aria-label="Mapa interativo das unidades da federação do Brasil"
          role="group"
        >
          <g
            transform={
              "translate(" +
              (165 - 165 * zoom + offset.x) +
              "," +
              (167 - 167 * zoom + offset.y) +
              ") scale(" +
              zoom +
              ")"
            }
          >
            {geography.regions.map((r) => (
              <path
                key={r.id}
                data-region={r.id}
                d={r.d}
                fillRule="evenodd"
                className={
                  selected === r.id ||
                  (automatic && m.focusRegions?.includes(r.id))
                    ? "is-selected"
                    : ""
                }
                role={automatic ? "presentation" : "button"}
                aria-hidden={automatic || undefined}
                tabIndex={automatic ? -1 : 0}
                aria-label={"Selecionar " + r.name}
                aria-pressed={selected === r.id}
                onClick={automatic ? undefined : () => setSelected(r.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(r.id);
                  }
                }}
              >
                <title>{r.name}</title>
              </path>
            ))}
          </g>
        </svg>
        <span className="holo-map-coordinate">BR / MALHA SIMPLIFICADA</span>
      </div>
      {!automatic ? (
        <div className="holo-map-tools">
          <button
            aria-label="Aproximar mapa"
            disabled={zoom >= 2}
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
          >
            +
          </button>
          <button
            aria-label="Afastar mapa"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          >
            −
          </button>
          <button
            onClick={() => {
              setSelected(null);
              setZoom(1);
            }}
          >
            Restaurar
          </button>
        </div>
      ) : null}
      <p className="holo-map-selection" role="status">
        {region
          ? region.name
          : automatic
            ? m.focusLabel || "Brasil · unidades da federação"
            : "Selecione um estado ou o Distrito Federal"}
      </p>
      {automatic ? (
        <small className="holo-geography-note">
          Limites estaduais atuais · referência regional, não fronteiras
          históricas.
        </small>
      ) : null}
      <p className="holo-caption">
        {automatic ? <HoloTypewriter text={m.caption} /> : m.caption}
      </p>
      <a href={geography.url} target="_blank" rel="noreferrer">
        Fonte: IBGE · malha simplificada ↗
      </a>
    </div>
  );
}

export default memo(HoloMap);
